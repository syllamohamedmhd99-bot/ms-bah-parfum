import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import sqliteDb from '../database.js';

dotenv.config();
const envLocalCandidates = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(__dirname, '../../.env.local'),
  path.resolve(__dirname, '../../../.env.local')
];
for (const envL of envLocalCandidates) {
  if (fs.existsSync(envL)) {
    dotenv.config({ path: envL });
  }
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

let pgPool: Pool | null = null;
let isPgActive = false;

if (DATABASE_URL && DATABASE_URL.trim() !== '') {
  try {
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pgPool.on('error', (err) => {
      console.error('[NEON-PG] Erreur inattendue sur le pool de connexion:', err);
    });

    isPgActive = true;
    console.log('[DATABASE] Configuration Neon PostgreSQL détectée via DATABASE_URL.');
  } catch (err) {
    console.error('[NEON-PG] Échec d\'initialisation du pool Neon:', err);
    isPgActive = false;
  }
} else {
  console.log('[DATABASE] Mode SQLite local actif (DATABASE_URL non configuré).');
}

/**
 * Normalise les paramètres SQL : convertit les points d'interrogation (?) en $1, $2... pour PostgreSQL
 */
export function formatQueryForPostgres(sql: string): string {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

/**
 * Exécute une requête SQL de manière générique sur la base active (Neon ou SQLite)
 */
export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (isPgActive && pgPool) {
    const formattedSql = formatQueryForPostgres(sql);
    const result = await pgPool.query(formattedSql, params);
    return result.rows as T[];
  } else {
    // Mode SQLite local
    const stmt = sqliteDb.prepare(sql);
    return stmt.all(...params) as T[];
  }
}

/**
 * Exécute une requête SQL retournant un seul enregistrement
 */
export async function dbQueryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  if (isPgActive && pgPool) {
    const formattedSql = formatQueryForPostgres(sql);
    const result = await pgPool.query(formattedSql, params);
    return (result.rows[0] as T) || null;
  } else {
    const stmt = sqliteDb.prepare(sql);
    return (stmt.get(...params) as T) || null;
  }
}

/**
 * Exécute une opération d'écriture (INSERT, UPDATE, DELETE)
 */
export async function dbExecute(sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId?: number }> {
  if (isPgActive && pgPool) {
    const formattedSql = formatQueryForPostgres(sql);
    const result = await pgPool.query(formattedSql, params);
    return {
      affectedRows: result.rowCount || 0,
      insertId: (result.rows[0] as any)?.id
    };
  } else {
    const stmt = sqliteDb.prepare(sql);
    const info = stmt.run(...params);
    return {
      affectedRows: info.changes,
      insertId: Number(info.lastInsertRowid)
    };
  }
}

/**
 * Exécute une transaction sécurisée
 */
export async function dbTransaction<T>(callback: (client: { query: (sql: string, params?: any[]) => Promise<any> }) => Promise<T>): Promise<T> {
  if (isPgActive && pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const transactionWrapper = {
        query: async (sql: string, params: any[] = []) => {
          const formatted = formatQueryForPostgres(sql);
          const res = await client.query(formatted, params);
          return res.rows;
        }
      };
      const result = await callback(transactionWrapper);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    // SQLite transaction
    const executeTx = sqliteDb.transaction(() => {
      const sqliteWrapper = {
        query: async (sql: string, params: any[] = []) => {
          const stmt = sqliteDb.prepare(sql);
          if (sql.trim().toUpperCase().startsWith('SELECT')) {
            return stmt.all(...params);
          } else {
            return stmt.run(...params);
          }
        }
      };
      // Dans better-sqlite3 la transaction est synchrone
      return callback(sqliteWrapper);
    });
    return await executeTx();
  }
}

/**
 * Teste la connectivité avec Neon PostgreSQL
 */
export async function testPostgresConnection(): Promise<{
  connected: boolean;
  version?: string;
  database?: string;
  currentTime?: string;
  latencyMs?: number;
  error?: string;
}> {
  if (!pgPool) {
    return {
      connected: false,
      error: 'DATABASE_URL n\'est pas configurée dans les variables d\'environnement.'
    };
  }

  const start = Date.now();
  try {
    const client = await pgPool.connect();
    try {
      const res = await client.query('SELECT version(), current_database(), NOW() as current_time');
      const latency = Date.now() - start;
      return {
        connected: true,
        version: res.rows[0].version,
        database: res.rows[0].current_database,
        currentTime: res.rows[0].current_time,
        latencyMs: latency
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return {
      connected: false,
      error: err.message || 'Erreur de connexion à Neon'
    };
  }
}

/**
 * Déploie le schéma PostgreSQL sur Neon si nécessaire
 */
export async function initNeonSchema(): Promise<{ success: boolean; tablesCreated: number; message: string }> {
  if (!pgPool) {
    throw new Error('Connexion Neon non disponible pour initialiser le schéma.');
  }

  const schemaCandidates = [
    path.join(__dirname, '../schema.postgresql.sql'),
    path.join(__dirname, 'schema.postgresql.sql'),
    path.join(process.cwd(), 'server/src/schema.postgresql.sql'),
    path.join(process.cwd(), 'schema.postgresql.sql')
  ];

  const schemaPath = schemaCandidates.find(p => fs.existsSync(p));
  if (!schemaPath) {
    throw new Error('Fichier schema.postgresql.sql introuvable.');
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const client = await pgPool.connect();
  try {
    await client.query(schemaSql);
    const countRes = await client.query(`
      SELECT count(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    return {
      success: true,
      tablesCreated: Number(countRes.rows[0].count),
      message: 'Schéma PostgreSQL déployé avec succès sur Neon Database.'
    };
  } finally {
    client.release();
  }
}

export function isNeonActive(): boolean {
  return isPgActive;
}

export function getPgPool(): Pool | null {
  return pgPool;
}

export default {
  query: dbQuery,
  queryOne: dbQueryOne,
  execute: dbExecute,
  transaction: dbTransaction,
  isNeonActive,
  testPostgresConnection,
  initNeonSchema,
  getPgPool
};
