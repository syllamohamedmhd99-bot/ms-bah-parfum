import { Router, Response } from 'express';
import db, { logAudit } from '../database.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/transfers
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { type, service, status, limit = 50 } = req.query;

  let query = `
    SELECT t.*,
           u.full_name as operator_name,
           cr.name as wallet_name,
           cd.name as cash_desk_name,
           canceller.full_name as cancelled_by_name
    FROM money_transfers t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN cash_registers cr ON t.cash_register_id = cr.id
    LEFT JOIN cash_registers cd ON t.cash_desk_id = cd.id
    LEFT JOIN users canceller ON t.cancelled_by = canceller.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (type) {
    query += ` AND t.type = ?`;
    params.push(type);
  }

  if (service) {
    query += ` AND t.service = ?`;
    params.push(service);
  }

  if (status) {
    query += ` AND t.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY t.created_at DESC LIMIT ?`;
  params.push(Number(limit));

  const transfers = db.prepare(query).all(...params);
  res.json(transfers);
});

// GET /api/transfers/summary
router.get('/summary', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'deposit' AND status = 'validated' THEN amount ELSE 0 END), 0) as total_deposits,
      COALESCE(SUM(CASE WHEN type = 'withdrawal' AND status = 'validated' THEN amount ELSE 0 END), 0) as total_withdrawals,
      COALESCE(SUM(CASE WHEN status = 'validated' THEN boutique_commission ELSE 0 END), 0) as total_commissions,
      COALESCE(SUM(CASE WHEN service = 'orange_money' AND status = 'validated' THEN amount ELSE 0 END), 0) as total_om,
      COALESCE(SUM(CASE WHEN service = 'mtn_momo' AND status = 'validated' THEN amount ELSE 0 END), 0) as total_momo,
      COUNT(id) as total_operations
    FROM money_transfers
    WHERE date(created_at) = date('now')
  `).get() as any;

  const wallets = db.prepare(`
    SELECT id, name, type, balance, phone_number
    FROM cash_registers
    WHERE type IN ('orange_money', 'mtn_momo', 'cash') AND is_active = 1
  `).all();

  res.json({ todaySummary: summary, wallets });
});

