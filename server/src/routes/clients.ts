import { Router, Response } from 'express';
import db, { logAudit } from '../database.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/clients
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { search } = req.query;

  let query = `
    SELECT c.*,
           (SELECT COUNT(s.id) FROM sales s WHERE s.client_id = c.id AND s.status = 'completed') as total_sales_count,
           (SELECT COALESCE(SUM(s.total_amount), 0) FROM sales s WHERE s.client_id = c.id AND s.status = 'completed') as total_purchased
    FROM clients c
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search && typeof search === 'string') {
    query += ` AND (LOWER(c.name) LIKE ? OR LOWER(c.phone) LIKE ?)`;
    const searchVal = `%${search.toLowerCase().trim()}%`;
    params.push(searchVal, searchVal);
  }

  query += ` ORDER BY c.name ASC`;
  const clients = db.prepare(query).all(...params);
  res.json(clients);
});

// GET /api/clients/:id/history
router.get('/:id/history', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) {
    res.status(404).json({ error: 'Client introuvable.' });
    return;
  }

  const sales = db.prepare(`
    SELECT s.*, u.full_name as cashier_name
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.client_id = ?
    ORDER BY s.date DESC
  `).all(id);

  const transfers = db.prepare(`
    SELECT t.*, u.full_name as operator_name
    FROM money_transfers t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.client_name LIKE (SELECT name FROM clients WHERE id = ?)
       OR t.client_phone LIKE (SELECT phone FROM clients WHERE id = ?)
    ORDER BY t.created_at DESC
  `).all(id, id);

  const debtPayments = db.prepare(`
    SELECT fm.*, u.full_name as user_name
    FROM financial_movements fm
    LEFT JOIN users u ON fm.user_id = u.id
    WHERE fm.reference_type = 'client_debt_payment' AND fm.reference_id = ?
    ORDER BY fm.date DESC
  `).all(id);

  res.json({ client, sales, transfers, debtPayments });
});

// POST /api/clients
router.post('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { name, phone, address, credit_limit = 0, notes } = req.body;
  if (!name || name.trim() === '') {
    res.status(400).json({ error: 'Le nom du client est obligatoire.' });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO clients (name, phone, address, credit_limit, notes)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(name.trim(), phone || null, address || null, Number(credit_limit) || 0, notes || null);
  const clientId = Number(result.lastInsertRowid);

  logAudit(req.user!.id, req.user!.fullName, 'CREATE_CLIENT', 'client', clientId, `Création du client ${name.trim()}`);
  res.status(201).json({ id: clientId, message: 'Client créé avec succès.' });
});

// PUT /api/clients/:id
router.put('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, phone, address, credit_limit, notes } = req.body;

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
  if (!client) {
    res.status(404).json({ error: 'Client introuvable.' });
    return;
  }

  db.prepare(`
    UPDATE clients SET name = ?, phone = ?, address = ?, credit_limit = ?, notes = ?
    WHERE id = ?
  `).run(name ? name.trim() : client.name, phone ?? client.phone, address ?? client.address, credit_limit !== undefined ? Number(credit_limit) : client.credit_limit, notes ?? client.notes, id);

  logAudit(req.user!.id, req.user!.fullName, 'UPDATE_CLIENT', 'client', Number(id), `Modification du client ${name || client.name}`);
  res.json({ message: 'Client mis à jour avec succès.' });
});

// POST /api/clients/:id/pay-debt (Règlement de dette / crédit client)
router.post('/:id/pay-debt', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { amount, cash_register_id = 1, notes } = req.body;

  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'Un montant de remboursement valide est obligatoire.' });
    return;
  }

  const amtNum = Number(amount);

  const executePayment = db.transaction(() => {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
    if (!client) {
      throw new Error('Client introuvable.');
    }

    if (client.current_debt <= 0) {
      throw new Error('Ce client n\'a aucune dette en cours.');
    }

    const payAmount = Math.min(amtNum, client.current_debt);
    const newDebt = client.current_debt - payAmount;

    // 1. Update client debt
    db.prepare('UPDATE clients SET current_debt = ? WHERE id = ?').run(newDebt, id);

    // 2. Add cash to register
    db.prepare('UPDATE cash_registers SET balance = balance + ? WHERE id = ?').run(payAmount, cash_register_id);

    // 3. Record financial inflow
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const movementNumber = `REC-DET-${dateStr}-${rand}`;

    db.prepare(`
      INSERT INTO financial_movements (
        movement_number, type, is_inflow, cash_register_id, amount,
        category, description, reference_type, reference_id, user_id
      ) VALUES (?, 'credit_payment', 1, ?, ?, 'Règlement crédit client', ?, 'client_debt_payment', ?, ?)
    `).run(
      movementNumber, cash_register_id, payAmount,
      `Règlement dette de ${client.name} (${payAmount.toLocaleString('fr-FR')} GNF). Reste dû: ${newDebt.toLocaleString('fr-FR')} GNF. ${notes || ''}`,
      id, req.user!.id
    );

    logAudit(
      req.user!.id, req.user!.fullName, 'PAY_CLIENT_DEBT', 'client', Number(id),
      `Règlement de dette de ${payAmount.toLocaleString('fr-FR')} GNF pour le client ${client.name}. Nouveau solde dû: ${newDebt.toLocaleString('fr-FR')} GNF.`
    );

    return { payAmount, newDebt };
  });

  try {
    const result = executePayment();
    res.json({
      message: `Paiement de ${result.payAmount.toLocaleString('fr-FR')} GNF enregistré avec succès. Reste dû: ${result.newDebt.toLocaleString('fr-FR')} GNF.`,
      ...result
    });
  } catch (err: any) {
    console.error('Erreur règlement dette client:', err);
    res.status(400).json({ error: err.message || 'Erreur lors du règlement de dette.' });
  }
});

// DELETE /api/clients/:id (Suppression d'un client)
router.delete('/:id', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
  if (!client) {
    res.status(404).json({ error: 'Client introuvable.' });
    return;
  }

  // Check if client has unpaid debt
  if (client.current_debt > 0) {
    res.status(400).json({
      error: `Impossible de supprimer "${client.name}" car ce client a une dette en cours de ${client.current_debt.toLocaleString('fr-FR')} GNF. Veuillez d'abord solder ou annuler sa dette.`
    });
    return;
  }

  db.transaction(() => {
    // Unlink sales (set client_id = NULL so transactions remain intact)
    db.prepare('UPDATE sales SET client_id = NULL WHERE client_id = ?').run(id);
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  })();

  logAudit(req.user!.id, req.user!.fullName, 'DELETE_CLIENT', 'client', Number(id), `Suppression du client: ${client.name}`);
  res.json({ message: `Client(e) "${client.name}" supprimé(e) avec succès.` });
});

export default router;
