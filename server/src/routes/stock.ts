import { Router, Response } from 'express';
import db, { logAudit } from '../database.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/stock/movements
router.get('/movements', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { product_id, movement_type, limit = 50 } = req.query;

  let query = `
    SELECT sm.*,
           p.name as product_name,
           p.code as product_code,
           u.full_name as user_name
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN users u ON sm.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (product_id) {
    query += ` AND sm.product_id = ?`;
    params.push(product_id);
  }

  if (movement_type) {
    query += ` AND sm.movement_type = ?`;
    params.push(movement_type);
  }

  query += ` ORDER BY sm.created_at DESC LIMIT ?`;
  params.push(Number(limit));

  const movements = db.prepare(query).all(...params);
  res.json(movements);
});

// POST /api/stock/receptions (Entrée de stock / Achat marchandise)
router.post('/receptions', authenticate, requireRole(['admin', 'manager', 'stock_manager']), (req: AuthenticatedRequest, res: Response) => {
  const {
    product_id, quantity, supplier_id, unit_cost, date,
    invoice_number, paid_amount, payment_mode, cash_register_id,
    reception_type = 'reception', reason, batch_number, expiry_date
  } = req.body;

  if (!product_id || !quantity || Number(quantity) <= 0) {
    res.status(400).json({ error: 'Le produit et une quantité positive sont requis.' });
    return;
  }

  const qty = Number(quantity);
  const cost = Number(unit_cost) || 0;
  const totalAmount = qty * cost;
  const paid = Number(paid_amount) || 0;
  const remaining = Math.max(0, totalAmount - paid);

  // Execute in atomic transaction
  const executeReception = db.transaction(() => {
    // 1. Fetch current product
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
    if (!product) {
      throw new Error('Produit introuvable.');
    }

    const previousQty = product.stock_quantity;
    const newQty = previousQty + qty;

    // 2. Update product stock and optionally expiry/batch
    db.prepare(`
      UPDATE products SET
        stock_quantity = ?,
        purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END,
        expiry_date = COALESCE(?, expiry_date),
        batch_number = COALESCE(?, batch_number),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newQty, cost, cost, expiry_date || null, batch_number || null, product_id);

    // 3. Generate purchase record if supplier provided or if standard purchase
    let purchaseId: number | null = null;
    if (supplier_id) {
      const purchaseNumber = `ACH-${Date.now().toString().slice(-6)}`;
      const pStmt = db.prepare(`
        INSERT INTO purchases (
          purchase_number, supplier_id, user_id, date, total_amount,
          paid_amount, remaining_amount, payment_mode, cash_register_id,
          invoice_number, status, notes
        ) VALUES (?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const pResult = pStmt.run(
        purchaseNumber, supplier_id, req.user!.id, date || null, totalAmount,
        paid, remaining, payment_mode || 'cash', cash_register_id || null,
        invoice_number || null, remaining === 0 ? 'completed' : (paid > 0 ? 'partial' : 'unpaid'),
        reason || 'Réception marchandise'
      );
      purchaseId = Number(pResult.lastInsertRowid);

      // Insert purchase item
      db.prepare(`
        INSERT INTO purchase_items (
          purchase_id, product_id, quantity, unit_cost, total_cost, batch_number, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(purchaseId, product_id, qty, cost, totalAmount, batch_number || null, expiry_date || null);

      // If money was paid from a cash register, record financial outflow
      if (paid > 0 && cash_register_id) {
        const register = db.prepare('SELECT balance FROM cash_registers WHERE id = ?').get(cash_register_id) as any;
        if (register) {
          db.prepare('UPDATE cash_registers SET balance = balance - ? WHERE id = ?').run(paid, cash_register_id);

          const finNum = `DEP-${Date.now().toString().slice(-6)}`;
          db.prepare(`
            INSERT INTO financial_movements (
              movement_number, type, is_inflow, cash_register_id, amount,
              category, description, reference_type, reference_id, user_id
            ) VALUES (?, 'purchase_expense', 0, ?, ?, 'Achat marchandises', ?, 'purchase', ?, ?)
          `).run(finNum, cash_register_id, paid, `Règlement achat ${product.name} (Facture ${invoice_number || 'N/A'})`, purchaseId, req.user!.id);
        }
      }
    }

    // 4. Record stock movement
    const validMovementTypes = ['reception', 'return_client', 'inventory_adjustment', 'transfer_in'];
    const movementType = validMovementTypes.includes(reception_type) ? reception_type : 'reception';

    db.prepare(`
      INSERT INTO stock_movements (
        product_id, movement_type, quantity, previous_quantity, new_quantity,
        unit_cost, reason, reference_type, reference_id, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'purchase', ?, ?)
    `).run(
      product_id, movementType, qty, previousQty, newQty, cost,
      reason || (movementType === 'return_client' ? 'Retour client' : 'Entrée de stock marchandise'),
      purchaseId, req.user!.id
    );

    logAudit(
      req.user!.id, req.user!.fullName, 'STOCK_INFLOW', 'stock', product_id,
      `Entrée de stock: +${qty} unités de ${product.name} (Ancien stock: ${previousQty}, Nouveau stock: ${newQty})`
    );

    return { newQty, totalAmount, remaining };
  });

  try {
    const result = executeReception();
    res.status(201).json({
      message: 'Entrée de stock enregistrée avec succès.',
      ...result
    });
  } catch (err: any) {
    console.error('Erreur entrée stock:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de l\'enregistrement de l\'entrée de stock.' });
  }
});

