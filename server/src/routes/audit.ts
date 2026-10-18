import { Router, Response } from 'express';
import db from '../database.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/audit (Journal d'audit immuable - Admin/Gérant)
router.get('/', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { action, entity_type, limit = 100 } = req.query;

  let query = `
    SELECT * FROM audit_logs
    WHERE 1=1
  `;
  const params: any[] = [];

  if (action) {
    query += ` AND action = ?`;
    params.push(action);
  }

  if (entity_type) {
    query += ` AND entity_type = ?`;
    params.push(entity_type);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(Number(limit));

  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

// DELETE /api/audit/:id (Suppression d'une ligne d'audit - Admin)
router.delete('/:id', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = db.prepare('DELETE FROM audit_logs WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Ligne d\'audit introuvable.' });
      return;
    }
    res.json({ message: 'Ligne d\'audit supprimée avec succès.' });
  } catch (err: any) {
    console.error('Erreur suppression audit:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la suppression de la ligne d\'audit.' });
  }
});

// POST /api/audit/clear (Vider tout le journal d'audit - Admin)
router.post('/clear', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    db.prepare('DELETE FROM audit_logs').run();
    res.json({ message: 'Journal d\'audit vidé avec succès.' });
  } catch (err: any) {
    console.error('Erreur vidage audit:', err);
    res.status(500).json({ error: err.message || 'Erreur lors du vidage du journal d\'audit.' });
  }
});

export default router;
