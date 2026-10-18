import { Router, Response } from 'express';
import dbAdapter, { isNeonActive, getPgPool } from '../db/index.js';
import sqliteDb, { logAudit } from '../database.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/sync/status
 * Retourne le statut de la base de données et l'état de synchronisation
 */
router.get('/status', async (req, res: Response) => {
  try {
    const isPg = isNeonActive();
    let dbDetails = null;

    if (isPg) {
      dbDetails = await dbAdapter.testPostgresConnection();
    }

    // Récupérer le nombre de produits actuels
    let productsCount = 0;
    let categoriesCount = 0;

    if (isPg) {
      const prodRes = await dbAdapter.query('SELECT COUNT(*) as c FROM products');
      productsCount = Number(prodRes[0]?.c || 0);
      const catRes = await dbAdapter.query('SELECT COUNT(*) as c FROM categories');
      categoriesCount = Number(catRes[0]?.c || 0);
    } else {
      productsCount = (sqliteDb.prepare('SELECT COUNT(*) as c FROM products').get() as any)?.c || 0;
      categoriesCount = (sqliteDb.prepare('SELECT COUNT(*) as c FROM categories').get() as any)?.c || 0;
    }

    res.json({
      engine: isPg ? 'neon_postgresql' : 'local_sqlite',
      neon_connected: isPg && dbDetails?.connected,
      neon_details: dbDetails,
      catalogue: {
        products_count: productsCount,
        categories_count: categoriesCount,
      },
      server_time: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sync/pull
 * Récupère les données delta depuis le timestamp `since`
 */
router.get('/pull', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const since = req.query.since as string;
    const sinceDate = since ? new Date(since) : new Date(0);
    const isPg = isNeonActive();

    let products: any[] = [];
    let categories: any[] = [];
    let cashRegisters: any[] = [];
    let settings: any[] = [];

    if (isPg) {
      products = await dbAdapter.query(`
        SELECT p.*, c.name as category_name 
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.updated_at >= $1 OR p.created_at >= $1
        ORDER BY p.name ASC
      `, [sinceDate]);

      categories = await dbAdapter.query(`
        SELECT * FROM categories 
        WHERE updated_at >= $1 OR created_at >= $1 
        ORDER BY name ASC
      `, [sinceDate]);

      cashRegisters = await dbAdapter.query(`
        SELECT * FROM cash_registers WHERE is_active = 1
      `);

      settings = await dbAdapter.query(`SELECT key, value FROM settings`);
    } else {
      // Mode SQLite
      products = sqliteDb.prepare(`
        SELECT p.*, c.name as category_name 
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE datetime(p.updated_at) >= datetime(?) OR datetime(p.created_at) >= datetime(?)
        ORDER BY p.name ASC
      `).all(sinceDate.toISOString(), sinceDate.toISOString());

      categories = sqliteDb.prepare(`
        SELECT * FROM categories ORDER BY name ASC
      `).all();

      cashRegisters = sqliteDb.prepare(`
        SELECT * FROM cash_registers WHERE is_active = 1
      `).all();

      settings = sqliteDb.prepare(`SELECT key, value FROM settings`).all();
    }

    res.json({
      server_time: new Date().toISOString(),
      delta_count: {
        products: products.length,
        categories: categories.length,
      },
      products,
      categories,
      cash_registers: cashRegisters,
      settings
    });
  } catch (err: any) {
    console.error('[SYNC-PULL] Erreur:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sync/push
 * Ingestion atomique et idempotente des mutations enregistrées hors-ligne
 */
router.post('/push', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { client_id, device_name, mutations } = req.body;

  if (!mutations || !Array.isArray(mutations)) {
    res.status(400).json({ error: 'Format invalide : mutations doit être un tableau.' });
    return;
  }

  const results: any[] = [];
  let appliedCount = 0;
  let conflictCount = 0;

  for (const mut of mutations) {
    const { mutation_id, entity_type, action, payload, timestamp } = mut;

    if (!mutation_id) {
      results.push({ status: 'rejected', error: 'mutation_id manquant' });
      continue;
    }

    try {
      const isPg = isNeonActive();

      // 1. Vérification d'idempotence (éviter les doublons de réémission réseau)
      if (isPg) {
        const existing = await dbAdapter.queryOne('SELECT id, status FROM sync_events WHERE mutation_id = ?', [mutation_id]);
        if (existing) {
          results.push({
            mutation_id,
            status: 'already_applied',
            message: 'Mutation déjà traitée précédemment.'
          });
          continue;
        }
      } else {
        const existing = sqliteDb.prepare('SELECT id, status FROM sync_events WHERE mutation_id = ?').get(mutation_id) as any;
        if (existing) {
          results.push({
            mutation_id,
            status: 'already_applied',
            message: 'Mutation déjà traitée précédemment.'
          });
          continue;
        }
      }

      // 2. Traitement selon l'entité
      if (entity_type === 'sale' && action === 'create') {
        const {
          sale_number,
          client_id: saleClientId,
          items,
          subtotal,
          discount,
          total_amount,
          amount_received,
          change_returned,
          payment_mode,
          cash_register_id,
          cash_session_id
        } = payload;

        let hasStockConflict = false;
        let conflictMessage = '';

        if (isPg) {
          // Exécution sur Neon PostgreSQL
          await dbAdapter.transaction(async (tx) => {
            for (const item of items) {
              const prodRows = await tx.query('SELECT id, name, stock_quantity, purchase_price FROM products WHERE id = $1', [item.product_id]);
              const currentProd = prodRows[0];
              if (currentProd) {
                if (Number(currentProd.stock_quantity) < item.quantity) {
                  hasStockConflict = true;
                  conflictMessage += `Stock insuffisant pour [${currentProd.name}] (disponible: ${currentProd.stock_quantity}, vendu hors-ligne: ${item.quantity}). `;
                }

                await tx.query(
                  'UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2',
                  [item.quantity, item.product_id]
                );

                await tx.query(`
                  INSERT INTO stock_movements (product_id, movement_type, quantity, previous_quantity, new_quantity, unit_cost, reason, reference_type, user_id)
                  VALUES ($1, 'sale', $2, $3, $4, $5, $6, 'sale', $7)
                `, [
                  item.product_id,
                  -item.quantity,
                  currentProd.stock_quantity,
                  currentProd.stock_quantity - item.quantity,
                  currentProd.purchase_price || 0,
                  `Vente hors-ligne synchronisée (${sale_number})`,
                  req.user?.id || 1
                ]);
              }
            }

            const saleRes = await tx.query(`
              INSERT INTO sales (
                sale_number, client_id, user_id, cash_session_id, cash_register_id,
                date, subtotal, discount, total_amount, amount_received, change_returned,
                payment_mode, status, notes, idempotency_key
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'completed', $13, $14)
              RETURNING id
            `, [
              sale_number,
              saleClientId || null,
              req.user?.id || 1,
              cash_session_id || null,
              cash_register_id || 1,
              timestamp || new Date().toISOString(),
              subtotal,
              discount || 0,
              total_amount,
              amount_received || total_amount,
              change_returned || 0,
              payment_mode || 'cash',
              `Synchronisé depuis ${device_name || 'Terminal client'}`,
              mutation_id
            ]);

            const newSaleId = saleRes[0]?.id;

            for (const item of items) {
              const prodRows = await tx.query('SELECT purchase_price FROM products WHERE id = $1', [item.product_id]);
              const unitCost = Number(prodRows[0]?.purchase_price || 0);
              const profit = (Number(item.unit_price) - unitCost) * Number(item.quantity);

              await tx.query(`
                INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost, total_price, profit)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
              `, [
                newSaleId,
                item.product_id,
                item.quantity,
                item.unit_price,
                unitCost,
                item.total_price || (item.unit_price * item.quantity),
                profit
              ]);
            }

            if (cash_register_id) {
              await tx.query('UPDATE cash_registers SET balance = balance + $1 WHERE id = $2', [
                total_amount,
                cash_register_id
              ]);
            }

            await tx.query(`
              INSERT INTO sync_events (client_id, device_name, mutation_id, entity_type, action, status, conflict_details)
              VALUES ($1, $2, $3, 'sale', 'create', $4, $5)
            `, [
              client_id || 'unknown_device',
              device_name || 'Terminal',
              mutation_id,
              hasStockConflict ? 'conflict_logged' : 'applied',
              hasStockConflict ? conflictMessage : null
            ]);
          });
        }

        // Réplication locale SQLite si base locale présente
        try {
          const insertSaleTx = sqliteDb.transaction(() => {
            for (const item of items) {
              const currentProd = sqliteDb.prepare('SELECT id, name, stock_quantity, purchase_price FROM products WHERE id = ?').get(item.product_id) as any;
              if (currentProd) {
                if (!isPg && currentProd.stock_quantity < item.quantity) {
                  hasStockConflict = true;
                  conflictMessage += `Stock insuffisant pour [${currentProd.name}]. `;
                }
                sqliteDb.prepare('UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                  .run(item.quantity, item.product_id);
                sqliteDb.prepare(`
                  INSERT INTO stock_movements (product_id, movement_type, quantity, previous_quantity, new_quantity, unit_cost, reason, reference_type, user_id)
                  VALUES (?, 'sale', ?, ?, ?, ?, ?, 'sale', ?)
                `).run(
                  item.product_id,
                  -item.quantity,
                  currentProd.stock_quantity,
                  currentProd.stock_quantity - item.quantity,
                  currentProd.purchase_price || 0,
                  `Vente hors-ligne synchronisée (${sale_number})`,
                  req.user?.id || 1
                );
              }
            }

            const saleStmt = sqliteDb.prepare(`
              INSERT OR REPLACE INTO sales (
                sale_number, client_id, user_id, cash_session_id, cash_register_id,
                date, subtotal, discount, total_amount, amount_received, change_returned,
                payment_mode, status, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
            `);
            const saleRes = saleStmt.run(
              sale_number,
              saleClientId || null,
              req.user?.id || 1,
              cash_session_id || null,
              cash_register_id || 1,
              timestamp || new Date().toISOString(),
              subtotal,
              discount || 0,
              total_amount,
              amount_received || total_amount,
              change_returned || 0,
              payment_mode || 'cash',
              `Synchronisé depuis ${device_name || 'Terminal client'}`
            );

            const newSaleId = saleRes.lastInsertRowid;
            const itemStmt = sqliteDb.prepare(`
              INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost, total_price, profit)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            for (const item of items) {
              const currentProd = sqliteDb.prepare('SELECT purchase_price FROM products WHERE id = ?').get(item.product_id) as any;
              const unitCost = currentProd?.purchase_price || 0;
              const profit = (item.unit_price - unitCost) * item.quantity;
              itemStmt.run(newSaleId, item.product_id, item.quantity, item.unit_price, unitCost, item.total_price || (item.unit_price * item.quantity), profit);
            }

            if (cash_register_id) {
              sqliteDb.prepare('UPDATE cash_registers SET balance = balance + ? WHERE id = ?').run(total_amount, cash_register_id);
            }

            sqliteDb.prepare(`
              INSERT OR REPLACE INTO sync_events (client_id, device_name, mutation_id, entity_type, action, status, conflict_details)
              VALUES (?, ?, ?, 'sale', 'create', ?, ?)
            `).run(
              client_id || 'unknown_device',
              device_name || 'Terminal',
              mutation_id,
              hasStockConflict ? 'conflict_logged' : 'applied',
              hasStockConflict ? conflictMessage : null
            );
          });
          insertSaleTx();
        } catch (sqliteErr) {
          if (!isPg) throw sqliteErr;
        }

        if (hasStockConflict) {
          conflictCount++;
          logAudit(
            req.user?.id || 1,
            req.user?.fullName || 'Client Hors-Ligne',
            'SYNC_STOCK_CONFLICT',
            'sale',
            null,
            `Alerte survente hors-ligne détectée : ${conflictMessage} (Vente: ${sale_number})`
          );
        }

        appliedCount++;
        results.push({
          mutation_id,
          status: hasStockConflict ? 'applied_with_conflict' : 'applied',
          warning: hasStockConflict ? conflictMessage : undefined
        });
      } else {
        // Autres mutations génériques
        if (isPg) {
          await dbAdapter.execute(
            'INSERT INTO sync_events (client_id, device_name, mutation_id, entity_type, action, status) VALUES (?, ?, ?, ?, ?, ?)',
            [client_id, device_name, mutation_id, entity_type, action, 'applied']
          );
        }
        try {
          sqliteDb.prepare(`
            INSERT INTO sync_events (client_id, device_name, mutation_id, entity_type, action, status)
            VALUES (?, ?, ?, ?, ?, 'applied')
          `).run(client_id, device_name, mutation_id, entity_type, action);
        } catch {}

        appliedCount++;
        results.push({ mutation_id, status: 'applied' });
      }
    } catch (mutErr: any) {
      console.error(`[SYNC-PUSH] Erreur mutation ${mutation_id}:`, mutErr);
      results.push({
        mutation_id,
        status: 'error',
        error: mutErr.message
      });
    }
  }

  res.json({
    summary: {
      total: mutations.length,
      applied: appliedCount,
      conflicts: conflictCount,
      server_time: new Date().toISOString()
    },
    results
  });
});

export default router;