// POST /api/stock/outflows (Sortie de stock avec motif)
router.post('/outflows', authenticate, requireRole(['admin', 'manager', 'stock_manager']), (req: AuthenticatedRequest, res: Response) => {
  const { product_id, quantity, movement_type, reason, force_negative_stock } = req.body;

  if (!product_id || !quantity || Number(quantity) <= 0) {
    res.status(400).json({ error: 'Le produit et une quantité positive sont requis.' });
    return;
  }

  const allowedTypes = ['damaged', 'expired', 'loss_theft', 'internal_use', 'return_supplier', 'inventory_adjustment', 'transfer_out'];
  if (!allowedTypes.includes(movement_type)) {
    res.status(400).json({ error: 'Motif de sortie de stock invalide.' });
    return;
  }

  if (!reason || reason.trim() === '') {
    res.status(400).json({ error: 'La justification détaillée du motif est obligatoire.' });
    return;
  }

  const qty = Number(quantity);

  const executeOutflow = db.transaction(() => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
    if (!product) {
      throw new Error('Produit introuvable.');
    }

    if (product.stock_quantity < qty && (!force_negative_stock || req.user!.role !== 'admin')) {
      throw new Error(`Stock insuffisant. Stock disponible: ${product.stock_quantity}, quantité demandée: ${qty}. Seul un administrateur peut exceptionnellement forcer une correction.`);
    }

    const previousQty = product.stock_quantity;
    const newQty = previousQty - qty;

    db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, product_id);

    db.prepare(`
      INSERT INTO stock_movements (
        product_id, movement_type, quantity, previous_quantity, new_quantity,
        unit_cost, reason, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(product_id, movement_type, -qty, previousQty, newQty, product.purchase_price, reason.trim(), req.user!.id);

    logAudit(
      req.user!.id, req.user!.fullName, 'STOCK_OUTFLOW', 'stock', product_id,
      `Sortie de stock (${movement_type}): -${qty} unités de ${product.name}. Motif: ${reason.trim()}`
    );

    return { previousQty, newQty };
  });

  try {
    const result = executeOutflow();
    res.status(201).json({
      message: 'Sortie de stock enregistrée avec succès.',
      ...result
    });
  } catch (err: any) {
    console.error('Erreur sortie stock:', err);
    res.status(400).json({ error: err.message || 'Erreur lors de la sortie de stock.' });
  }
});

// DELETE /api/stock/movements/:id (Suppression d'un mouvement de l'historique)
router.delete('/movements/:id', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const movement = db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(id) as any;
  if (!movement) {
    res.status(404).json({ error: 'Mouvement de stock introuvable.' });
    return;
  }

  try {
    db.prepare('DELETE FROM stock_movements WHERE id = ?').run(id);

    logAudit(
      req.user!.id, req.user!.fullName, 'DELETE_STOCK_MOVEMENT', 'stock_movement', Number(id),
      `Suppression de la ligne de mouvement de stock ID ${id} (Produit ID: ${movement.product_id}, Quantité: ${movement.quantity})`
    );

    res.json({ message: 'Mouvement de stock supprimé de l\'historique avec succès.' });
  } catch (err: any) {
    console.error('Erreur suppression mouvement stock:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la suppression du mouvement de stock.' });
  }
});

// POST /api/stock/movements/clear (Vider tout l'historique des mouvements de stock)
router.post('/movements/clear', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    db.prepare('DELETE FROM stock_movements').run();

    logAudit(
      req.user!.id, req.user!.fullName, 'CLEAR_STOCK_MOVEMENTS', 'stock_movement', null,
      'Purge complète de l\'historique des mouvements de stock'
    );

    res.json({ message: 'Historique des mouvements de stock vidé avec succès.' });
  } catch (err: any) {
    console.error('Erreur vidage mouvements stock:', err);
    res.status(500).json({ error: err.message || 'Erreur lors du vidage des mouvements de stock.' });
  }
});

export default router;
