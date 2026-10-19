import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import dbAdapter, { isNeonActive } from '../db/index.js';
import db, { logAudit } from '../database.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { parseExcelWorkbook, executeImportTransaction, cleanCategoryName } from '../services/excelImport.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const router = Router();

// GET /api/products
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { search, category_id, status, is_archived } = req.query;

  try {
    if (isNeonActive()) {
      let query = `
        SELECT p.*,
               c.name as category_name,
               s.company_name as supplier_name,
               (p.stock_quantity * p.purchase_price) as total_purchase_value,
               (p.stock_quantity * p.sale_price) as total_sale_value
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIdx = 1;

      if (is_archived === 'true') {
        query += ` AND p.is_archived = 1`;
      } else {
        query += ` AND (p.is_archived = 0 OR p.is_archived IS NULL)`;
      }

      if (category_id) {
        query += ` AND p.category_id = $${paramIdx++}`;
        params.push(category_id);
      }

      if (search && typeof search === 'string') {
        query += ` AND (LOWER(p.name) LIKE $${paramIdx} OR LOWER(p.code) LIKE $${paramIdx} OR LOWER(p.brand) LIKE $${paramIdx})`;
        paramIdx++;
        const searchVal = `%${search.toLowerCase().trim()}%`;
        params.push(searchVal);
      }

      if (status === 'out_of_stock') {
        query += ` AND p.stock_quantity <= 0`;
      } else if (status === 'low_stock') {
        query += ` AND p.stock_quantity > 0 AND p.stock_quantity <= p.alert_threshold`;
      } else if (status === 'expiring_soon') {
        query += ` AND p.expiry_date IS NOT NULL AND p.expiry_date <= (CURRENT_DATE + INTERVAL '60 days')`;
      } else if (status === 'needs_completion') {
        query += ` AND (p.needs_completion = 1 OR p.sale_price <= 0)`;
      }

      query += ` ORDER BY p.name ASC`;

      const products = await dbAdapter.query(query, params);
      return res.json(products);
    }
  } catch (pgErr) {
    console.warn('[PRODUCTS] Erreur requête Neon, repli sur SQLite:', pgErr);
  }

  let query = `
    SELECT p.*,
           c.name as category_name,
           s.company_name as supplier_name,
           (p.stock_quantity * p.purchase_price) as total_purchase_value,
           (p.stock_quantity * p.sale_price) as total_sale_value
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (is_archived === 'true') {
    query += ` AND p.is_archived = 1`;
  } else {
    query += ` AND (p.is_archived = 0 OR p.is_archived IS NULL)`;
  }

  if (category_id) {
    query += ` AND p.category_id = ?`;
    params.push(category_id);
  }

  if (search && typeof search === 'string') {
    query += ` AND (LOWER(p.name) LIKE ? OR LOWER(p.code) LIKE ? OR LOWER(p.brand) LIKE ?)`;
    const searchVal = `%${search.toLowerCase().trim()}%`;
    params.push(searchVal, searchVal, searchVal);
  }

  if (status === 'out_of_stock') {
    query += ` AND p.stock_quantity <= 0`;
  } else if (status === 'low_stock') {
    query += ` AND p.stock_quantity > 0 AND p.stock_quantity <= p.alert_threshold`;
  } else if (status === 'expiring_soon') {
    // Expiring within 60 days
    query += ` AND p.expiry_date IS NOT NULL AND date(p.expiry_date) <= date('now', '+60 days')`;
  } else if (status === 'needs_completion') {
    query += ` AND (p.needs_completion = 1 OR p.sale_price <= 0)`;
  }

  query += ` ORDER BY p.name ASC`;

  const products = db.prepare(query).all(...params);
  res.json(products);
});

