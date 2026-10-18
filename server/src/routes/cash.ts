import { Router, Response } from 'express';
import db, { logAudit } from '../database.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/cash/registers (Liste de toutes les caisses et portefeuilles)
router.get('/registers', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const registers = db.prepare(`
    SELECT cr.*,
           (SELECT COUNT(cs.id) FROM cash_sessions cs WHERE cs.cash_register_id = cr.id AND cs.status = 'open') as is_currently_open
    FROM cash_registers cr
    ORDER BY cr.id ASC
  `).all();
  res.json(registers);
});

// POST /api/cash/registers (Création d'une caisse ou portefeuille)
router.post('/registers', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { name, type, initial_balance = 0, phone_number, notes } = req.body;
  if (!name || !type) {
    res.status(400).json({ error: 'Le nom et le type de caisse sont obligatoires.' });
    return;
  }

  const validTypes = ['cash', 'orange_money', 'mtn_momo', 'bank', 'other'];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: 'Type de compte invalide.' });
    return;
  }

  const balNum = Number(initial_balance) || 0;
  const stmt = db.prepare(`
    INSERT INTO cash_registers (name, type, balance, phone_number, notes)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(name.trim(), type, balNum, phone_number || null, notes || null);

  logAudit(req.user!.id, req.user!.fullName, 'CREATE_REGISTER', 'cash_register', Number(result.lastInsertRowid), `Création du compte/caisse ${name} (${type}, solde: ${balNum} GNF)`);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Caisse/Portefeuille créé avec succès.' });
});

// GET /api/cash/sessions/current (Session ouverte de l'utilisateur courant)
router.get('/sessions/current', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const session = db.prepare(`
    SELECT cs.*, cr.name as register_name, cr.type as register_type, u.full_name as user_name
    FROM cash_sessions cs
    JOIN cash_registers cr ON cs.cash_register_id = cr.id
    JOIN users u ON cs.user_id = u.id
    WHERE cs.user_id = ? AND cs.status = 'open'
    ORDER BY cs.opening_time DESC LIMIT 1
  `).get(req.user!.id);

  res.json(session || null);
});

// GET /api/cash/sessions (Historique de toutes les sessions)
router.get('/sessions', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { limit = 50 } = req.query;
  const sessions = db.prepare(`
    SELECT cs.*, cr.name as register_name, cr.type as register_type, u.full_name as user_name
    FROM cash_sessions cs
    JOIN cash_registers cr ON cs.cash_register_id = cr.id
    JOIN users u ON cs.user_id = u.id
    ORDER BY cs.opening_time DESC LIMIT ?
  `).all(Number(limit));

  res.json(sessions);
});

// POST /api/cash/sessions/open (Ouverture de caisse avec fonds initial)
router.post('/sessions/open', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { cash_register_id = 1, opening_float = 0, notes } = req.body;

  // Check if this user already has an open session
  const activeSession = db.prepare(`
    SELECT id FROM cash_sessions WHERE user_id = ? AND status = 'open'
  `).get(req.user!.id);

  if (activeSession) {
    res.status(400).json({ error: 'Vous avez déjà une session de caisse ouverte. Veuillez la clôturer avant d\'en ouvrir une nouvelle.' });
    return;
  }

  const floatNum = Number(opening_float) || 0;

  const stmt = db.prepare(`
    INSERT INTO cash_sessions (
      cash_register_id, user_id, opening_time, opening_float,
      total_cash_in, total_cash_out, theoretical_balance, status, notes
    ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, 0, 0, ?, 'open', ?)
  `);

  const result = stmt.run(cash_register_id, req.user!.id, floatNum, floatNum, notes || null);
  const sessionId = Number(result.lastInsertRowid);

  logAudit(
    req.user!.id, req.user!.fullName, 'OPEN_CASH_SESSION', 'cash_session', sessionId,
    `Ouverture de caisse ID ${sessionId} avec fond de ${floatNum.toLocaleString('fr-FR')} GNF`
  );

  res.status(201).json({ id: sessionId, message: 'Session de caisse ouverte avec succès.' });
});

// POST /api/cash/sessions/:id/close (Fermeture de caisse avec comptage réel & écarts)
router.post('/sessions/:id/close', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { actual_balance, justification, notes } = req.body;

  if (actual_balance === undefined || actual_balance === null) {
    res.status(400).json({ error: 'Le montant réel compté (billetage/espèces) est obligatoire.' });
    return;
  }

  const session = db.prepare('SELECT * FROM cash_sessions WHERE id = ?').get(id) as any;
  if (!session) {
    res.status(404).json({ error: 'Session de caisse introuvable.' });
    return;
  }

  if (session.status === 'closed') {
    res.status(400).json({ error: 'Cette session de caisse est déjà clôturée.' });
    return;
  }

  // Calculate session sales cash and withdrawals during this session
  const salesInCash = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total
    FROM sales
    WHERE cash_session_id = ? AND status = 'completed' AND payment_mode = 'cash'
  `).get(id) as any;

  // Theoretical balance = opening_float + cash sales
  const theoreticalBalance = session.opening_float + (salesInCash.total || 0);
  const actualBalanceNum = Number(actual_balance);
  const discrepancy = actualBalanceNum - theoreticalBalance;

  if (discrepancy !== 0 && (!justification || justification.trim() === '')) {
    res.status(400).json({
      error: `Un écart de caisse de ${discrepancy.toLocaleString('fr-FR')} GNF a été détecté. Une justification explicative est obligatoire pour clôturer.`
    });
    return;
  }

  db.prepare(`
    UPDATE cash_sessions SET
      closing_time = CURRENT_TIMESTAMP,
      total_cash_in = ?,
      theoretical_balance = ?,
      actual_balance = ?,
      discrepancy = ?,
      justification = ?,
      status = 'closed',
      notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(
    salesInCash.total || 0,
    theoreticalBalance,
    actualBalanceNum,
    discrepancy,
    justification ? justification.trim() : null,
    notes || null,
    id
  );

  logAudit(
    req.user!.id, req.user!.fullName, 'CLOSE_CASH_SESSION', 'cash_session', Number(id),
    `Clôture de caisse ID ${id}. Théorique: ${theoreticalBalance.toLocaleString('fr-FR')} GNF, Réel: ${actualBalanceNum.toLocaleString('fr-FR')} GNF, Écart: ${discrepancy.toLocaleString('fr-FR')} GNF`
  );

  res.json({
    message: 'Session de caisse clôturée avec succès.',
    report: {
      sessionId: Number(id),
      openingFloat: session.opening_float,
      totalSalesCash: salesInCash.total || 0,
      theoreticalBalance,
      actualBalance: actualBalanceNum,
      discrepancy,
      justification: justification || 'Aucun écart'
    }
  });
});

// DELETE /api/cash/sessions/:id (Suppression d'une session de caisse de l'historique)
router.delete('/sessions/:id', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const session = db.prepare('SELECT * FROM cash_sessions WHERE id = ?').get(id) as any;
  if (!session) {
    res.status(404).json({ error: 'Session de caisse introuvable.' });
    return;
  }

  const executeDelete = db.transaction(() => {
    // Unlink sales pointing to this cash session
    db.prepare('UPDATE sales SET cash_session_id = NULL WHERE cash_session_id = ?').run(id);
    db.prepare('DELETE FROM cash_sessions WHERE id = ?').run(id);

    logAudit(
      req.user!.id, req.user!.fullName, 'DELETE_CASH_SESSION', 'cash_session', Number(id),
      `Suppression de la session de caisse ID ${id} (${session.status}) de l'historique`
    );
  });

  try {
    executeDelete();
    res.json({ message: `Session de caisse #${id} supprimée de l'historique avec succès.` });
  } catch (err: any) {
    console.error('Erreur suppression session caisse:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la suppression de la session de caisse.' });
  }
});

// POST /api/cash/sessions/clear (Vider tout l'historique des sessions de caisse)
router.post('/sessions/clear', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const executeClear = db.transaction(() => {
    db.prepare('UPDATE sales SET cash_session_id = NULL WHERE cash_session_id IS NOT NULL').run();
    db.prepare('DELETE FROM cash_sessions').run();

    logAudit(
      req.user!.id, req.user!.fullName, 'CLEAR_CASH_SESSIONS', 'cash_session', null,
      'Purge complète de l\'historique des sessions de caisse'
    );
  });

  try {
    executeClear();
    res.json({ message: 'Historique des sessions de caisse vidé avec succès.' });
  } catch (err: any) {
    console.error('Erreur vidage sessions caisse:', err);
    res.status(500).json({ error: err.message || 'Erreur lors du vidage des sessions de caisse.' });
  }
});

export default router;
