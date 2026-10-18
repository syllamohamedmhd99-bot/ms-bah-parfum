import { Router, Response } from 'express';
import db, { logAudit } from '../database.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/categories
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.is_archived = 0
    GROUP BY c.id
    ORDER BY c.name ASC
  `).all();
  res.json(categories);
});

// POST /api/categories/load-defaults
router.post('/load-defaults', authenticate, requireRole(['admin', 'manager', 'stock_manager']), (req: AuthenticatedRequest, res: Response) => {
  const defaultCategories = [
    { name: 'Maquillage', desc: 'Fards, rouges à lèvres, fonds de teint, mascaras', icon: 'Sparkles' },
    { name: 'Parfums', desc: 'Eaux de parfum, eaux de toilette, brumes corporelles', icon: 'Flame' },
    { name: 'Crèmes et lotions', desc: 'Laits hydratants, crèmes visage, sérums éclat', icon: 'Smile' },
    { name: 'Savons et gels douche', desc: 'Savons noirs, gels douche moussants, savons dermatologiques', icon: 'Droplets' },
    { name: 'Shampoings et soins capillaires', desc: 'Shampoings, masques nourrissants, huiles capillaires', icon: 'Scissors' },
    { name: 'Produits d’hygiène corporelle', desc: 'Cotons, lingettes, gommages, soins du corps', icon: 'Heart' },
    { name: 'Produits d’hygiène intime', desc: 'Gels intimes, serviettes hygiéniques, protège-slips', icon: 'ShieldCheck' },
    { name: 'Déodorants', desc: 'Sprays anti-transpirants, roll-on, sticks parfumés', icon: 'Wind' },
    { name: 'Produits pour bébés', desc: 'Couches bébés, laits de toilette, poudres adoucissantes', icon: 'Baby' },
    { name: 'Accessoires de beauté', desc: 'Pinceaux, miroirs, limes, trousses de toilette', icon: 'Gift' },
    { name: 'Articles divers', desc: 'Articles sanitaires et accessoires complémentaires', icon: 'Package' }
  ];

  const insert = db.prepare('INSERT OR IGNORE INTO categories (name, description, icon) VALUES (?, ?, ?)');
  let addedCount = 0;
  for (const cat of defaultCategories) {
    const res = insert.run(cat.name, cat.desc, cat.icon);
    if (res.changes > 0) addedCount++;
  }

  logAudit(req.user!.id, req.user!.fullName, 'LOAD_DEFAULT_CATEGORIES', 'category', null, `Chargement des catégories par défaut (+${addedCount} ajoutées)`);
  res.json({ message: `${addedCount} catégorie(s) cosmétique(s) ajoutée(s) avec succès.` });
});

// POST /api/categories
router.post('/', authenticate, requireRole(['admin', 'manager', 'stock_manager']), (req: AuthenticatedRequest, res: Response) => {
  const { name, description, icon } = req.body;
  if (!name || name.trim() === '') {
    res.status(400).json({ error: 'Le nom de la catégorie est obligatoire.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)').get(name.trim());
  if (existing) {
    res.status(400).json({ error: 'Une catégorie portant ce nom existe déjà.' });
    return;
  }

  const stmt = db.prepare('INSERT INTO categories (name, description, icon) VALUES (?, ?, ?)');
  const result = stmt.run(name.trim(), description || null, icon || 'Package');

  logAudit(req.user!.id, req.user!.fullName, 'CREATE_CATEGORY', 'category', Number(result.lastInsertRowid), `Création de la catégorie: ${name.trim()}`);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Catégorie créée avec succès.' });
});

// PUT /api/categories/:id
router.put('/:id', authenticate, requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, icon } = req.body;

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
  if (!category) {
    res.status(404).json({ error: 'Catégorie introuvable.' });
    return;
  }

  if (name && name.trim() !== '') {
    const existing = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?').get(name.trim(), id);
    if (existing) {
      res.status(400).json({ error: 'Ce nom de catégorie est déjà utilisé.' });
      return;
    }
  }

  db.prepare(`
    UPDATE categories SET name = ?, description = ?, icon = ? WHERE id = ?
  `).run(name || category.name, description ?? category.description, icon || category.icon, id);

  logAudit(req.user!.id, req.user!.fullName, 'UPDATE_CATEGORY', 'category', Number(id), `Modification de la catégorie: ${name || category.name}`);
  res.json({ message: 'Catégorie mise à jour avec succès.' });
});

// DELETE /api/categories/:id
router.delete('/:id', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const products = db.prepare('SELECT COUNT(id) as count FROM products WHERE category_id = ?').get(id) as any;

  if (products.count > 0) {
    res.status(400).json({ error: `Impossible de supprimer cette catégorie car elle contient ${products.count} produit(s). Veuillez d'abord réassigner les produits.` });
    return;
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  logAudit(req.user!.id, req.user!.fullName, 'DELETE_CATEGORY', 'category', Number(id), `Suppression de la catégorie ID ${id}`);
  res.json({ message: 'Catégorie supprimée avec succès.' });
});

export default router;
