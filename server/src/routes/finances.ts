import { Router, Response } from 'express';
import db, { logAudit } from '../database.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/finances/movements (Journal financier)
router.get('/movements', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { date_start, date_end, type, category, register_id, is_inflow, limit = 100 } = req.query;

  let query = `
    SELECT fm.*,
           cr.name as register_name,
           tr.name as target_register_name,
           u.full_name as user_name
    FROM financial_movements fm
    JOIN cash_registers cr ON fm.cash_register_id = cr.id
    LEFT JOIN cash_registers tr ON fm.target_register_id = tr.id
    LEFT JOIN users u ON fm.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (date_start) {
    query += ` AND date(fm.date) >= date(?)`;
    params.push(date_start);
  }

  if (date_end) {
    query += ` AND date(fm.date) <= date(?)`;
    params.push(date_end);
  }

  if (type) {
    query += ` AND fm.type = ?`;
    params.push(type);
  }

  if (category) {
    query += ` AND fm.category = ?`;
    params.push(category);
  }

  if (register_id) {
    query += ` AND (fm.cash_register_id = ? OR fm.target_register_id = ?)`;
    params.push(register_id, register_id);
  }

  if (is_inflow !== undefined) {
    query += ` AND fm.is_inflow = ?`;
    params.push(is_inflow);
  }

  query += ` ORDER BY fm.date DESC LIMIT ?`;
  params.push(Number(limit));

  const movements = db.prepare(query).all(...params);
  res.json(movements);
});

// POST /api/finances/expenses (Enregistrer une dépense d'exploitation)
router.post('/expenses', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const {
    category, // 'Loyer', 'Électricité', 'Transport', 'Salaires', 'Frais de fonctionnement', 'Retraits propriétaire', 'Autres'
    type = 'operating_expense',
    amount,
    cash_register_id = 1,
    description,
    date
  } = req.body;

  if (!category || !amount || Number(amount) <= 0 || !description) {
    res.status(400).json({ error: 'La catégorie, le montant et une description sont obligatoires.' });
    return;
  }

  const amtNum = Number(amount);

  const executeExpense = db.transaction(() => {
    // 1. Verify register has enough balance
    const register = db.prepare('SELECT * FROM cash_registers WHERE id = ?').get(cash_register_id) as any;
    if (!register) {
      throw new Error('Caisse ou portefeuille introuvable.');
    }

    if (register.balance < amtNum) {
      throw new Error(`Solde insuffisant dans la caisse ${register.name} (${register.balance.toLocaleString('fr-FR')} GNF). Montant demandé: ${amtNum.toLocaleString('fr-FR')} GNF.`);
    }

    // 2. Decrement register balance
    db.prepare('UPDATE cash_registers SET balance = balance - ? WHERE id = ?').run(amtNum, cash_register_id);

    // 3. Generate movement number: DEP-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const movementNumber = `DEP-${dateStr}-${rand}`;

    // 4. Insert into financial_movements
    const stmt = db.prepare(`
      INSERT INTO financial_movements (
        movement_number, type, is_inflow, cash_register_id, amount,
        date, category, description, user_id
      ) VALUES (?, ?, 0, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?)
    `);

    const result = stmt.run(movementNumber, type, cash_register_id, amtNum, date || null, category, description.trim(), req.user!.id);
    const movementId = Number(result.lastInsertRowid);

    logAudit(
      req.user!.id, req.user!.fullName, 'EXPENSE', 'financial_movement', movementId,
      `Dépense de ${amtNum.toLocaleString('fr-FR')} GNF (${category}) depuis ${register.name}. Description: ${description.trim()}`
    );

    return { movementId, movementNumber, newBalance: register.balance - amtNum };
  });

  try {
    const result = executeExpense();
    res.status(201).json({
      message: 'Dépense enregistrée avec succès.',
      ...result
    });
  } catch (err: any) {
    console.error('Erreur dépense:', err);
    res.status(400).json({ error: err.message || 'Erreur lors de l\'enregistrement de la dépense.' });
  }
});

// POST /api/finances/incomes (Apports de fonds ou autres recettes)
router.post('/incomes', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const {
    category, // 'Apport propriétaire', 'Autre recette'
    type = 'owner_contribution',
    amount,
    cash_register_id = 1,
    description,
    date
  } = req.body;

  if (!category || !amount || Number(amount) <= 0 || !description) {
    res.status(400).json({ error: 'La catégorie, le montant et une description sont obligatoires.' });
    return;
  }

  const amtNum = Number(amount);

  const executeIncome = db.transaction(() => {
    const register = db.prepare('SELECT * FROM cash_registers WHERE id = ?').get(cash_register_id) as any;
    if (!register) {
      throw new Error('Caisse ou portefeuille introuvable.');
    }

    db.prepare('UPDATE cash_registers SET balance = balance + ? WHERE id = ?').run(amtNum, cash_register_id);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const movementNumber = `REC-${dateStr}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO financial_movements (
        movement_number, type, is_inflow, cash_register_id, amount,
        date, category, description, user_id
      ) VALUES (?, ?, 1, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?)
    `);

    const result = stmt.run(movementNumber, type, cash_register_id, amtNum, date || null, category, description.trim(), req.user!.id);
    const movementId = Number(result.lastInsertRowid);

    logAudit(
      req.user!.id, req.user!.fullName, 'INCOME', 'financial_movement', movementId,
      `Entrée financière de ${amtNum.toLocaleString('fr-FR')} GNF (${category}) sur ${register.name}.`
    );

    return { movementId, movementNumber, newBalance: register.balance + amtNum };
  });

  try {
    const result = executeIncome();
    res.status(201).json({
      message: 'Recette enregistrée avec succès.',
      ...result
    });
  } catch (err: any) {
    console.error('Erreur recette:', err);
    res.status(400).json({ error: err.message || 'Erreur lors de l\'enregistrement de la recette.' });
  }
});

// POST /api/finances/transfers (Transfert entre caisses SANS double comptabilisation)
router.post('/transfers', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { source_register_id, target_register_id, amount, description } = req.body;

  if (!source_register_id || !target_register_id || !amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'La caisse source, la caisse destination et un montant valide sont requis.' });
    return;
  }

  if (Number(source_register_id) === Number(target_register_id)) {
    res.status(400).json({ error: 'La caisse source et la caisse destination doivent être distinctes.' });
    return;
  }

  const amtNum = Number(amount);

  const executeTransfer = db.transaction(() => {
    const sourceReg = db.prepare('SELECT * FROM cash_registers WHERE id = ?').get(source_register_id) as any;
    const targetReg = db.prepare('SELECT * FROM cash_registers WHERE id = ?').get(target_register_id) as any;

    if (!sourceReg || !targetReg) {
      throw new Error('Une des caisses sélectionnées est introuvable.');
    }

    if (sourceReg.balance < amtNum) {
      throw new Error(`Solde insuffisant dans la caisse source ${sourceReg.name}. Solde: ${sourceReg.balance.toLocaleString('fr-FR')} GNF.`);
    }

    // Transfer funds between registers
    db.prepare('UPDATE cash_registers SET balance = balance - ? WHERE id = ?').run(amtNum, source_register_id);
    db.prepare('UPDATE cash_registers SET balance = balance + ? WHERE id = ?').run(amtNum, target_register_id);

    // Record as transfer (is_inflow = 2: internal transfer, NOT counted as external income or expense!)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const movementNumber = `TRF-INT-${dateStr}-${rand}`;

    const stmt = db.prepare(`
      INSERT INTO financial_movements (
        movement_number, type, is_inflow, cash_register_id, target_register_id,
        amount, category, description, user_id
      ) VALUES (?, 'register_transfer', 2, ?, ?, ?, 'Transfert inter-caisses', ?, ?)
    `);

    const result = stmt.run(
      movementNumber, source_register_id, target_register_id, amtNum,
      description ? description.trim() : `Transfert de ${sourceReg.name} vers ${targetReg.name}`,
      req.user!.id
    );

    const movementId = Number(result.lastInsertRowid);

    logAudit(
      req.user!.id, req.user!.fullName, 'REGISTER_TRANSFER', 'financial_movement', movementId,
      `Transfert inter-caisses de ${amtNum.toLocaleString('fr-FR')} GNF de "${sourceReg.name}" vers "${targetReg.name}".`
    );

    return { movementId, movementNumber };
  });

  try {
    const result = executeTransfer();
    res.status(201).json({
      message: 'Transfert inter-caisses effectué avec succès (sans impact sur les revenus nets).',
      ...result
    });
  } catch (err: any) {
    console.error('Erreur transfert inter-caisses:', err);
    res.status(400).json({ error: err.message || 'Erreur lors du transfert inter-caisses.' });
  }
});

// DELETE /api/finances/movements/:id (Suppression d'un mouvement financier de l'historique)
router.delete('/movements/:id', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const movement = db.prepare('SELECT * FROM financial_movements WHERE id = ?').get(id) as any;
  if (!movement) {
    res.status(404).json({ error: 'Mouvement financier introuvable.' });
    return;
  }

  try {
    db.prepare('DELETE FROM financial_movements WHERE id = ?').run(id);

    logAudit(
      req.user!.id, req.user!.fullName, 'DELETE_FINANCIAL_MOVEMENT', 'financial_movement', Number(id),
      `Suppression du mouvement financier ${movement.movement_number} (${movement.category}, ${movement.amount} GNF) de l'historique`
    );

    res.json({ message: 'Mouvement financier supprimé de l\'historique avec succès.' });
  } catch (err: any) {
    console.error('Erreur suppression mouvement financier:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la suppression du mouvement financier.' });
  }
});

// POST /api/finances/movements/clear (Vider tout le journal financier)
router.post('/movements/clear', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    db.prepare('DELETE FROM financial_movements').run();

    logAudit(
      req.user!.id, req.user!.fullName, 'CLEAR_FINANCIAL_MOVEMENTS', 'financial_movement', null,
      'Purge complète du journal des flux financiers'
    );

    res.json({ message: 'Journal financier vidé avec succès.' });
  } catch (err: any) {
    console.error('Erreur vidage flux financiers:', err);
    res.status(500).json({ error: err.message || 'Erreur lors du vidage du journal financier.' });
  }
});

export default router;
