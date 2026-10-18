import { Router, Response } from 'express';
import db from '../database.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/alerts (Toutes les alertes opérationnelles consolidées)
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Ruptures de stock (quantité <= 0)
    const outOfStock = db.prepare(`
      SELECT p.id, p.code, p.name, p.stock_quantity, c.name as category_name, s.company_name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.stock_quantity <= 0 AND p.is_archived = 0
      ORDER BY p.name ASC
    `).all();

    // 2. Stocks faibles (0 < quantité <= seuil d'alerte)
    const lowStock = db.prepare(`
      SELECT p.id, p.code, p.name, p.stock_quantity, p.alert_threshold, c.name as category_name, s.company_name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.stock_quantity > 0 AND p.stock_quantity <= p.alert_threshold AND p.is_archived = 0
      ORDER BY p.stock_quantity ASC
    `).all();

    // 3. Produits expirés
    const expired = db.prepare(`
      SELECT p.id, p.code, p.name, p.stock_quantity, p.expiry_date, p.batch_number, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.expiry_date IS NOT NULL AND date(p.expiry_date) < date('now') AND p.stock_quantity > 0 AND p.is_archived = 0
      ORDER BY p.expiry_date ASC
    `).all();

    // 4. Produits proches de la date d'expiration (dans les 60 jours)
    const expiringSoon = db.prepare(`
      SELECT p.id, p.code, p.name, p.stock_quantity, p.expiry_date, p.batch_number, c.name as category_name,
             CAST((julianday(p.expiry_date) - julianday('now')) AS INTEGER) as days_remaining
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.expiry_date IS NOT NULL
        AND date(p.expiry_date) >= date('now')
        AND date(p.expiry_date) <= date('now', '+60 days')
        AND p.stock_quantity > 0
        AND p.is_archived = 0
      ORDER BY p.expiry_date ASC
    `).all();

    // 5. Factures fournisseurs impayées
    const unpaidPurchases = db.prepare(`
      SELECT pch.id, pch.purchase_number, pch.date, pch.total_amount, pch.paid_amount, pch.remaining_amount,
             s.company_name as supplier_name, s.phone as supplier_phone
      FROM purchases pch
      JOIN suppliers s ON pch.supplier_id = s.id
      WHERE pch.remaining_amount > 0 AND pch.status != 'cancelled'
      ORDER BY pch.date ASC
    `).all();

    // 6. Dettes / Crédits clients en cours
    const clientDebts = db.prepare(`
      SELECT c.id, c.name, c.phone, c.current_debt, c.credit_limit
      FROM clients c
      WHERE c.current_debt > 0
      ORDER BY c.current_debt DESC
    `).all();

    // 7. Écarts de caisse enregistrés
    const cashDiscrepancies = db.prepare(`
      SELECT cs.id, cs.opening_time, cs.closing_time, cs.theoretical_balance, cs.actual_balance,
             cs.discrepancy, cs.justification, u.full_name as cashier_name, cr.name as register_name
      FROM cash_sessions cs
      JOIN users u ON cs.user_id = u.id
      JOIN cash_registers cr ON cs.cash_register_id = cr.id
      WHERE cs.status = 'closed' AND cs.discrepancy != 0
      ORDER BY cs.closing_time DESC LIMIT 10
    `).all();

    // Total alert count
    const totalCount = outOfStock.length + lowStock.length + expired.length + expiringSoon.length + unpaidPurchases.length + clientDebts.length;

    res.json({
      totalCount,
      outOfStock,
      lowStock,
      expired,
      expiringSoon,
      unpaidPurchases,
      clientDebts,
      cashDiscrepancies
    });
  } catch (err: any) {
    console.error('Erreur alertes:', err);
    res.status(500).json({ error: 'Erreur lors du calcul des alertes opérationnelles.' });
  }
});

export default router;
