import { Router, Response } from 'express';
import db from '../database.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Chiffre d'affaires
    const todaySales = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(id) as count
      FROM sales
      WHERE status = 'completed' AND date(date) = date('now')
    `).get() as any;

    const weekSales = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(id) as count
      FROM sales
      WHERE status = 'completed' AND date >= date('now', '-7 days')
    `).get() as any;

    const monthSales = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(id) as count
      FROM sales
      WHERE status = 'completed' AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    `).get() as any;

    // 2. Bénéfice estimé sur les ventes
    const todayProfit = db.prepare(`
      SELECT COALESCE(SUM(si.profit), 0) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed' AND date(s.date) = date('now')
    `).get() as any;

    const monthProfit = db.prepare(`
      SELECT COALESCE(SUM(si.profit), 0) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed' AND strftime('%Y-%m', s.date) = strftime('%Y-%m', 'now')
    `).get() as any;

    // 3. Achats de marchandises
    const totalPurchases = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total, COALESCE(SUM(paid_amount), 0) as paid, COALESCE(SUM(remaining_amount), 0) as remaining
      FROM purchases
      WHERE status != 'cancelled'
    `).get() as any;

    // 4. Stock valuation and counts
    const stockStats = db.prepare(`
      SELECT
        COUNT(id) as total_products,
        COALESCE(SUM(stock_quantity * purchase_price), 0) as total_purchase_value,
        COALESCE(SUM(stock_quantity * sale_price), 0) as total_sale_value,
        COALESCE(SUM(CASE WHEN stock_quantity <= 0 THEN 1 ELSE 0 END), 0) as out_of_stock,
        COALESCE(SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= alert_threshold THEN 1 ELSE 0 END), 0) as low_stock
      FROM products
      WHERE is_archived = 0
    `).get() as any;

    // 5. Caisses et Mobile Money
    const cashRegisters = db.prepare(`
      SELECT id, name, type, balance, phone_number
      FROM cash_registers
      WHERE is_active = 1
      ORDER BY id ASC
    `).all() as any[];

    const totalCashAvailable = cashRegisters.reduce((sum, r) => sum + (r.balance || 0), 0);

    // 6. Dépôts et Retraits Mobile Money
    const transfersStats = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposits,
        COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as total_withdrawals,
        COALESCE(SUM(boutique_commission), 0) as total_commissions,
        COUNT(id) as total_transfers
      FROM money_transfers
      WHERE status = 'validated' AND date(created_at) = date('now')
    `).get() as any;

    // 7. Dépenses quotidiennes
    const todayExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM financial_movements
      WHERE is_inflow = 0 AND is_cancelled = 0 AND date(date) = date('now')
    `).get() as any;

    // 8. Ventes impayées et crédits clients
    const clientsCredit = db.prepare(`
      SELECT COALESCE(SUM(current_debt), 0) as total_debt, COUNT(id) as indebted_clients
      FROM clients
      WHERE current_debt > 0
    `).get() as any;

    // 9. Dernières opérations (Ventes, Dépôts/Retraits, Dépenses)
    const recentSales = db.prepare(`
      SELECT s.id, s.sale_number as reference, 'Vente' as type, s.total_amount as amount, s.date,
             u.full_name as user_name, s.payment_mode, s.status
      FROM sales s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.date DESC LIMIT 5
    `).all() as any[];

    const recentTransfers = db.prepare(`
      SELECT t.id, t.transfer_number as reference,
             CASE WHEN t.type = 'deposit' THEN 'Dépôt ' || t.service ELSE 'Retrait ' || t.service END as type,
             t.amount, t.created_at as date, u.full_name as user_name, t.service as payment_mode, t.status
      FROM money_transfers t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC LIMIT 5
    `).all() as any[];

    const recentExpenses = db.prepare(`
      SELECT f.id, f.movement_number as reference, f.category as type, f.amount, f.date,
             u.full_name as user_name, 'Dépense' as payment_mode, 'completed' as status
      FROM financial_movements f
      JOIN users u ON f.user_id = u.id
      WHERE f.is_inflow = 0 AND f.is_cancelled = 0
      ORDER BY f.date DESC LIMIT 5
    `).all() as any[];

    // 10. Graphique Ventes & Bénéfices sur les 14 derniers jours
    const chartSales = db.prepare(`
      WITH RECURSIVE dates(d) AS (
        SELECT date('now', '-13 days')
        UNION ALL
        SELECT date(d, '+1 day') FROM dates WHERE d < date('now')
      )
      SELECT
        d as date,
        COALESCE(SUM(s.total_amount), 0) as ventes,
        COALESCE(SUM(si.profit), 0) as benefices
      FROM dates
      LEFT JOIN sales s ON date(s.date) = dates.d AND s.status = 'completed'
      LEFT JOIN sale_items si ON si.sale_id = s.id
      GROUP BY d
      ORDER BY d ASC
    `).all() as any[];

    // 11. Top 5 produits les plus vendus
    const topProducts = db.prepare(`
      SELECT p.id, p.name, p.code, c.name as category,
             COALESCE(SUM(si.quantity), 0) as total_qty,
             COALESCE(SUM(si.total_price), 0) as total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed'
      GROUP BY p.id
      ORDER BY total_qty DESC
      LIMIT 5
    `).all() as any[];

    // 12. Dépenses par catégorie
    const expensesByCategory = db.prepare(`
      SELECT category, COALESCE(SUM(amount), 0) as total
      FROM financial_movements
      WHERE is_inflow = 0 AND is_cancelled = 0 AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
      GROUP BY category
      ORDER BY total DESC
    `).all() as any[];

    res.json({
      sales: {
        today: todaySales.total,
        todayCount: todaySales.count,
        week: weekSales.total,
        weekCount: weekSales.count,
        month: monthSales.total,
        monthCount: monthSales.count,
      },
      profits: {
        today: todayProfit.profit,
        month: monthProfit.profit,
      },
      purchases: {
        total: totalPurchases.total,
        paid: totalPurchases.paid,
        remainingDebt: totalPurchases.remaining,
      },
      stock: {
        totalProducts: stockStats.total_products,
        totalPurchaseValue: stockStats.total_purchase_value,
        totalSaleValue: stockStats.total_sale_value,
        outOfStockCount: stockStats.out_of_stock,
        lowStockCount: stockStats.low_stock,
      },
      cash: {
        registers: cashRegisters,
        totalAvailable: totalCashAvailable,
      },
      transfers: {
        todayDeposits: transfersStats.total_deposits,
        todayWithdrawals: transfersStats.total_withdrawals,
        todayCommissions: transfersStats.total_commissions,
        todayCount: transfersStats.total_transfers,
      },
      expenses: {
        today: todayExpenses.total,
        byCategory: expensesByCategory,
      },
      clientCredit: {
        totalDebt: clientsCredit.total_debt,
        indebtedClientsCount: clientsCredit.indebted_clients,
      },
      recentOperations: {
        sales: recentSales,
        transfers: recentTransfers,
        expenses: recentExpenses,
      },
      charts: {
        dailyTrends: chartSales,
        topProducts: topProducts,
        expensesByCategory: expensesByCategory,
      }
    });
  } catch (err: any) {
    console.error('Erreur dashboard:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des indicateurs du tableau de bord.' });
  }
});

export default router;