// POST /api/transfers (Enregistrer un Dépôt ou Retrait Mobile Money)
router.post('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const {
    type, // 'deposit' or 'withdrawal'
    client_name,
    client_phone,
    amount,
    service = 'orange_money', // 'orange_money', 'mtn_momo', 'other'
    client_fee = 0,
    boutique_commission = 0,
    transaction_ref,
    cash_register_id, // Mobile Money wallet
    cash_desk_id,     // Physical cash drawer (default 1)
    notes,
    status = 'validated' // 'pending', 'validated'
  } = req.body;

  if (!type || !['deposit', 'withdrawal'].includes(type)) {
    res.status(400).json({ error: 'Le type d\'opération doit être "deposit" (Dépôt) ou "withdrawal" (Retrait).' });
    return;
  }

  if (!client_name || !amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'Le nom du client et un montant valide sont obligatoires.' });
    return;
  }

  const amtNum = Number(amount);
  const feeNum = Number(client_fee) || 0;
  const commNum = Number(boutique_commission) || 0;

  const executeTransfer = db.transaction(() => {
    // 1. Identify Mobile Money Wallet and Physical Cash Drawer
    let walletId = cash_register_id;
    if (!walletId) {
      const w = db.prepare('SELECT id FROM cash_registers WHERE type = ? AND is_active = 1 LIMIT 1').get(service) as any;
      walletId = w ? w.id : null;
    }

    let deskId = cash_desk_id;
    if (!deskId) {
      const d = db.prepare("SELECT id FROM cash_registers WHERE type = 'cash' AND is_active = 1 LIMIT 1").get() as any;
      deskId = d ? d.id : 1;
    }

    if (!walletId) {
      throw new Error(`Aucun portefeuille ${service} configuré ou actif.`);
    }

    const wallet = db.prepare('SELECT * FROM cash_registers WHERE id = ?').get(walletId) as any;
    const desk = db.prepare('SELECT * FROM cash_registers WHERE id = ?').get(deskId) as any;

    if (!wallet || !desk) {
      throw new Error('Portefeuille ou caisse physique introuvable.');
    }

    // 2. Strict Balance Verification BEFORE validation!
    if (status === 'validated') {
      if (type === 'deposit') {
        // DEPOT: Customer hands cash to boutique (+desk), boutique sends e-money from wallet to customer (-wallet)
        if (wallet.balance < amtNum) {
          throw new Error(`Solde insuffisant sur le portefeuille ${wallet.name}. Solde disponible: ${wallet.balance.toLocaleString('fr-FR')} GNF, montant à transférer: ${amtNum.toLocaleString('fr-FR')} GNF.`);
        }
      } else if (type === 'withdrawal') {
        // RETRAIT: Customer sends e-money to boutique (+wallet), boutique hands cash to customer (-desk)
        if (desk.balance < amtNum) {
          throw new Error(`Fonds d'espèces insuffisants dans la caisse physique ${desk.name}. Espèces disponibles: ${desk.balance.toLocaleString('fr-FR')} GNF, montant à remettre au client: ${amtNum.toLocaleString('fr-FR')} GNF.`);
        }
      }
    }

    // Generate unique transfer number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const transferNumber = `TRF-${dateStr}-${rand}`;

    // 3. Insert money transfer record
    const stmt = db.prepare(`
      INSERT INTO money_transfers (
        transfer_number, type, client_name, client_phone, amount,
        service, client_fee, boutique_commission, transaction_ref,
        cash_register_id, cash_desk_id, user_id, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      transferNumber, type, client_name.trim(), client_phone || '',
      amtNum, service, feeNum, commNum, transaction_ref || null,
      walletId, deskId, req.user!.id, status, notes || null
    );

    const transferId = Number(result.lastInsertRowid);

    // 4. Update balances and financial journals if validated
    if (status === 'validated') {
      if (type === 'deposit') {
        // Customer gives cash + fee -> desk increases by (amtNum + feeNum)
        // Boutique wallet sends amtNum -> wallet decreases by amtNum
        // Boutique also gets commission credited to wallet or desk
        db.prepare('UPDATE cash_registers SET balance = balance + ? WHERE id = ?').run(amtNum + feeNum, deskId);
        db.prepare('UPDATE cash_registers SET balance = balance - ? + ? WHERE id = ?').run(amtNum, commNum, walletId);

        // Record boutique commission as revenue in financial movements (NOT the customer funds!)
        if (commNum > 0) {
          const finNum = `COM-${dateStr}-${rand}`;
          db.prepare(`
            INSERT INTO financial_movements (
              movement_number, type, is_inflow, cash_register_id, amount,
              category, description, reference_type, reference_id, user_id
            ) VALUES (?, 'commission_income', 1, ?, ?, 'Commissions Mobile Money', ?, 'money_transfer', ?, ?)
          `).run(finNum, walletId, commNum, `Commission dépôt ${service} de ${amtNum.toLocaleString('fr-FR')} GNF pour ${client_name}`, transferId, req.user!.id);
        }
      } else if (type === 'withdrawal') {
        // Customer sends e-money amtNum to boutique -> wallet increases by (amtNum + commNum)
        // Boutique hands physical cash amtNum to customer -> desk decreases by amtNum
        db.prepare('UPDATE cash_registers SET balance = balance - ? WHERE id = ?').run(amtNum, deskId);
        db.prepare('UPDATE cash_registers SET balance = balance + ? + ? WHERE id = ?').run(amtNum, commNum, walletId);

        // Record boutique commission as revenue
        if (commNum > 0) {
          const finNum = `COM-${dateStr}-${rand}`;
          db.prepare(`
            INSERT INTO financial_movements (
              movement_number, type, is_inflow, cash_register_id, amount,
              category, description, reference_type, reference_id, user_id
            ) VALUES (?, 'commission_income', 1, ?, ?, 'Commissions Mobile Money', ?, 'money_transfer', ?, ?)
          `).run(finNum, walletId, commNum, `Commission retrait ${service} de ${amtNum.toLocaleString('fr-FR')} GNF pour ${client_name}`, transferId, req.user!.id);
        }
      }
    }

    logAudit(
      req.user!.id, req.user!.fullName, 'MONEY_TRANSFER', 'money_transfer', transferId,
      `${type === 'deposit' ? 'Dépôt' : 'Retrait'} ${service.toUpperCase()} de ${amtNum.toLocaleString('fr-FR')} GNF pour ${client_name} (Réf: ${transferNumber}, Statut: ${status})`
    );

    return { transferId, transferNumber, status };
  });

  try {
    const resTransfer = executeTransfer();
    res.status(201).json({
      message: `${type === 'deposit' ? 'Dépôt' : 'Retrait'} enregistré avec succès.`,
      ...resTransfer
    });
  } catch (err: any) {
    console.error('Erreur transfert:', err);
    res.status(400).json({ error: err.message || 'Erreur lors de l\'enregistrement de l\'opération Mobile Money.' });
  }
});

// POST /api/transfers/:id/cancel (Annulation traçable d'une opération financière)
router.post('/:id/cancel', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim() === '') {
    res.status(400).json({ error: 'Le motif d\'annulation est obligatoire.' });
    return;
  }

  const executeCancel = db.transaction(() => {
    const transfer = db.prepare('SELECT * FROM money_transfers WHERE id = ?').get(id) as any;
    if (!transfer) {
      throw new Error('Opération introuvable.');
    }

    if (transfer.status === 'cancelled') {
      throw new Error('Cette opération a déjà été annulée.');
    }

    // Reverse balances if it was validated
    if (transfer.status === 'validated') {
      const amt = transfer.amount;
      const comm = transfer.boutique_commission || 0;
      const fee = transfer.client_fee || 0;

      if (transfer.type === 'deposit') {
        db.prepare('UPDATE cash_registers SET balance = balance - ? WHERE id = ?').run(amt + fee, transfer.cash_desk_id);
        db.prepare('UPDATE cash_registers SET balance = balance + ? - ? WHERE id = ?').run(amt, comm, transfer.cash_register_id);
      } else if (transfer.type === 'withdrawal') {
        db.prepare('UPDATE cash_registers SET balance = balance + ? WHERE id = ?').run(amt, transfer.cash_desk_id);
        db.prepare('UPDATE cash_registers SET balance = balance - ? - ? WHERE id = ?').run(amt, comm, transfer.cash_register_id);
      }

      // Mark associated commission movements as cancelled
      db.prepare(`
        UPDATE financial_movements SET
          is_cancelled = 1,
          cancellation_reason = ?,
          cancelled_by = ?
        WHERE reference_type = 'money_transfer' AND reference_id = ?
      `).run(reason.trim(), req.user!.id, id);
    }

    db.prepare(`
      UPDATE money_transfers SET
        status = 'cancelled',
        cancellation_reason = ?,
        cancelled_by = ?
      WHERE id = ?
    `).run(reason.trim(), req.user!.id, id);

    logAudit(
      req.user!.id, req.user!.fullName, 'CANCEL_TRANSFER', 'money_transfer', Number(id),
      `Annulation de l'opération ${transfer.transfer_number} (${transfer.type} ${transfer.service}). Motif: ${reason.trim()}`
    );

    return { transferNumber: transfer.transfer_number };
  });

  try {
    const result = executeCancel();
    res.json({ message: `Opération ${result.transferNumber} annulée avec succès et soldes contrepassés.` });
  } catch (err: any) {
    console.error('Erreur annulation transfert:', err);
    res.status(400).json({ error: err.message || 'Erreur lors de l\'annulation de l\'opération.' });
  }
});