// GET /api/products/:id
router.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, s.company_name as supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.id = ?
  `).get(id);

  if (!product) {
    res.status(404).json({ error: 'Produit introuvable.' });
    return;
  }

  const movements = db.prepare(`
    SELECT sm.*, u.full_name as user_name
    FROM stock_movements sm
    LEFT JOIN users u ON sm.user_id = u.id
    WHERE sm.product_id = ?
    ORDER BY sm.created_at DESC LIMIT 30
  `).all(id);

  res.json({ product, movements });
});

// POST /api/products
router.post('/', authenticate, requireRole(['admin', 'manager', 'stock_manager']), (req: AuthenticatedRequest, res: Response) => {
  const {
    code, name, category_id, brand, description, supplier_id,
    purchase_price, sale_price, stock_quantity, alert_threshold,
    expiry_date, batch_number, image_url
  } = req.body;

  if (!code || !name) {
    res.status(400).json({ error: 'Le code référence et le nom du produit sont obligatoires.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM products WHERE LOWER(code) = LOWER(?)').get(code.trim());
  if (existing) {
    res.status(400).json({ error: 'Un produit avec cette référence ou code-barres existe déjà.' });
    return;
  }

  const purchasePriceNum = Number(purchase_price) || 0;
  const salePriceNum = Number(sale_price) || 0;
  const stockQtyNum = Number(stock_quantity) || 0;
  const alertThresholdNum = alert_threshold !== undefined ? Number(alert_threshold) : 5;

  const stmt = db.prepare(`
    INSERT INTO products (
      code, name, category_id, brand, description, supplier_id,
      purchase_price, sale_price, stock_quantity, alert_threshold,
      expiry_date, batch_number, image_url, is_archived
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const result = stmt.run(
    code.trim(), name.trim(), category_id || null, brand || null,
    description || null, supplier_id || null, purchasePriceNum,
    salePriceNum, stockQtyNum, alertThresholdNum,
    expiry_date || null, batch_number || null, image_url || null
  );

  const newId = Number(result.lastInsertRowid);

  // If initial stock > 0, log a stock movement
  if (stockQtyNum > 0) {
    db.prepare(`
      INSERT INTO stock_movements (
        product_id, movement_type, quantity, previous_quantity, new_quantity,
        unit_cost, reason, user_id
      ) VALUES (?, 'reception', ?, 0, ?, ?, 'Stock initial lors de la création du produit', ?)
    `).run(newId, stockQtyNum, stockQtyNum, purchasePriceNum, req.user!.id);
  }

  logAudit(req.user!.id, req.user!.fullName, 'CREATE_PRODUCT', 'product', newId, `Création du produit ${name.trim()} (Code: ${code.trim()}, Stock: ${stockQtyNum})`);
  res.status(201).json({ id: newId, message: 'Produit créé avec succès.' });
});

