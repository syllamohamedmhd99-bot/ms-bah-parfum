import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import db, { logAudit } from '../database.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { seedDatabase, cleanAllPredefinedData } from '../seed.js';

const router = Router();

function getDbPath(): string {
  const defaultDbDir = path.resolve(__dirname, '../../data');
  return process.env.DB_PATH || path.join(defaultDbDir, 'boutique.db');
}

// GET /api/backup/info (Informations sur la base de données et l'état hors ligne)
router.get('/info', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const dbPath = getDbPath();
    const exists = fs.existsSync(dbPath);
    let sizeBytes = 0;
    let lastModified: Date | null = null;

    if (exists) {
      const stats = fs.statSync(dbPath);
      sizeBytes = stats.size;
      lastModified = stats.mtime;
    }

    const counts = {
      products: (db.prepare('SELECT COUNT(*) as count FROM products').get() as any)?.count || 0,
      sales: (db.prepare('SELECT COUNT(*) as count FROM sales').get() as any)?.count || 0,
      purchases: (db.prepare('SELECT COUNT(*) as count FROM purchases').get() as any)?.count || 0,
      clients: (db.prepare('SELECT COUNT(*) as count FROM clients').get() as any)?.count || 0,
      suppliers: (db.prepare('SELECT COUNT(*) as count FROM suppliers').get() as any)?.count || 0,
      transfers: (db.prepare('SELECT COUNT(*) as count FROM money_transfers').get() as any)?.count || 0,
    };

    res.json({
      dbPath,
      exists,
      sizeBytes,
      sizeFormatted: `${(sizeBytes / (1024 * 1024)).toFixed(2)} Mo`,
      lastModified,
      counts,
      isOffline: true,
      journalMode: 'WAL'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/backup/download (Télécharger une copie de sauvegarde de la base SQLite)
router.get('/download', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const dbPath = getDbPath();

  if (!fs.existsSync(dbPath)) {
    res.status(404).json({ error: 'Fichier de base de données introuvable.' });
    return;
  }

  // Force checkpoint WAL into main database file before download
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) {
    console.error('WAL checkpoint warning:', e);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `sauvegarde_boutique_manager_${dateStr}.db`;

  logAudit(req.user!.id, req.user!.fullName, 'BACKUP_DOWNLOAD', 'system', null, 'Téléchargement de la sauvegarde de la base de données.');

  res.download(dbPath, fileName);
});

// POST /api/backup/save-to-path (Sauvegarde atomique vers un dossier local ou clé USB)
router.post('/save-to-path', authenticate, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { targetFolder } = req.body;
  
  if (!targetFolder || !fs.existsSync(targetFolder)) {
    res.status(400).json({ error: 'Dossier de destination spécifié invalide ou inaccessible.' });
    return;
  }

  try {
    // Flush WAL
    db.pragma('wal_checkpoint(TRUNCATE)');

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const destFileName = `boutique_backup_${dateStr}.db`;
    const destPath = path.join(targetFolder, destFileName);

    // Use better-sqlite3 native backup API for zero-lock online backup
    await db.backup(destPath);

    logAudit(req.user!.id, req.user!.fullName, 'BACKUP_CREATED', 'system', null, `Sauvegarde hors ligne créée : ${destPath}`);

    res.json({
      success: true,
      message: `Sauvegarde effectuée avec succès vers : ${destPath}`,
      destPath
    });
  } catch (err: any) {
    console.error('Erreur sauvegarde vers chemin:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la sauvegarde.' });
  }
});