// DELETE /api/transfers/:id (Suppression d'un transfert de l'historique)
router.delete('/:id', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const transfer = db.prepare('SELECT * FROM money_transfers WHERE id = ?').get(id) as any;
  if (!transfer) {
    res.status(404).json({ error: 'Opération Mobile Money introuvable.' });
    return;
  }

  const executeDelete = db.transaction(() => {
    // Delete linked financial commissions if any
    db.prepare("DELETE FROM financial_movements WHERE reference_type = 'money_transfer' AND reference_id = ?").run(id);
    db.prepare('DELETE FROM money_transfers WHERE id = ?').run(id);

    logAudit(
      req.user!.id, req.user!.fullName, 'DELETE_TRANSFER', 'money_transfer', Number(id),
      `Suppression de l'opération ${transfer.transfer_number} (${transfer.type} ${transfer.service}, ${transfer.amount} GNF) de l'historique`
    );
  });

  try {
    executeDelete();
    res.json({ message: `Opération ${transfer.transfer_number} supprimée de l'historique avec succès.` });
  } catch (err: any) {
    console.error('Erreur suppression transfert:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la suppression du transfert.' });
  }
});

// POST /api/transfers/clear (Vider tout l'historique des transferts)
router.post('/clear', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const executeClear = db.transaction(() => {
    db.prepare("DELETE FROM financial_movements WHERE reference_type = 'money_transfer'").run();
    db.prepare('DELETE FROM money_transfers').run();

    logAudit(
      req.user!.id, req.user!.fullName, 'CLEAR_TRANSFERS', 'money_transfer', null,
      'Purge complète de l\'historique des transferts Mobile Money'
    );
  });

  try {
    executeClear();
    res.json({ message: 'Historique des transferts vidé avec succès.' });
  } catch (err: any) {
    console.error('Erreur vidage transferts:', err);
    res.status(500).json({ error: err.message || 'Erreur lors du vidage des transferts.' });
  }
});

export default router;
