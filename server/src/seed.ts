import bcrypt from 'bcryptjs';
import db, { logAudit } from './database.js';

export function cleanAllPredefinedData(keepCategories = false) {
  console.log('--- Nettoyage complet des données prédéfinies ---');
  db.exec('PRAGMA foreign_keys = OFF;');

  const tables = [
    'sale_items', 'sales', 'purchase_items', 'purchases',
    'stock_movements', 'money_transfers', 'financial_movements',
    'cash_sessions', 'inventory_audit_items', 'inventory_audits',
    'products', 'clients', 'suppliers', 'audit_logs'
  ];

  if (!keepCategories) {
    tables.push('categories');
  }

  for (const table of tables) {
    db.exec(`DELETE FROM ${table};`);
    db.exec(`DELETE FROM sqlite_sequence WHERE name='${table}';`);
  }

  // Ensure cash registers exist with balance = 0
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
  } else {
    db.exec('UPDATE cash_registers SET balance = 0;');
  }

  // Ensure default users exist
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count;
  if (!userCount || userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, phone, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    const salt = bcrypt.genSaltSync(10);
    insertUser.run('admin', bcrypt.hashSync('admin123', salt), 'Elhadj Seydou Diallo', 'admin', '+224 622 00 11 22');
    insertUser.run('gerant', bcrypt.hashSync('gerant123', salt), 'Mamadou Alpha Barry', 'manager', '+224 628 33 44 55');
    insertUser.run('caissier', bcrypt.hashSync('caissier123', salt), 'Fatoumata Binta Camara', 'cashier', '+224 621 77 88 99');
    insertUser.run('stock', bcrypt.hashSync('stock123', salt), 'Ibrahima Sory Soumah', 'stock_manager', '+224 624 55 66 77');
  }

  db.exec('PRAGMA foreign_keys = ON;');
  console.log('Toutes les données prédéfinies ont été purgées avec succès.');
}

