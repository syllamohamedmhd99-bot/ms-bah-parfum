import { Router, Response } from 'express';
import db, { logAudit } from '../database.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/inventory (Liste des sessions d'inventaire)
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const audits = db.prepare(`
    SELECT ia.*,
           u.full_name as auditor_name,
           (SELECT COUNT(iai.id) FROM inventory_audit_items iai WHERE iai.audit_id = ia.id) as total_items_checked,
           (SELECT COUNT(iai.id) FROM inventory_audit_items iai WHERE iai.audit_id = ia.id AND iai.discrepancy_qty != 0) as discrepancies_count
    FROM inventory_audits ia
    JOIN users u ON ia.user_id = u.id
    ORDER BY ia.date DESC
  `).all();
  res.json(audits);
});

// GET /api/inventory/:id (Détails d'un inventaire)
router.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const audit = db.prepare(`
    SELECT ia.*, u.full_name as auditor_name
    FROM inventory_audits ia
    JOIN users u ON ia.user_id = u.id
    WHERE ia.id = ?
  `).get(id);

  if (!audit) {
    res.status(404).json({ error: 'Inventaire introuvable.' });
    return;
  }

  const items = db.prepare(`
    SELECT iai.*,
           p.name as product_name,
           p.code as product_code,
           c.name as category_name
    FROM inventory_audit_items iai
    JOIN products p ON iai.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE iai.audit_id = ?
  `).all(id);

  res.json({ audit, items });
});

// POST /api/inventory (Enregistrer un comptage d'inventaire physique)
router.post('/', authenticate, requireRole(['admin', 'manager', 'stock_manager']), (req: AuthenticatedRequest, res: Response) => {
  const {
    items, // Array of { productId, theoreticalQty, actualQty, justification }
    notes
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Aucun article soumis pour l\'inventaire.' });
    return;
  }

  const executeInventory = db.transaction(() => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const auditNumber = `INV-${dateStr}-${rand}`;

    // 1. Create inventory audit
    const stmt = db.prepare(`
      INSERT INTO inventory_audits (audit_number, user_id, date, status, notes)
      VALUES (?, ?, CURRENT_TIMESTAMP, 'completed', ?)
    `);
    const result = stmt.run(auditNumber, req.user!.id, notes || null);
    const auditId = Number(result.lastInsertRowid);

    const insertItemStmt = db.prepare(`
      INSERT INTO inventory_audit_items (
        audit_id, product_id, theoretical_qty, actual_qty, discrepancy_qty, justification
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateProductStmt = db.prepare(`
      UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);

    const insertStockMvtStmt = db.prepare(`
      INSERT INTO stock_movements (
        product_id, movement_type, quantity, previous_quantity, new_quantity,
        unit_cost, reason, reference_type, reference_id, user_id
      ) VALUES (?, 'inventory_adjustment', ?, ?, ?, ?, ?, 'inventory_audit', ?, ?)
    `);

    let discrepanciesFound = 0;

    for (const item of items) {
      const prod = db.prepare('SELECT stock_quantity, purchase_price, name FROM products WHERE id = ?').get(item.productId) as any;
      if (!prod) continue;

      const theoQty = prod.stock_quantity;
      const actQty = Number(item.actualQty);
      const discrepancy = actQty - theoQty;

      insertItemStmt.run(auditId, item.productId, theoQty, actQty, discrepancy, item.justification || null);

      if (discrepancy !== 0) {
        discrepanciesFound++;
        // Update product stock to actual counted quantity
        updateProductStmt.run(actQty, item.productId);

        // Record stock movement adjustment
        const reasonText = `Ajustement inventaire ${auditNumber}: ${item.justification || (discrepancy > 0 ? 'Surplus constaté' : 'Perte/écart constaté')}`;
        insertStockMvtStmt.run(
          item.productId, discrepancy, theoQty, actQty,
          prod.purchase_price, reasonText, auditId, req.user!.id
        );
      }
    }

    logAudit(
      req.user!.id, req.user!.fullName, 'INVENTORY_AUDIT', 'inventory_audit', auditId,
      `Clôture inventaire ${auditNumber}. ${items.length} articles vérifiés, ${discrepanciesFound} écarts ajustés.`
    );

    return { auditId, auditNumber, discrepanciesFound };
  });

  try {
    const result = executeInventory();
    res.status(201).json({
      message: `Inventaire ${result.auditNumber} enregistré avec succès (${result.discrepanciesFound} écarts ajustés).`,
      ...result
    });
  } catch (err: any) {
    console.error('Erreur inventaire:', err);
    res.status(400).json({ error: err.message || 'Erreur lors de l\'enregistrement de l\'inventaire.' });
  }
});

export default router;
