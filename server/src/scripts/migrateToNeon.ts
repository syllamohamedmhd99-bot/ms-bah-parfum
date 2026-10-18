import Database from 'better-sqlite3';
import { Client } from 'pg';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables from server/.env or root .env
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env')
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  }
}

async function runMigration() {
  console.log('===============================================================');
  console.log('🚀 MIGRATION DONNÉES SQLITE -> NEON DATABASE (POSTGRESQL)');
  console.log('   Application : MS BAH PARFUM / Boutique Manager');
  console.log('===============================================================\n');

  // 1. Détection de la chaîne de connexion Neon
  const cliDbUrl = process.argv[2];
  const databaseUrl = cliDbUrl || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

  if (!databaseUrl || databaseUrl.trim() === '') {
    console.error('❌ ERREUR : Aucune variable DATABASE_URL trouvée !');
    console.error('👉 Veuillez définir DATABASE_URL dans server/.env ou passer l\'URL en paramètre :');
    console.error('   npx tsx src/scripts/migrateToNeon.ts "postgresql://neondb_owner:***@ep-***.neon.tech/neondb?sslmode=require"\n');
    process.exit(1);
  }

  // Masquer le mot de passe dans les logs
  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`🔗 Connexion cible Neon : ${maskedUrl}`);

  // 2. Vérification de la base SQLite source
  const sqlitePaths = [
    path.resolve(process.cwd(), 'server/data/boutique.db'),
    path.resolve(process.cwd(), 'data/boutique.db'),
    path.resolve(__dirname, '../../data/boutique.db'),
    path.resolve(__dirname, '../data/boutique.db')
  ];

  const sqlitePath = sqlitePaths.find(p => fs.existsSync(p));
  if (!sqlitePath) {
    console.error('❌ ERREUR : Base SQLite source introuvable dans server/data/boutique.db !');
    process.exit(1);
  }

  console.log(`📂 Base SQLite source trouvée : ${sqlitePath}`);
  const sqlite = new Database(sqlitePath, { readonly: true });

  // 3. Connexion à Neon PostgreSQL
  console.log('\n⏳ Connexion sécurisée à Neon PostgreSQL...');
  const pgClient = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pgClient.connect();
    const versionRes = await pgClient.query('SELECT version(), current_database()');
    console.log(`✅ Connecté avec succès à Neon ! [Base: ${versionRes.rows[0].current_database}]`);
  } catch (connErr: any) {
    console.error('❌ Échec de connexion à Neon :', connErr.message);
    process.exit(1);
  }

  // 4. Déploiement du schéma PostgreSQL
  console.log('\n📄 Déploiement et vérification du schéma PostgreSQL...');
  const schemaCandidates = [
    path.resolve(__dirname, '../schema.postgresql.sql'),
    path.resolve(__dirname, 'schema.postgresql.sql'),
    path.resolve(process.cwd(), 'server/src/schema.postgresql.sql'),
    path.resolve(process.cwd(), 'schema.postgresql.sql')
  ];

  const schemaPath = schemaCandidates.find(p => fs.existsSync(p));
  if (!schemaPath) {
    console.error('❌ Fichier schema.postgresql.sql introuvable !');
    await pgClient.end();
    process.exit(1);
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await pgClient.query(schemaSql);
  console.log('✅ Schéma PostgreSQL vérifié et appliqué avec succès.');

  // 5. Migration des tables dans l'ordre relationnel
  const tablesToMigrate = [
    'users',
    'categories',
    'suppliers',
    'clients',
    'products',
    'cash_registers',
    'cash_sessions',
    'purchases',
    'purchase_items',
    'sales',
    'sale_items',
    'money_transfers',
    'financial_movements',
    'stock_movements',
    'inventory_audits',
    'inventory_audit_items',
    'audit_logs',
    'settings'
  ];

  console.log('\n📦 Début du transfert des tables depuis SQLite vers Neon...\n');

  for (const tableName of tablesToMigrate) {
    try {
      // Vérifier si la table existe dans SQLite
      const tableCheck = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
      if (!tableCheck) {
        console.log(`⚠️  Table ${tableName} absente de SQLite, ignorée.`);
        continue;
      }

      const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all() as Record<string, any>[];
      if (rows.length === 0) {
        console.log(`ℹ️  Table [${tableName}] : 0 enregistrement à transférer.`);
        continue;
      }

      // Récupérer les colonnes existantes dans PostgreSQL pour cette table
      const pgColsRes = await pgClient.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);
      const validPgCols = new Set(pgColsRes.rows.map(r => r.column_name.toLowerCase()));

      let insertedCount = 0;
      await pgClient.query('BEGIN');

      for (const row of rows) {
        // Filtrer les colonnes qui existent bien dans le schéma PostgreSQL
        const rowKeys = Object.keys(row).filter(k => validPgCols.has(k.toLowerCase()));
        if (rowKeys.length === 0) continue;

        const colsList = rowKeys.map(k => `"${k}"`).join(', ');
        const placeholders = rowKeys.map((_, idx) => `$${idx + 1}`).join(', ');
        const values = rowKeys.map(k => {
          const val = row[k];
          // Gérer dates ISO ou booléens si nécessaire
          return val;
        });

        // Utiliser ON CONFLICT (id) DO UPDATE si la clé id est présente
        let conflictClause = '';
        if (rowKeys.includes('id')) {
          const updateSet = rowKeys.filter(k => k !== 'id').map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');
          if (updateSet) {
            conflictClause = `ON CONFLICT (id) DO UPDATE SET ${updateSet}`;
          } else {
            conflictClause = `ON CONFLICT (id) DO NOTHING`;
          }
        } else if (tableName === 'settings' && rowKeys.includes('key')) {
          conflictClause = `ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
        }

        const insertSql = `
          INSERT INTO "${tableName}" (${colsList})
          VALUES (${placeholders})
          ${conflictClause}
        `;

        await pgClient.query(insertSql, values);
        insertedCount++;
      }

      await pgClient.query('COMMIT');

      // 6. Réinitialiser la séquence auto-incrémentée (SERIAL) pour éviter les collisions d'ID futures
      if (tableName !== 'settings') {
        try {
          await pgClient.query(`
            SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), true)
          `);
        } catch {
          // Certaines tables n'ont pas de séquence id
        }
      }

      console.log(`✅ Table [${tableName.padEnd(22)}] : ${insertedCount.toString().padStart(4)} lignes transférées avec succès.`);
    } catch (tblErr: any) {
      await pgClient.query('ROLLBACK');
      console.error(`❌ Erreur sur la table [${tableName}] :`, tblErr.message);
    }
  }

  // 7. Vérification finale et statistiques comparatives
  console.log('\n===============================================================');
  console.log('📊 RAPPORT DE VÉRIFICATION ET CONTRÔLE D\'INTÉGRITÉ');
  console.log('===============================================================');

  const checkTables = ['products', 'categories', 'users', 'cash_registers', 'settings'];
  for (const tbl of checkTables) {
    const sqCount = (sqlite.prepare(`SELECT COUNT(*) as c FROM ${tbl}`).get() as any)?.c || 0;
    const pgRes = await pgClient.query(`SELECT COUNT(*) as c FROM "${tbl}"`);
    const pgCount = Number(pgRes.rows[0].c);

    const statusMatch = sqCount === pgCount ? '✅ CONFORME' : '⚠️ DIFFÉRENCE';
    console.log(`- ${tbl.padEnd(16)} : SQLite = ${sqCount.toString().padStart(4)} | Neon PostgreSQL = ${pgCount.toString().padStart(4)} [${statusMatch}]`);
  }

  // Vérification de la marque et du numéro de téléphone
  const phoneCheck = await pgClient.query(`SELECT value FROM settings WHERE key = 'shop_phone'`);
  const nameCheck = await pgClient.query(`SELECT value FROM settings WHERE key = 'shop_name'`);
  console.log(`\n🏷️ Nom de l'établissement : ${nameCheck.rows[0]?.value || 'Non défini'}`);
  console.log(`📞 Téléphone de contact   : ${phoneCheck.rows[0]?.value || 'Non défini'}`);

  await pgClient.end();
  sqlite.close();

  console.log('\n===============================================================');
  console.log('🎉 MIGRATION VERS NEON DATABASE TERMINÉE AVEC SUCCÈS !');
  console.log('===============================================================\n');
}

runMigration().catch((err) => {
  console.error('\n❌ ERREUR FATALE LORS DE LA MIGRATION :', err);
  process.exit(1);
});