export function seedDatabase(isCleanOnly = false) {
  console.log('--- Initialisation / Nettoyage de la base de données ---');

  // Disable FK during cleanup
  db.exec('PRAGMA foreign_keys = OFF;');

  const tables = [
    'sale_items', 'sales', 'purchase_items', 'purchases',
    'stock_movements', 'money_transfers', 'financial_movements',
    'cash_sessions', 'cash_registers', 'inventory_audit_items',
    'inventory_audits', 'products', 'categories', 'suppliers',
    'clients', 'users', 'audit_logs', 'settings'
  ];

  for (const table of tables) {
    db.exec(`DELETE FROM ${table};`);
    db.exec(`DELETE FROM sqlite_sequence WHERE name='${table}';`);
  }

  db.exec('PRAGMA foreign_keys = ON;');

  if (isCleanOnly) {
    console.log('Base de données réinitialisée à blanc avec succès.');
    return;
  }

  console.log('Insertion des données de démonstration guinéennes...');

  // 1. Settings
  const insertSetting = db.prepare('INSERT INTO settings (key, value, description) VALUES (?, ?, ?)');
  insertSetting.run('currency', 'GNF', 'Devise par défaut de la boutique');
  insertSetting.run('boutique_name', 'Boutique Cosmétique & Hygiène Seydou', 'Nom commercial de la boutique');
  insertSetting.run('boutique_phone', '+224 622 45 88 90', 'Téléphone principal de la boutique');
  insertSetting.run('boutique_address', 'Marché Madina, Carrefour Enco 5, Conakry, Guinée', 'Adresse physique');
  insertSetting.run('tax_rate', '0', 'Taux de TVA (0% en régime simplifié)');

  // 2. Users
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, phone, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  const salt = bcrypt.genSaltSync(10);
  const hashAdmin = bcrypt.hashSync('admin123', salt);
  const hashManager = bcrypt.hashSync('gerant123', salt);
  const hashCashier = bcrypt.hashSync('caissier123', salt);
  const hashStock = bcrypt.hashSync('stock123', salt);

  insertUser.run('admin', hashAdmin, 'Elhadj Seydou Diallo', 'admin', '+224 622 00 11 22');
  insertUser.run('gerant', hashManager, 'Mamadou Alpha Barry', 'manager', '+224 628 33 44 55');
  insertUser.run('caissier', hashCashier, 'Fatoumata Binta Camara', 'cashier', '+224 621 77 88 99');
  insertUser.run('stock', hashStock, 'Ibrahima Sory Soumah', 'stock_manager', '+224 624 55 66 77');

  // 3. Predefined Categories (as requested in prompt)
  const categoriesList = [
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

  const insertCategory = db.prepare('INSERT INTO categories (name, description, icon) VALUES (?, ?, ?)');
  for (const cat of categoriesList) {
    insertCategory.run(cat.name, cat.desc, cat.icon);
  }

  // 4. Suppliers (Fournisseurs guinéens)
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (name, company_name, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertSupplier.run('Alpha Bah', 'Import-Export Beauté Guinée SARL', '+224 622 10 20 30', 'contact@beaute-guinee.com', 'Grand Marché Madina, Conakry', 'Fournisseur principal de crèmes Mixa, Nivea et savons');
  insertSupplier.run('Ousmane Cherif', 'Comptoir Parfumerie de Kaloum', '+224 628 45 67 89', 'cherif@parfum-kaloum.gn', 'Avenue de la République, Kaloum, Conakry', 'Parfums originaux de Dubaï et France');
  insertSupplier.run('Hadja Mariama Diallo', 'Coopérative Karité & Bio de Haute-Guinée', '+224 620 11 22 33', 'karite.bio@gmail.com', 'Kankan / Dépôt Madina, Conakry', 'Beurre de karité 100% naturel et savons noirs artisanaux');

  // 5. Clients
  const insertClient = db.prepare(`
    INSERT INTO clients (name, phone, address, credit_limit, current_debt, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertClient.run('Aïssatou Diallo', '+224 621 34 56 78', 'Kipé Dadya, Ratoma', 500000, 150000, 'Cliente fidèle, salon de coiffure');
  insertClient.run('Dr. Mohamed Touré', '+224 624 88 99 00', 'Camayenne, Dixinn', 1000000, 0, 'Pharmacie partenaire');
  insertClient.run('Mariama Kaba', '+224 623 55 66 77', 'Matam Lido', 300000, 75000, 'Achat régulier produits pour bébés');
  insertClient.run('Salématou Baldé', '+224 629 12 34 56', 'Cosa Rond-point', 200000, 0, 'Cliente particulière');

  // 6. Cash Registers (Caisses et portefeuilles Mobile Money)
  const insertRegister = db.prepare(`
    INSERT INTO cash_registers (name, type, balance, phone_number, notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertRegister.run('Caisse Principale (Espèces)', 'cash', 2500000, null, 'Caisse physique du comptoir');
  insertRegister.run('Orange Money Boutique', 'orange_money', 3850000, '+224 622 99 88 77', 'Compte marchand OM pour dépôts et retraits');
  insertRegister.run('MTN Mobile Money Boutique', 'mtn_momo', 2100000, '+224 664 11 22 33', 'Compte marchand MoMo');
  insertRegister.run('Coffre-Fort Réserve', 'bank', 5000000, null, 'Réserve d\'urgence et liquidité patron');

  // 7. Products
  const insertProduct = db.prepare(`
    INSERT INTO products (
      code, name, category_id, brand, description, supplier_id,
      purchase_price, sale_price, stock_quantity, alert_threshold,
      expiry_date, batch_number, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sampleProducts = [
    { code: 'PRD-MIX-400', name: 'Lait Mixa Intensif Peau Sèche 400ml', catId: 3, brand: 'Mixa', desc: 'Lait réparateur peaux extra-sèches au beurre de karité', supId: 1, pPrice: 35000, sPrice: 48000, qty: 34, alert: 8, exp: '2027-06-30', batch: 'MX-2024-09' },
    { code: 'PRD-NIV-250', name: 'Crème Nivea Boîte Bleue 250ml', catId: 3, brand: 'Nivea', desc: 'Hydratation intense multi-usage visage et corps', supId: 1, pPrice: 24000, sPrice: 35000, qty: 45, alert: 10, exp: '2027-12-31', batch: 'NV-2024-11' },
    { code: 'PRD-DUD-150', name: 'Savon Noir Dudu Osun Naturel 150g', catId: 4, brand: 'Dudu Osun', desc: 'Savon artisanal purifiant à l’aloe vera et citron', supId: 3, pPrice: 12000, sPrice: 18000, qty: 80, alert: 15, exp: '2028-01-01', batch: 'DO-2025-01' },
    { code: 'PRD-PAL-500', name: 'Gel Douche Palmolive Miel & Lait 500ml', catId: 4, brand: 'Palmolive', desc: 'Gel douche soyeux hydratant', supId: 1, pPrice: 28000, sPrice: 38000, qty: 22, alert: 6, exp: '2026-11-30', batch: 'PL-2024-08' },
    { code: 'PRD-BLE-100', name: 'Eau de Parfum Bleu Intense 100ml', catId: 2, brand: 'Lattafa Perfumes', desc: 'Senteur boisée ambrée longue tenue', supId: 2, pPrice: 130000, sPrice: 195000, qty: 12, alert: 4, exp: '2029-05-01', batch: 'LT-8890' },
    { code: 'PRD-GAR-300', name: 'Shampoing Ultra Doux Garnier Huile d’Avocat 300ml', catId: 5, brand: 'Garnier', desc: 'Nutrition intense pour cheveux secs ou frisés', supId: 1, pPrice: 30000, sPrice: 42000, qty: 28, alert: 8, exp: '2027-04-15', batch: 'GA-2024-10' },
    { code: 'PRD-REX-050', name: 'Déodorant Roll-On Rexona Invisible 50ml', catId: 8, brand: 'Rexona', desc: 'Anti-traces blanches et jaunes protection 48h', supId: 1, pPrice: 18000, sPrice: 26000, qty: 55, alert: 12, exp: '2027-08-20', batch: 'RX-2024-12' },
    { code: 'PRD-MOL-T04', name: 'Couches Bébé Molfix Maxi Taille 4 (Paquet de 30)', catId: 9, brand: 'Molfix', desc: 'Absorption ultra rapide système anti-fuites', supId: 1, pPrice: 72000, sPrice: 92000, qty: 4, alert: 10, exp: '2028-10-01', batch: 'MF-2024-07' }, // Stock faible alert!
    { code: 'PRD-ROU-MAT', name: 'Rouge à Lèvres Mat Longue Tenue Shade Ruby', catId: 1, brand: 'Maybelline', desc: 'Fini mat velouté sans transfert tenue 16h', supId: 2, pPrice: 20000, sPrice: 32000, qty: 18, alert: 5, exp: '2027-03-31', batch: 'MB-2024-03' },
    { code: 'PRD-KAR-250', name: 'Beurre de Karité Pur Non Raffiné 250g', catId: 6, brand: 'Bio Guinée', desc: '100% naturel pressé à froid de Mandiana', supId: 3, pPrice: 14000, sPrice: 22000, qty: 65, alert: 10, exp: '2028-06-30', batch: 'BK-2025-02' },
    { code: 'PRD-SAU-200', name: 'Soin Lavant Intime Saugel 200ml', catId: 7, brand: 'Saugel', desc: 'Formule apaisante au pH physiologique 5.2', supId: 1, pPrice: 25000, sPrice: 37000, qty: 0, alert: 6, exp: '2026-10-20', batch: 'SG-2023-11' }, // Rupture de stock!
    { code: 'PRD-PIN-SET', name: 'Kit 12 Pinceaux de Maquillage Pro + Trousse', catId: 10, brand: 'BeautyTools', desc: 'Poils ultra-doux haute densité avec étui similicuir', supId: 2, pPrice: 45000, sPrice: 70000, qty: 14, alert: 4, exp: null, batch: 'BT-902' },
    { code: 'PRD-DIS-COT', name: 'Disques de Coton Démaquillant 100 pcs', catId: 11, brand: 'SoftCare', desc: '100% pur coton doux et absorbant', supId: 1, pPrice: 9000, sPrice: 15000, qty: 3, alert: 8, exp: null, batch: 'SC-100' } // Stock faible
  ];

  for (const p of sampleProducts) {
    insertProduct.run(
      p.code, p.name, p.catId, p.brand, p.desc, p.supId,
      p.pPrice, p.sPrice, p.qty, p.alert, p.exp, p.batch, null
    );
  }

  // 8. Open Cash Session for today
  const insertSession = db.prepare(`
    INSERT INTO cash_sessions (
      cash_register_id, user_id, opening_time, opening_float,
      theoretical_balance, actual_balance, status, notes
    ) VALUES (1, 3, datetime('now', '-4 hours'), 500000, 500000, null, 'open', 'Session du matin - Caisse 1')
  `);
  insertSession.run();

  // 9. Initial purchases and stock movements
  const insertStockMvt = db.prepare(`
    INSERT INTO stock_movements (
      product_id, movement_type, quantity, previous_quantity,
      new_quantity, unit_cost, reason, reference_type, reference_id, user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))
  `);

  for (let i = 1; i <= sampleProducts.length; i++) {
    const prod = sampleProducts[i - 1];
    insertStockMvt.run(
      i, 'reception', prod.qty + 5, 0, prod.qty + 5, prod.pPrice,
      'Approvisionnement initial stock de rentrée', 'purchase', 1, 4
    );
  }

  // 10. Sample Sales
  const insertSale = db.prepare(`
    INSERT INTO sales (
      sale_number, client_id, user_id, cash_session_id, cash_register_id,
      date, subtotal, discount, total_amount, amount_received,
      change_returned, payment_mode, status, notes, created_at
    ) VALUES (?, ?, ?, 1, 1, datetime('now', ?), ?, ?, ?, ?, ?, ?, 'completed', ?, datetime('now', ?))
  `);

  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost, total_price, profit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Sale 1
  insertSale.run('VTE-2026-001', 1, 3, '-3 hours', 96000, 0, 96000, 100000, 4000, 'cash', 'Vente comptoir régulière', '-3 hours');
  insertSaleItem.run(1, 1, 2, 48000, 35000, 96000, 26000); // 2 Mixa

  // Sale 2 (Mobile Money)
  insertSale.run('VTE-2026-002', null, 3, '-2 hours', 195000, 5000, 190000, 190000, 0, 'orange_money', 'Paiement direct Orange Money', '-2 hours');
  insertSaleItem.run(2, 5, 1, 195000, 130000, 195000, 60000); // 1 Parfum

  // Sale 3 (Credit sale to Mariama Kaba)
  insertSale.run('VTE-2026-003', 3, 3, '-1 hours', 75000, 0, 75000, 0, 0, 'credit', 'Vente à crédit accordée', '-1 hours');
  insertSaleItem.run(3, 3, 3, 18000, 12000, 54000, 18000);
  insertSaleItem.run(3, 10, 1, 22000, 14000, 21000, 7000);

  // 11. Sample Money Transfers (Orange Money / MTN MoMo)
  const insertTransfer = db.prepare(`
    INSERT INTO money_transfers (
      transfer_number, type, client_name, client_phone, amount,
      service, client_fee, boutique_commission, transaction_ref,
      cash_register_id, cash_desk_id, user_id, status, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 3, 'validated', ?, datetime('now', ?))
  `);

  // Deposit 1: Client deposits 500 000 GNF via Orange Money (gives 500 000 cash, shop sends 500k OM, fee 5000, commission 2500)
  insertTransfer.run(
    'TRF-2026-001', 'deposit', 'Thierno Oumar Barry', '+224 621 12 34 56', 500000,
    'orange_money', 5000, 2500, 'OM-GN-9823412', 2, 'Dépôt cash client vers OM', '-3 hours'
  );

  // Withdrawal 1: Client withdraws 300 000 GNF via MTN MoMo (transfers 300k MoMo, shop hands cash, fee 3000, commission 1500)
  insertTransfer.run(
    'TRF-2026-002', 'withdrawal', 'Kadiatou Camara', '+224 664 77 88 99', 300000,
    'mtn_momo', 3000, 1500, 'MOMO-GN-556102', 3, 'Retrait espèces par MoMo', '-1.5 hours'
  );

  // 12. Financial Movements (Inflows, Outflows, Expenses)
  const insertFinMvt = db.prepare(`
    INSERT INTO financial_movements (
      movement_number, type, is_inflow, cash_register_id, target_register_id,
      amount, date, category, description, reference_type, reference_id, user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?), ?, ?, ?, ?, 2, datetime('now', ?))
  `);

  insertFinMvt.run('FIN-2026-001', 'electricity', 0, 1, null, 150000, '-4 hours', 'Électricité', 'Recharge compteur prépayé EDG Boutique', null, null, '-4 hours');
  insertFinMvt.run('FIN-2026-002', 'operating_expense', 0, 1, null, 30000, '-3 hours', 'Frais de fonctionnement', 'Achat sachets plastiques d’emballage personnalisés', null, null, '-3 hours');
  insertFinMvt.run('FIN-2026-003', 'commission_income', 1, 2, null, 4000, '-1.5 hours', 'Commissions Mobile Money', 'Commissions cumulées sur services financiers OM & MoMo', 'money_transfer', 1, '-1.5 hours');

  // Inter-register transfer (transfer from Cash to Orange Money account to replenish OM liquidity)
  insertFinMvt.run('FIN-2026-004', 'register_transfer', 2, 1, 2, 500000, '-2.5 hours', 'Transfert inter-caisses', 'Alimentation du compte marchand Orange Money depuis la caisse espèces', null, null, '-2.5 hours');

  // 13. Audit Log Entries
  logAudit(1, 'Elhadj Seydou Diallo', 'INITIALIZATION', 'system', null, 'Initialisation complète du système Seydou Boutique avec données de démonstration guinéennes.');
  logAudit(3, 'Fatoumata Binta Camara', 'OPEN_REGISTER', 'cash_session', 1, 'Ouverture de caisse avec fonds initial de 500 000 GNF.');

  console.log('--- Initialisation terminée avec succès ! ---');
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase();
}