// POST /api/backup/restore-from-path (Restauration avec validation d'intégrité PRAGMA)
router.post('/restore-from-path', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { sourcePath, confirmation } = req.body;

  if (confirmation !== 'RESTAURER_BASE') {
    res.status(400).json({ error: 'Code de confirmation incorrect. Saisir "RESTAURER_BASE".' });
    return;
  }

  if (!sourcePath || !fs.existsSync(sourcePath)) {
    res.status(400).json({ error: 'Fichier source de sauvegarde introuvable.' });
    return;
  }

  try {
    // 1. Valider l'intégrité du fichier de sauvegarde avant de le charger
    const verifyDb = new Database(sourcePath, { readonly: true });
    const check = verifyDb.pragma('integrity_check') as any[];
    verifyDb.close();

    if (!check || check.length === 0 || check[0].integrity_check !== 'ok') {
      res.status(400).json({ error: 'Le fichier de sauvegarde est corrompu ou invalide (Échec PRAGMA integrity_check).' });
      return;
    }

    const currentDbPath = getDbPath();
    const backupOfCurrent = `${currentDbPath}.pre_restore.bak`;

    // 2. Créer une copie de secours de la base actuelle au cas où
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      fs.copyFileSync(currentDbPath, backupOfCurrent);
    } catch (e) {
      console.warn('Impossible de créer la sauvegarde pré-restauration:', e);
    }

    // 3. Fermer et remplacer
    db.close();
    fs.copyFileSync(sourcePath, currentDbPath);

    // Supprimer les résidus WAL / SHM de l'ancienne session
    try {
      if (fs.existsSync(`${currentDbPath}-wal`)) fs.unlinkSync(`${currentDbPath}-wal`);
      if (fs.existsSync(`${currentDbPath}-shm`)) fs.unlinkSync(`${currentDbPath}-shm`);
    } catch (e) {
      console.warn('Nettoyage WAL/SHM:', e);
    }

    logAudit(req.user!.id, req.user!.fullName, 'RESTORE_DATABASE', 'system', null, `Restauration effectuée depuis ${sourcePath}`);

    res.json({
      success: true,
      message: 'Base de données restaurée avec succès. L\'application va redémarrer.'
    });

    // Recharger la connexion de la base de données ou demander redémarrage
    setTimeout(() => {
      process.exit(0); // Exit so supervisor / Electron relaunches fresh
    }, 1000);

  } catch (err: any) {
    console.error('Erreur restauration:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la restauration.' });
  }
});

// POST /api/backup/clean-for-production (Nettoyer les données de test avant mise en production)
router.post('/clean-for-production', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { confirmation } = req.body;
  if (confirmation !== 'PASSER_EN_PRODUCTION') {
    res.status(400).json({ error: 'Code de confirmation incorrect. Saisir "PASSER_EN_PRODUCTION".' });
    return;
  }

  try {
    db.exec('PRAGMA foreign_keys = OFF;');

    const transTables = [
      'sale_items', 'sales', 'purchase_items', 'purchases',
      'stock_movements', 'money_transfers', 'financial_movements',
      'cash_sessions', 'inventory_audit_items', 'inventory_audits'
    ];

    for (const tbl of transTables) {
      db.exec(`DELETE FROM ${tbl};`);
      db.exec(`DELETE FROM sqlite_sequence WHERE name='${tbl}';`);
    }

    db.exec(`UPDATE cash_registers SET balance = 0;`);
    db.exec(`UPDATE clients SET current_debt = 0;`);
    db.exec('PRAGMA foreign_keys = ON;');

    logAudit(req.user!.id, req.user!.fullName, 'CLEAN_FOR_PRODUCTION', 'system', null, 'Bascule en production: purge complète des transactions de test.');

    res.json({ message: 'Base de données purgée des transactions de test. Prête pour l\'utilisation en production réelle.' });
  } catch (err: any) {
    console.error('Erreur bascule production:', err);
    res.status(500).json({ error: 'Erreur lors du nettoyage de la base de données.' });
  }
});

// POST /api/backup/clean-everything (Purger tous les produits, clients, fournisseurs et transactions prédéfinies)
router.post('/clean-everything', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { confirmation, keepCategories = false } = req.body;
  if (confirmation !== 'VIDER_TOUT') {
    res.status(400).json({ error: 'Code de confirmation incorrect. Saisir "VIDER_TOUT".' });
    return;
  }

  try {
    cleanAllPredefinedData(Boolean(keepCategories));
    logAudit(req.user!.id, req.user!.fullName, 'CLEAN_EVERYTHING', 'system', null, `Purge complète des données prédéfinies (catégories conservées: ${keepCategories ? 'Oui' : 'Non'}).`);
    res.json({ message: 'Toutes les données prédéfinies ont été purgées avec succès. Vous pouvez maintenant ajouter vos propres données.' });
  } catch (err: any) {
    console.error('Erreur purge complète:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de toutes les données prédéfinies.' });
  }
});

export default router;
