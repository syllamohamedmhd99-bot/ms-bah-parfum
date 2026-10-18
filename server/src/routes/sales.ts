import { Router, Response } from 'express';
import db, { logAudit } from '../database.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/sales
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { date_start, date_end, status, client_id, limit = 50 } = req.query;

  let query = `
    SELECT s.*,
           c.name as client_name,
           c.phone as client_phone,
           u.full_name as cashier_name,
           cr.name as register_name
    FROM sales s
    LEFT JOIN clients c ON s.client_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN cash_registers cr ON s.cash_register_id = cr.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (date_start) {
    query += ` AND date(s.date) >= date(?)`;
    params.push(date_start);
  }

  if (date_end) {
    query += ` AND date(s.date) <= date(?)`;
    params.push(date_end);
  }

  if (status) {
    query += ` AND s.status = ?`;
    params.push(status);
  }

  if (client_id) {
    query += ` AND s.client_id = ?`;
    params.push(client_id);
  }

  query += ` ORDER BY s.date DESC LIMIT ?`;
  params.push(Number(limit));

  const sales = db.prepare(query).all(...params);
  res.json(sales);
});

// GET /api/sales/:id
router.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const sale = db.prepare(`
    SELECT s.*,
           c.name as client_name,
           c.phone as client_phone,
           u.full_name as cashier_name,
           cr.name as register_name,
           canceller.full_name as cancelled_by_name
    FROM sales s
    LEFT JOIN clients c ON s.client_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN cash_registers cr ON s.cash_register_id = cr.id
    LEFT JOIN users canceller ON s.cancelled_by = canceller.id
    WHERE s.id = ?
  `).get(id) as any;

  if (!sale) {
    res.status(404).json({ error: 'Vente introuvable.' });
    return;
  }

  const items = db.prepare(`
    SELECT si.*, p.name as product_name, p.code as product_code
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = ?
  `).all(id);

  res.json({ sale, items });
});

// POST /api/sales (Effectuer une vente au comptoir POS)
router.post('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const {
    items, // Array of { productId, quantity, unitPrice }
    client_id,
    payment_mode = 'cash', // 'cash', 'orange_money', 'mtn_momo', 'mixed', 'credit'
    discount = 0,
    amount_received = 0,
    cash_register_id,
    notes
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Le panier est vide. Veuillez ajouter au moins un produit.' });
    return;
  }

  const discountNum = Number(discount) || 0;
  const receivedNum = Number(amount_received) || 0;

  // Execute sale in an ACID atomic database transaction
  const executeSale = db.transaction(() => {
    let subtotal = 0;
    let totalProfit = 0;
    const validatedItems: any[] = [];

    // 1. Verify stocks & calculate totals
    for (const item of items) {
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId) as any;
      if (!prod) {
        throw new Error(`Le produit avec l'identifiant ${item.productId} n'existe pas.`);
      }

      const qty = Number(item.quantity) || 1;
      if (qty <= 0) {
        throw new Error(`Quantité invalide pour le produit ${prod.name}.`);
      }

      if (prod.stock_quantity < qty) {
        throw new Error(`Stock insuffisant pour "${prod.name}". Disponible: ${prod.stock_quantity}, demandé: ${qty}.`);
      }

      const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : prod.sale_price;
      const unitCost = prod.purchase_price;
      const itemTotal = qty * unitPrice;
      const itemProfit = (unitPrice - unitCost) * qty;

      subtotal += itemTotal;
      totalProfit += itemProfit;

      validatedItems.push({
        product: prod,
        quantity: qty,
        unitPrice,
        unitCost,
        itemTotal,
        itemProfit
      });
    }

    const totalAmount = Math.max(0, subtotal - discountNum);
    let changeReturned = 0;

    if (payment_mode !== 'credit') {
      if (receivedNum < totalAmount && payment_mode !== 'mixed') {
        throw new Error(`Le montant reçu (${receivedNum.toLocaleString('fr-FR')} GNF) est inférieur au montant total de la vente (${totalAmount.toLocaleString('fr-FR')} GNF).`);
      }
      changeReturned = Math.max(0, receivedNum - totalAmount);
    } else {
      // Credit sale requires a registered client
      if (!client_id) {
        throw new Error('Une vente à crédit nécessite impérativement d\'identifier le client.');
      }
    }

    // Determine target cash register
    let registerId = cash_register_id;
    if (!registerId) {
      if (payment_mode === 'orange_money') {
        const omReg = db.prepare("SELECT id FROM cash_registers WHERE type = 'orange_money' AND is_active = 1 LIMIT 1").get() as any;
        registerId = omReg ? omReg.id : 1;
      } else if (payment_mode === 'mtn_momo') {
        const momoReg = db.prepare("SELECT id FROM cash_registers WHERE type = 'mtn_momo' AND is_active = 1 LIMIT 1").get() as any;
        registerId = momoReg ? momoReg.id : 1;
      } else {
        const cashReg = db.prepare("SELECT id FROM cash_registers WHERE type = 'cash' AND is_active = 1 LIMIT 1").get() as any;
        registerId = cashReg ? cashReg.id : 1;
      }
    }

    // Check open cash session for current user
    const currentSession = db.prepare(`
      SELECT id FROM cash_sessions
      WHERE user_id = ? AND status = 'open'
      ORDER BY opening_time DESC LIMIT 1
    `).get(req.user!.id) as any;

    const sessionId = currentSession ? currentSession.id : null;

    // Generate unique sale number: VTE-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const saleNumber = `VTE-${dateStr}-${rand}`;

    // 2. Insert sale record
    const insertSaleStmt = db.prepare(`
      INSERT INTO sales (
        sale_number, client_id, user_id, cash_session_id, cash_register_id,
        subtotal, discount, total_amount, amount_received, change_returned,
        payment_mode, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
    `);

    const saleResult = insertSaleStmt.run(
      saleNumber, client_id || null, req.user!.id, sessionId, registerId,
      subtotal, discountNum, totalAmount, receivedNum, changeReturned,
      payment_mode, notes || null
    );

    const saleId = Number(saleResult.lastInsertRowid);

    // 3. Insert sale items, decrement product stock, record stock movement
    const insertItemStmt = db.prepare(`
      INSERT INTO sale_items (
        sale_id, product_id, quantity, unit_price, unit_cost, total_price, profit
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStockStmt = db.prepare(`
      UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const insertStockMvtStmt = db.prepare(`
      INSERT INTO stock_movements (
        product_id, movement_type, quantity, previous_quantity, new_quantity,
        unit_cost, reason, reference_type, reference_id, user_id
      ) VALUES (?, 'sale', ?, ?, ?, ?, 'Vente ticket ' || ?, 'sale', ?, ?)
    `);

    for (const item of validatedItems) {
      insertItemStmt.run(
        saleId, item.product.id, item.quantity, item.unitPrice,
        item.unitCost, item.itemTotal, item.itemProfit
      );

      const prevQty = item.product.stock_quantity;
      const newQty = prevQty - item.quantity;

      updateStockStmt.run(item.quantity, item.product.id);
      insertStockMvtStmt.run(
        item.product.id, -item.quantity, prevQty, newQty,
        item.unitCost, saleNumber, saleId, req.user!.id
      );
    }

    // 4. Update financial accounts
    if (payment_mode === 'credit') {
      // Increase client's current debt
      db.prepare('UPDATE clients SET current_debt = current_debt + ? WHERE id = ?').run(totalAmount, client_id);
    } else {
      // Increase cash register balance
      db.prepare('UPDATE cash_registers SET balance = balance + ? WHERE id = ?').run(totalAmount, registerId);

      // If session is open, track cash in
      if (sessionId) {
        db.prepare(`
          UPDATE cash_sessions SET
            total_cash_in = total_cash_in + ?,
            theoretical_balance = theoretical_balance + ?
          WHERE id = ?
        `).run(totalAmount, totalAmount, sessionId);
      }

      // Record financial inflow movement
      const finNumber = `ENC-${dateStr}-${rand}`;
      db.prepare(`
        INSERT INTO financial_movements (
          movement_number, type, is_inflow, cash_register_id, amount,
          category, description, reference_type, reference_id, user_id
        ) VALUES (?, 'sale_income', 1, ?, ?, 'Vente produits', ?, 'sale', ?, ?)
      `).run(finNumber, registerId, totalAmount, `Encaissement vente ticket ${saleNumber}`, saleId, req.user!.id);
    }

    logAudit(
      req.user!.id, req.user!.fullName, 'CREATE_SALE', 'sale', saleId,
      `Vente ${saleNumber} validée (${totalAmount.toLocaleString('fr-FR')} GNF, mode: ${payment_mode})`
    );

    return {
      saleId,
      saleNumber,
      totalAmount,
      subtotal,
      discount: discountNum,
      amountReceived: receivedNum,
      changeReturned,
      items: validatedItems
    };
  });

  try {
    const saleResult = executeSale();
    res.status(201).json({
      message: 'Vente validée avec succès.',
      ...saleResult
    });
  } catch (err: any) {
    console.error('Erreur vente:', err);
    res.status(400).json({ error: err.message || 'Erreur lors de la validation de la vente.' });
  }
});

// POST /api/sales/:id/cancel (Annulation traçable de vente avec droits)
router.post('/:id/cancel', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim() === '') {
    res.status(400).json({ error: 'Le motif d\'annulation est obligatoire.' });
    return;
  }

  const executeCancel = db.transaction(() => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as any;
    if (!sale) {
      throw new Error('Vente introuvable.');
    }

    if (sale.status === 'cancelled') {
      throw new Error('Cette vente a déjà été annulée.');
    }

    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id) as any[];

    // 1. Re-credit stock for all products
    for (const item of items) {
      const prod = db.prepare('SELECT stock_quantity, name FROM products WHERE id = ?').get(item.product_id) as any;
      if (prod) {
        const prevQty = prod.stock_quantity;
        const newQty = prevQty + item.quantity;
        db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, item.product_id);

        db.prepare(`
          INSERT INTO stock_movements (
            product_id, movement_type, quantity, previous_quantity, new_quantity,
            unit_cost, reason, reference_type, reference_id, user_id
          ) VALUES (?, 'return_client', ?, ?, ?, ?, 'Annulation vente ' || ?, 'sale_cancel', ?, ?)
        `).run(item.product_id, item.quantity, prevQty, newQty, item.unit_cost, sale.sale_number, sale.id, req.user!.id);
      }
    }

    // 2. Reverse financial transaction
    if (sale.payment_mode === 'credit') {
      if (sale.client_id) {
        db.prepare('UPDATE clients SET current_debt = MAX(0, current_debt - ?) WHERE id = ?').run(sale.total_amount, sale.client_id);
      }
    } else {
      if (sale.cash_register_id) {
        db.prepare('UPDATE cash_registers SET balance = balance - ? WHERE id = ?').run(sale.total_amount, sale.cash_register_id);
      }

      // Record counter-entry in financial movements
      const finNum = `ANN-${Date.now().toString().slice(-6)}`;
      db.prepare(`
        INSERT INTO financial_movements (
          movement_number, type, is_inflow, cash_register_id, amount,
          category, description, reference_type, reference_id, user_id
        ) VALUES (?, 'other_expense', 0, ?, ?, 'Annulation vente', ?, 'sale_cancel', ?, ?)
      `).run(finNum, sale.cash_register_id || 1, sale.total_amount, `Contrepassation suite annulation vente ${sale.sale_number}: ${reason.trim()}`, sale.id, req.user!.id);
    }

    // 3. Mark sale as cancelled (never delete!)
    db.prepare(`
      UPDATE sales SET
        status = 'cancelled',
        cancellation_reason = ?,
        cancelled_by = ?,
        cancelled_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reason.trim(), req.user!.id, id);

    logAudit(
      req.user!.id, req.user!.fullName, 'CANCEL_SALE', 'sale', Number(id),
      `Annulation de la vente ${sale.sale_number}. Montant: ${sale.total_amount} GNF. Motif: ${reason.trim()}`
    );

    return { saleNumber: sale.sale_number };
  });

  try {
    const result = executeCancel();
    res.json({ message: `Vente ${result.saleNumber} annulée avec succès et stocks réapprovisionnés.` });
  } catch (err: any) {
    console.error('Erreur annulation vente:', err);
    res.status(400).json({ error: err.message || 'Erreur lors de l\'annulation de la vente.' });
  }
});