// PUT /api/products/:id
router.put('/:id', authenticate, requireRole(['admin', 'manager', 'stock_manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const {
    code, name, category_id, brand, description, supplier_id,
    purchase_price, sale_price, alert_threshold,
    expiry_date, batch_number, image_url
  } = req.body;

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  if (!product) {
    res.status(404).json({ error: 'Produit introuvable.' });
    return;
  }

  if (code && code.trim().toLowerCase() !== product.code.toLowerCase()) {
    const existing = db.prepare('SELECT id FROM products WHERE LOWER(code) = LOWER(?) AND id != ?').get(code.trim(), id);
    if (existing) {
      res.status(400).json({ error: 'Ce code produit ou référence existe déjà.' });
      return;
    }
  }

  db.prepare(`
    UPDATE products SET
      code = ?, name = ?, category_id = ?, brand = ?, description = ?,
      supplier_id = ?, purchase_price = ?, sale_price = ?, alert_threshold = ?,
      expiry_date = ?, batch_number = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    code ? code.trim() : product.code,
    name ? name.trim() : product.name,
    category_id !== undefined ? category_id : product.category_id,
    brand !== undefined ? brand : product.brand,
    description !== undefined ? description : product.description,
    supplier_id !== undefined ? supplier_id : product.supplier_id,
    purchase_price !== undefined ? Number(purchase_price) : product.purchase_price,
    sale_price !== undefined ? Number(sale_price) : product.sale_price,
    alert_threshold !== undefined ? Number(alert_threshold) : product.alert_threshold,
    expiry_date !== undefined ? expiry_date : product.expiry_date,
    batch_number !== undefined ? batch_number : product.batch_number,
    image_url !== undefined ? image_url : product.image_url,
    id
  );

  logAudit(req.user!.id, req.user!.fullName, 'UPDATE_PRODUCT', 'product', Number(id), `Mise à jour du produit ${name || product.name}`);
  res.json({ message: 'Produit mis à jour avec succès.' });
});

// PATCH /api/products/:id/archive
router.patch('/:id/archive', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  if (!product) {
    res.status(404).json({ error: 'Produit introuvable.' });
    return;
  }

  const newStatus = product.is_archived === 1 ? 0 : 1;
  db.prepare('UPDATE products SET is_archived = ? WHERE id = ?').run(newStatus, id);

  const actionText = newStatus === 1 ? 'Archivage' : 'Désarchivage';
  logAudit(req.user!.id, req.user!.fullName, 'ARCHIVE_PRODUCT', 'product', Number(id), `${actionText} du produit ${product.name}`);
  res.json({ message: `Produit ${newStatus === 1 ? 'archivé' : 'restauré'} avec succès.` });
});

// DELETE /api/products/:id (Suppression définitive d'un article)
router.delete('/:id', authenticate, requireRole(['admin', 'manager', 'stock_manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  if (!product) {
    res.status(404).json({ error: 'Produit introuvable.' });
    return;
  }

  // Check if product was used in sales
  const salesCount = (db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?').get(id) as any)?.count || 0;
  if (salesCount > 0) {
    res.status(400).json({
      error: `Impossible de supprimer définitivement "${product.name}" car il figure sur ${salesCount} ticket(s) de vente. Vous pouvez l'archiver pour le masquer du catalogue.`
    });
    return;
  }

  // Check if product was used in supplier purchases
  const purchasesCount = (db.prepare('SELECT COUNT(*) as count FROM purchase_items WHERE product_id = ?').get(id) as any)?.count || 0;
  if (purchasesCount > 0) {
    res.status(400).json({
      error: `Impossible de supprimer définitivement "${product.name}" car il figure sur ${purchasesCount} facture(s) d'achat. Vous pouvez l'archiver à la place.`
    });
    return;
  }

  // Delete initial/unlinked stock movements & inventory audit items for this product
  db.transaction(() => {
    db.prepare('DELETE FROM stock_movements WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM inventory_audit_items WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  })();

  logAudit(req.user!.id, req.user!.fullName, 'DELETE_PRODUCT', 'product', Number(id), `Suppression définitive du produit: ${product.name} (Code: ${product.code})`);
  res.json({ message: `Produit "${product.name}" supprimé avec succès.` });
});

// GET /api/products/import-excel/default-file
// Détecte automatiquement la présence du fichier "(Récupération automatique).xlsx" sur le poste
router.get('/import-excel/default-file', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const homeDir = process.env.USERPROFILE || 'C:\\Users\\HP';
  const candidates = [
    path.join(homeDir, 'Documents', '(Récupération automatique).xlsx'),
    path.join(homeDir, 'Documents', 'Récupération automatique.xlsx'),
    path.join(homeDir, 'Downloads', '(Récupération automatique).xlsx'),
    path.join(homeDir, 'Downloads', 'Récupération automatique.xlsx'),
    path.join(homeDir, 'Desktop', '(Récupération automatique).xlsx'),
    path.join(homeDir, 'Desktop', 'Récupération automatique.xlsx'),
    path.resolve(process.cwd(), '(Récupération automatique).xlsx'),
    path.resolve(process.cwd(), 'Récupération automatique.xlsx')
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const stats = fs.statSync(p);
      return res.json({
        found: true,
        exists: true,
        filePath: p,
        fileName: path.basename(p),
        size: stats.size,
        lastModified: stats.mtime
      });
    }
  }

  res.json({ found: false, exists: false });
});

// POST /api/products/import-excel/preview
// Analyse le fichier Excel sans modifier la base de données et retourne l'aperçu
router.post('/import-excel/preview', authenticate, requireRole(['admin', 'manager', 'stock_manager']), upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    let source: Buffer | string;
    let originalName = 'catalogue.xlsx';

    if (req.file) {
      source = req.file.buffer;
      originalName = req.file.originalname;
    } else if (req.body.filePath && typeof req.body.filePath === 'string') {
      const targetPath = req.body.filePath.trim();
      if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ error: `Fichier introuvable sur le disque : "${targetPath}"` });
      }
      source = targetPath;
      originalName = path.basename(targetPath);
    } else {
      return res.status(400).json({ error: 'Veuillez téléverser un fichier Excel (.xlsx) ou spécifier son chemin d\'accès local.' });
    }

    const preview = await parseExcelWorkbook(source, originalName);
    res.json({ success: true, preview, ...preview });
  } catch (err: any) {
    console.error('Erreur prévisualisation Excel:', err);
    res.status(500).json({ success: false, error: err.message || 'Erreur lors de la lecture du fichier Excel.' });
  }
});

// POST /api/products/import-excel/confirm
// Enregistre les produits validés au sein d'une transaction SQLite atomique après sauvegarde de sécurité
router.post('/import-excel/confirm', authenticate, requireRole(['admin', 'manager', 'stock_manager']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { products, sourceName } = req.body;
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun produit valide à importer.' });
    }

    const report = executeImportTransaction(products, req.user!, sourceName || 'catalogue.xlsx');
    res.json({ success: true, report, ...report });
  } catch (err: any) {
    console.error('Erreur confirmation import Excel:', err);
    res.status(500).json({ success: false, error: err.message || 'Erreur lors de l\'enregistrement des produits dans la base de données.' });
  }
});

export default router;
