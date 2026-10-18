import { Router, Response } from 'express';
import db, { logAudit } from '../database.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/suppliers
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { search } = req.query;

  let query = `
    SELECT s.*,
           (SELECT COUNT(p.id) FROM products p WHERE p.supplier_id = s.id AND p.is_archived = 0) as product_count,
           (SELECT COALESCE(SUM(pch.total_amount), 0) FROM purchases pch WHERE pch.supplier_id = s.id AND pch.status != 'cancelled') as total_purchased,
           (SELECT COALESCE(SUM(pch.remaining_amount), 0) FROM purchases pch WHERE pch.supplier_id = s.id AND pch.status != 'cancelled') as total_unpaid_debt
    FROM suppliers s
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search && typeof search === 'string') {
    query += ` AND (LOWER(s.name) LIKE ? OR LOWER(s.company_name) LIKE ? OR LOWER(s.phone) LIKE ?)`;
    const searchVal = `%${search.toLowerCase().trim()}%`;
    params.push(searchVal, searchVal, searchVal);
  }

  query += ` ORDER BY s.company_name ASC`;
  const suppliers = db.prepare(query).all(...params);
  res.json(suppliers);
});

// GET /api/suppliers/:id/history
router.get('/:id/history', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  if (!supplier) {
    res.status(404).json({ error: 'Fournisseur introuvable.' });
    return;
  }

  const products = db.prepare('SELECT * FROM products WHERE supplier_id = ? AND is_archived = 0').all(id);

  const purchases = db.prepare(`
    SELECT p.*, u.full_name as user_name
    FROM purchases p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.supplier_id = ?
    ORDER BY p.date DESC
  `).all(id);

  const debtPayments = db.prepare(`
    SELECT fm.*, u.full_name as user_name
    FROM financial_movements fm
    LEFT JOIN users u ON fm.user_id = u.id
    WHERE fm.reference_type = 'supplier_debt_payment' AND fm.reference_id = ?
    ORDER BY fm.date DESC
  `).all(id);

  res.json({ supplier, products, purchases, debtPayments });
});

// POST /api/suppliers
router.post('/', authenticate, requireRole(['admin', 'manager', 'stock_manager']), (req: AuthenticatedRequest, res: Response) => {
  const { name, company_name, phone, email, address, notes } = req.body;
  if (!company_name || company_name.trim() === '') {
    res.status(400).json({ error: 'Le nom de l\'entreprise ou du fournisseur est obligatoire.' });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO suppliers (name, company_name, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(name ? name.trim() : company_name.trim(), company_name.trim(), phone || null, email || null, address || null, notes || null);
  const supplierId = Number(result.lastInsertRowid);

  logAudit(req.user!.id, req.user!.fullName, 'CREATE_SUPPLIER', 'supplier', supplierId, `Création du fournisseur ${company_name.trim()}`);
  res.status(201).json({ id: supplierId, message: 'Fournisseur créé avec succès.' });
});

// PUT /api/suppliers/:id
router.put('/:id', authenticate, requireRole(['admin', 'manager', 'stock_manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, company_name, phone, email, address, notes } = req.body;

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
  if (!supplier) {
    res.status(404).json({ error: 'Fournisseur introuvable.' });
    return;
  }

  db.prepare(`
    UPDATE suppliers SET name = ?, company_name = ?, phone = ?, email = ?, address = ?, notes = ?
    WHERE id = ?
  `).run(name ? name.trim() : supplier.name, company_name ? company_name.trim() : supplier.company_name, phone ?? supplier.phone, email ?? supplier.email, address ?? supplier.address, notes ?? supplier.notes, id);

  logAudit(req.user!.id, req.user!.fullName, 'UPDATE_SUPPLIER', 'supplier', Number(id), `Modification du fournisseur ${company_name || supplier.company_name}`);
  res.json({ message: 'Fournisseur mis à jour avec succès.' });
});

// POST /api/suppliers/:id/pay-debt (Règlement de facture fournisseur)
router.post('/:id/pay-debt', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { amount, cash_register_id = 1, notes } = req.body;

  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'Un montant de règlement valide est obligatoire.' });
    return;
  }

  const amtNum = Number(amount);

  const executePayment = db.transaction(() => {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
    if (!supplier) {
      throw new Error('Fournisseur introuvable.');
    }

    const register = db.prepare('SELECT * FROM cash_registers WHERE id = ?').get(cash_register_id) as any;
    if (!register) {
      throw new Error('Caisse sélectionnée introuvable.');
    }

    if (register.balance < amtNum) {
      throw new Error(`Solde insuffisant dans la caisse ${register.name} (${register.balance.toLocaleString('fr-FR')} GNF). Montant à régler: ${amtNum.toLocaleString('fr-FR')} GNF.`);
    }

    // Find unpaid purchases for this supplier
    const unpaidPurchases = db.prepare(`
      SELECT * FROM purchases
      WHERE supplier_id = ? AND remaining_amount > 0 AND status != 'cancelled'
      ORDER BY date ASC
    `).all(id) as any[];

    let remainingToPay = amtNum;

    for (const p of unpaidPurchases) {
      if (remainingToPay <= 0) break;
      const deduction = Math.min(remainingToPay, p.remaining_amount);
      const newPaid = p.paid_amount + deduction;
      const newRemaining = p.remaining_amount - deduction;
      const newStatus = newRemaining === 0 ? 'completed' : 'partial';

      db.prepare(`
        UPDATE purchases SET paid_amount = ?, remaining_amount = ?, status = ? WHERE id = ?
      `).run(newPaid, newRemaining, newStatus, p.id);

      remainingToPay -= deduction;
    }

    // Decrement cash register balance
    db.prepare('UPDATE cash_registers SET balance = balance - ? WHERE id = ?').run(amtNum, cash_register_id);

    // Record financial expense movement
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const movementNumber = `DEP-FRN-${dateStr}-${rand}`;

    db.prepare(`
      INSERT INTO financial_movements (
        movement_number, type, is_inflow, cash_register_id, amount,
        category, description, reference_type, reference_id, user_id
      ) VALUES (?, 'supplier_payment', 0, ?, ?, 'Règlement fournisseur', ?, 'supplier_debt_payment', ?, ?)
    `).run(
      movementNumber, cash_register_id, amtNum,
      `Règlement facture fournisseur ${supplier.company_name} (${amtNum.toLocaleString('fr-FR')} GNF). ${notes || ''}`,
      id, req.user!.id
    );

    logAudit(
      req.user!.id, req.user!.fullName, 'PAY_SUPPLIER_DEBT', 'supplier', Number(id),
      `Règlement de ${amtNum.toLocaleString('fr-FR')} GNF au fournisseur ${supplier.company_name} depuis ${register.name}.`
    );

    return { paidAmount: amtNum };
  });

  try {
    const result = executePayment();
    res.json({
      message: `Règlement de ${result.paidAmount.toLocaleString('fr-FR')} GNF au fournisseur enregistré avec succès.`,
      ...result
    });
  } catch (err: any) {
    console.error('Erreur règlement fournisseur:', err);
    res.status(400).json({ error: err.message || 'Erreur lors du règlement fournisseur.' });
  }
});

// DELETE /api/suppliers/:id (Suppression d'un fournisseur)
router.delete('/:id', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
  if (!supplier) {
    res.status(404).json({ error: 'Fournisseur introuvable.' });
    return;
  }

  // Check if supplier has purchases / invoices
  const purchaseCount = (db.prepare('SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?').get(id) as any)?.count || 0;
  if (purchaseCount > 0) {
    res.status(400).json({
      error: `Impossible de supprimer "${supplier.company_name}" car il est associé à ${purchaseCount} commande(s) ou facture(s) d'achat enregistrée(s).`
    });
    return;
  }

  db.transaction(() => {
    // Unlink products that pointed to this supplier (set supplier_id to NULL)
    db.prepare('UPDATE products SET supplier_id = NULL WHERE supplier_id = ?').run(id);
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
  })();

  logAudit(req.user!.id, req.user!.fullName, 'DELETE_SUPPLIER', 'supplier', Number(id), `Suppression du fournisseur: ${supplier.company_name}`);
  res.json({ message: `Fournisseur "${supplier.company_name}" supprimé avec succès.` });
});

export default router;
