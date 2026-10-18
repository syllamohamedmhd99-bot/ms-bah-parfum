import { Router, Response } from 'express';
import db from '../database.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/reports/comprehensive (Rapport global avec filtres temporels)
router.get('/comprehensive', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { period = 'month', date_start, date_end } = req.query;

  let dateFilter = "";
  const params: any[] = [];

  if (date_start && date_end) {
    dateFilter = "BETWEEN date(?) AND date(?)";
    params.push(date_start, date_end);
  } else if (period === 'today') {
    dateFilter = "= date('now')";
  } else if (period === 'week') {
    dateFilter = ">= date('now', '-7 days')";
  } else if (period === 'year') {
    dateFilter = ">= date('now', 'start of year')";
  } else {
    // Default: this month
    dateFilter = ">= date('now', 'start of month')";
  }

  try {
    // 1. Rapport des Ventes & Bénéfices
    const salesReport = db.prepare(`
      SELECT
        COUNT(s.id) as total_sales_count,
        COALESCE(SUM(s.subtotal), 0) as total_subtotal,
        COALESCE(SUM(s.discount), 0) as total_discounts,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM(si.profit), 0) as estimated_profit,
        COALESCE(SUM(CASE WHEN s.payment_mode = 'cash' THEN s.total_amount ELSE 0 END), 0) as sales_cash,
        COALESCE(SUM(CASE WHEN s.payment_mode = 'orange_money' THEN s.total_amount ELSE 0 END), 0) as sales_orange_money,
        COALESCE(SUM(CASE WHEN s.payment_mode = 'mtn_momo' THEN s.total_amount ELSE 0 END), 0) as sales_mtn_momo,
        COALESCE(SUM(CASE WHEN s.payment_mode = 'credit' THEN s.total_amount ELSE 0 END), 0) as sales_credit
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status = 'completed' AND date(s.date) ${dateFilter}
    `).get(...params) as any;

    // 2. Rapport des Achats
    const purchasesReport = db.prepare(`
      SELECT
        COUNT(id) as total_purchases_count,
        COALESCE(SUM(total_amount), 0) as total_purchased,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(remaining_amount), 0) as total_remaining
      FROM purchases
      WHERE status != 'cancelled' AND date(date) ${dateFilter}
    `).get(...params) as any;

    // 3. Rapport des Dépenses par catégorie
    const expensesReport = db.prepare(`
      SELECT
        category,
        COUNT(id) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM financial_movements
      WHERE is_inflow = 0 AND is_cancelled = 0 AND date(date) ${dateFilter}
      GROUP BY category
      ORDER BY total_amount DESC
    `).all(...params) as any[];

    const totalExpenses = expensesReport.reduce((acc, curr) => acc + curr.total_amount, 0);

    // 4. Rapport Dépôts et Retraits Mobile Money + Commissions
    const transfersReport = db.prepare(`
      SELECT
        service,
        type,
        COUNT(id) as count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(boutique_commission), 0) as total_commission
      FROM money_transfers
      WHERE status = 'validated' AND date(created_at) ${dateFilter}
      GROUP BY service, type
    `).all(...params) as any[];

    const totalCommissionsEarned = transfersReport.reduce((acc, curr) => acc + curr.total_commission, 0);

    // 5. Mouvements de stock sur la période
    const stockMovementsReport = db.prepare(`
      SELECT
        movement_type,
        COUNT(id) as count,
        COALESCE(SUM(ABS(quantity)), 0) as total_units
      FROM stock_movements
      WHERE date(created_at) ${dateFilter}
      GROUP BY movement_type
    `).all(...params) as any[];

    // 6. Top 10 produits les plus vendus sur la période
    const topProducts = db.prepare(`
      SELECT
        p.id, p.name, p.code, c.name as category_name,
        COALESCE(SUM(si.quantity), 0) as units_sold,
        COALESCE(SUM(si.total_price), 0) as total_revenue,
        COALESCE(SUM(si.profit), 0) as total_profit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed' AND date(s.date) ${dateFilter}
      GROUP BY p.id
      ORDER BY units_sold DESC
      LIMIT 10
    `).all(...params) as any[];

    // 7. Soldes actuels des caisses et portefeuilles
    const registerBalances = db.prepare(`
      SELECT id, name, type, balance, phone_number
      FROM cash_registers
      WHERE is_active = 1
    `).all() as any[];

    // 8. Dettes clients & Dettes fournisseurs actuelles
    const debtsSummary = db.prepare(`
      SELECT
        (SELECT COALESCE(SUM(current_debt), 0) FROM clients WHERE current_debt > 0) as total_client_debt,
        (SELECT COUNT(id) FROM clients WHERE current_debt > 0) as client_debtors_count,
        (SELECT COALESCE(SUM(remaining_amount), 0) FROM purchases WHERE remaining_amount > 0 AND status != 'cancelled') as total_supplier_debt,
        (SELECT COUNT(DISTINCT supplier_id) FROM purchases WHERE remaining_amount > 0 AND status != 'cancelled') as supplier_creditors_count
    `).get() as any;

    // 9. Écarts de caisse sur la période
    const cashDiscrepancies = db.prepare(`
      SELECT cs.id, cs.opening_time, cs.closing_time, cs.theoretical_balance,
             cs.actual_balance, cs.discrepancy, cs.justification,
             u.full_name as cashier_name, cr.name as register_name
      FROM cash_sessions cs
      JOIN users u ON cs.user_id = u.id
      JOIN cash_registers cr ON cs.cash_register_id = cr.id
      WHERE cs.status = 'closed' AND cs.discrepancy != 0 AND date(cs.closing_time) ${dateFilter}
      ORDER BY cs.closing_time DESC
    `).all(...params) as any[];

    // Bénéfice Net Global Estimé = Bénéfice sur Ventes + Commissions Mobile Money - Dépenses
    const estimatedNetProfit = (salesReport.estimated_profit || 0) + totalCommissionsEarned - totalExpenses;

    res.json({
      period,
      sales: salesReport,
      purchases: purchasesReport,
      expenses: {
        total: totalExpenses,
        breakdown: expensesReport
      },
      transfers: {
        totalCommissions: totalCommissionsEarned,
        breakdown: transfersReport
      },
      stockMovements: stockMovementsReport,
      topProducts,
      registerBalances,
      debtsSummary,
      cashDiscrepancies,
      estimatedNetProfit
    });
  } catch (err: any) {
    console.error('Erreur rapport:', err);
    res.status(500).json({ error: 'Erreur lors de la génération du rapport.' });
  }
});

export default router;