// DELETE /api/sales/:id (Suppression d'une vente de l'historique)
router.delete('/:id', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as any;
  if (!sale) {
    res.status(404).json({ error: 'Vente introuvable.' });
    return;
  }

  const executeDelete = db.transaction(() => {
    db.prepare("DELETE FROM financial_movements WHERE reference_type IN ('sale', 'sale_cancel') AND reference_id = ?").run(id);
    db.prepare('DELETE FROM sales WHERE id = ?').run(id);

    logAudit(
      req.user!.id, req.user!.fullName, 'DELETE_SALE', 'sale', Number(id),
      `Suppression de la vente ${sale.sale_number} (${sale.total_amount} GNF) de l'historique`
    );
  });

  try {
    executeDelete();
    res.json({ message: `Vente ${sale.sale_number} supprimée de l'historique avec succès.` });
  } catch (err: any) {
    console.error('Erreur suppression vente:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la suppression de la vente.' });
  }
});

// POST /api/sales/clear-history (Vider tout l'historique des ventes)
router.post('/clear-history', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const executeClear = db.transaction(() => {
    db.prepare("DELETE FROM financial_movements WHERE reference_type IN ('sale', 'sale_cancel')").run();
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sales').run();

    logAudit(
      req.user!.id, req.user!.fullName, 'CLEAR_SALES_HISTORY', 'sales', null,
      "Purge complète de l'historique des ventes"
    );
  });

  try {
    executeClear();
    res.json({ message: "L'historique complet des ventes a été vidé avec succès." });
  } catch (err: any) {
    console.error('Erreur vidage ventes:', err);
    res.status(500).json({ error: err.message || 'Erreur lors du vidage des ventes.' });
  }
});

export default router;
