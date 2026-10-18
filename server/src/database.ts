import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const defaultDbDir = path.resolve(__dirname, '../data');
const dbPath = process.env.DB_PATH || path.join(defaultDbDir, 'boutique.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable Foreign Keys and Write-Ahead Logging for high performance & concurrency
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialize schema from file
const potentialSchemaPaths = [
  path.join(__dirname, 'schema.sql'),
  path.join(__dirname, '../src/schema.sql'),
  path.join(__dirname, '../../server/src/schema.sql'),
  path.join(process.cwd(), 'server/src/schema.sql'),
  path.join(process.cwd(), 'schema.sql')
];

let schemaLoaded = false;
for (const sPath of potentialSchemaPaths) {
  if (fs.existsSync(sPath)) {
    try {
      const schemaSql = fs.readFileSync(sPath, 'utf8');
      db.exec(schemaSql);
      schemaLoaded = true;
      break;
    } catch (err) {
      console.error(`Erreur d'exécution de ${sPath}:`, err);
    }
  }
}

if (!schemaLoaded) {
  console.warn('Attention: Aucun fichier schema.sql trouvé sur les chemins explorés.');
}

// Migration automatique des colonnes d'importation dans products
try {
  const productColumns = db.prepare("PRAGMA table_info('products')").all() as any[];
  const colNames = productColumns.map((c) => c.name);

  if (!colNames.includes('needs_completion')) {
    db.exec('ALTER TABLE products ADD COLUMN needs_completion INTEGER NOT NULL DEFAULT 0');
  }
  if (!colNames.includes('import_source')) {
    db.exec('ALTER TABLE products ADD COLUMN import_source TEXT');
  }
  if (!colNames.includes('import_date')) {
    db.exec('ALTER TABLE products ADD COLUMN import_date DATETIME');
  }
} catch (migErr) {
  console.warn('Vérification des colonnes de produits:', migErr);
}

// Migration automatique de la table sync_events
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      device_name TEXT,
      mutation_id TEXT UNIQUE NOT NULL,
      entity_type TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'applied',
      conflict_details TEXT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sync_events_mutation ON sync_events(mutation_id);
  `);
} catch (syncErr) {
  console.warn('Vérification de la table sync_events:', syncErr);
}

// Auto-seed baseline configuration if users table is empty (fresh offline installation)
try {
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count;
  if (!userCount || userCount === 0) {
    console.log('[AUTO-INIT] Initialisation des comptes et registres par défaut pour installation neuve...');
    
    // Seed default users
    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, phone, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    const salt = bcrypt.genSaltSync(10);
    insertUser.run('admin', bcrypt.hashSync('admin123', salt), 'Elhadj Seydou Diallo', 'admin', '+224 622 00 11 22');
    insertUser.run('gerant', bcrypt.hashSync('gerant123', salt), 'Mamadou Alpha Barry', 'manager', '+224 628 33 44 55');
    insertUser.run('caissier', bcrypt.hashSync('caissier123', salt), 'Fatoumata Binta Camara', 'cashier', '+224 621 77 88 99');
    insertUser.run('stock', bcrypt.hashSync('stock123', salt), 'Ibrahima Sory Soumah', 'stock_manager', '+224 624 55 66 77');

    // Seed default cash registers
    const regCount = (db.prepare('SELECT COUNT(*) as count FROM cash_registers').get() as any)?.count;
    if (!regCount || regCount === 0) {
      const insertRegister = db.prepare(`
        INSERT INTO cash_registers (name, type, balance, phone_number, notes)
        VALUES (?, ?, 0, ?, ?)
      `);
      insertRegister.run('Caisse Principale (Espèces)', 'cash', null, 'Caisse physique du comptoir');
      insertRegister.run('Orange Money Boutique', 'orange_money', '+224 622 00 00 00', 'Compte marchand OM');
      insertRegister.run('MTN Mobile Money Boutique', 'mtn_momo', '+224 664 00 00 00', 'Compte marchand MoMo');
      insertRegister.run('Coffre-Fort Réserve', 'bank', null, 'Réserve de sécurité');
    }

    // Seed default settings
    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, description) VALUES (?, ?, ?)');
    insertSetting.run('shop_name', 'MS BAH PARFUM', 'Nom officiel de l\'établissement');
    insertSetting.run('boutique_name', 'MS BAH PARFUM', 'Nom commercial de la boutique');
    insertSetting.run('shop_address', 'Marché Madina, Commune de Matam, Conakry, Guinée', 'Adresse physique');
    insertSetting.run('shop_phone', '+224 626 96 39 82', 'Numéro de contact principal');
    insertSetting.run('boutique_phone', '+224 626 96 39 82', 'Téléphone principal');
    insertSetting.run('currency', 'GNF', 'Devise monétaire par défaut');
    insertSetting.run('tax_rate', '0', 'Taux de taxe applicable en %');
    insertSetting.run('low_stock_threshold', '5', 'Seuil d\'alerte stock faible par défaut');
    insertSetting.run('receipt_footer', 'MS BAH PARFUM vous remercie pour votre confiance ! Contact : 626 96 39 82.', 'Message de bas de ticket');
    
    console.log('[AUTO-INIT] Données de base initialisées avec succès.');
  }
} catch (initErr) {
  console.error('[AUTO-INIT] Erreur lors de l\'initialisation automatique:', initErr);
}

export default db;

// Helper to log audit events
export function logAudit(userId: number | null, userName: string | null, action: string, entityType: string, entityId: number | null, details: string, ipAddress: string = '127.0.0.1') {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(userId, userName, action, entityType, entityId, details, ipAddress);
  } catch (err) {
    console.error('Erreur audit log:', err);
  }
}
