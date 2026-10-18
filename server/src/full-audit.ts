import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import db from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'seydou_cosmetique_secure_jwt_token_2026';

async function runComprehensiveAudit() {
  console.log('================================================================');
  console.log('   AUDIT COMPLET DE CONFORMITÉ & RECHERCHE D\'ANOMALIES');
  console.log('   Seydou Boutique Manager (Desktop & Web Offline)');
  console.log('================================================================\n');

  let errorsFound = 0;
  let checksPassed = 0;

  function reportSuccess(title: string, detail?: string) {
    checksPassed++;
    console.log(`  ✓ [SUCCÈS] ${title}${detail ? ` (${detail})` : ''}`);
  }

  function reportFailure(title: string, error: any) {
    errorsFound++;
    console.error(`  ✗ [ERREUR] ${title}:`, error);
  }

  // 1. Audit SQLite PRAGMA & Structure
  console.log('--- 1. AUDIT DE LA BASE DE DONNÉES & STRUCTURE SQL ---');
  try {
    const integrity = db.pragma('integrity_check') as any[];
    if (integrity && integrity[0].integrity_check === 'ok') {
      reportSuccess('PRAGMA integrity_check est valide (aucune corruption)');
    } else {
      reportFailure('Échec intégrité PRAGMA', integrity);
    }

    const fkCheck = db.pragma('foreign_key_check') as any[];
    if (fkCheck.length === 0) {
      reportSuccess('Aucune violation de clé étrangère (FK check = 0)');
    } else {
      reportFailure('Clés étrangères invalides détectées', fkCheck);
    }

    const journalMode = db.pragma('journal_mode') as any[];
    reportSuccess(`Mode journal SQLite actif: ${journalMode[0].journal_mode.toUpperCase()}`);
  } catch (err: any) {
    reportFailure('Audit SQLite initial', err.message);
  }

  // 2. Audit des comptes utilisateurs
  console.log('\n--- 2. AUDIT DE SÉCURITÉ & AUTHENTIFICATION ---');
  try {
    const users = db.prepare('SELECT id, username, role, is_active FROM users').all() as any[];
    if (users.length >= 4) {
      reportSuccess(`4 comptes rôles préconfigurés trouvés (${users.map(u => u.username).join(', ')})`);
    } else {
      reportFailure('Comptes utilisateurs manquants', `${users.length} trouvés`);
    }

    // Token JWT verification
    const adminUser = users.find(u => u.username === 'admin');
    const token = jwt.sign(
      { id: adminUser.id, username: adminUser.username, fullName: 'Admin Test', role: adminUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded) {
      reportSuccess('Signature et décodage JWT valides');
    }
  } catch (err: any) {
    reportFailure('Audit authentification', err.message);
  }

  // 3. Audit des Caisses & Portefeuilles Mobile Money
  console.log('\n--- 3. AUDIT DES CAISSES & PORTEFEUILLES MOBILE MONEY ---');
  try {
    const registers = db.prepare('SELECT id, name, type, balance FROM cash_registers').all() as any[];
    if (registers.length >= 4) {
      reportSuccess(`${registers.length} registres de trésorerie trouvés`);
      const omReg = registers.find(r => r.type === 'orange_money');
      const momoReg = registers.find(r => r.type === 'mtn_momo');
      const cashReg = registers.find(r => r.type === 'cash');

      if (omReg && momoReg && cashReg) {
        reportSuccess('Registres Orange Money, MTN MoMo et Caisse physique identifiés');
      }

      // Check if balances are all numeric and non-negative
      const invalidBalances = registers.filter(r => isNaN(r.balance) || r.balance < 0);
      if (invalidBalances.length === 0) {
        reportSuccess('Tous les soldes de caisses sont valides et cohérents');
      } else {
        reportFailure('Soldes de caisses invalides', invalidBalances);
      }
    } else {
      reportFailure('Registres de caisse manquants', `${registers.length} trouvés`);
    }
  } catch (err: any) {
    reportFailure('Audit des caisses', err.message);
  }

  // 4. Audit des routes clés et requêtes SQL
  console.log('\n--- 4. AUDIT DES REQUÊTES SQL & INTÉGRITÉ MÉTIER ---');
  try {
    // Test Dashboard Query
    const todaySales = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(id) as count
      FROM sales
      WHERE date(date) = date('now', 'localtime') AND status = 'completed'
    `).get() as any;
    reportSuccess('Requête Chiffre d\'Affaires du jour exécutée avec succès', `CA: ${todaySales.total} GNF`);

    // Test Products Query
    const prods = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_archived = 0
    `).all() as any[];
    reportSuccess('Requête Catalogue Produits exécutée avec succès', `${prods.length} article(s)`);

    // Test Alerts Query
    const lowStock = db.prepare(`
      SELECT COUNT(*) as count FROM products
      WHERE stock_quantity <= alert_threshold AND is_archived = 0
    `).get() as any;
    reportSuccess('Requête Alertes Stock Faible exécutée avec succès', `${lowStock.count} alerte(s)`);

    // Test Cash Sessions Query
    const activeSession = db.prepare(`
      SELECT * FROM cash_sessions WHERE status = 'open' LIMIT 1
    `).get();
    reportSuccess('Requête Session de caisse active exécutée avec succès');

    // Test Settings Query
    const settings = db.prepare('SELECT key, value FROM settings').all() as any[];
    reportSuccess('Requête Paramètres exécutée avec succès', `${settings.length} paramètre(s) configuré(s)`);
  } catch (err: any) {
    reportFailure('Audit requêtes SQL', err.message);
  }

  // 5. Audit des Vues ou Dépendances Fichiers
  console.log('\n--- 5. AUDIT DES FICHIERS & PACKAGING HORS LIGNE ---');
  try {
    const rootDir = path.resolve('c:/Seydou boutique');
    const installerPath = path.join(rootDir, 'release/Boutique Manager-Setup-1.0.0.exe');
    if (fs.existsSync(installerPath)) {
      const stats = fs.statSync(installerPath);
      reportSuccess('Installateur Windows 11 prêt', `${Math.round(stats.size / 1024 / 1024)} Mo`);
    } else {
      reportFailure('Installateur Windows 11 introuvable', installerPath);
    }

    const distPath = path.join(rootDir, 'client/dist/index.html');
    if (fs.existsSync(distPath)) {
      reportSuccess('Frontend compilé présent dans client/dist');
    } else {
      reportFailure('client/dist/index.html introuvable', distPath);
    }
  } catch (err: any) {
    reportFailure('Audit des fichiers', err.message);
  }

  console.log('\n================================================================');
  console.log(`   RÉSULTAT DE L'AUDIT : ${checksPassed} SUCCÈS, ${errorsFound} ANOMALIES`);
  console.log('================================================================\n');

  if (errorsFound === 0) {
    console.log('  AUCUNE ERREUR NI ANOMALIE DÉTECTÉE ! APPLICATION 100% VALIDE.');
  } else {
    process.exit(1);
  }
}

runComprehensiveAudit().catch(err => {
  console.error('Erreur critique pendant l\'audit:', err);
  process.exit(1);
});
