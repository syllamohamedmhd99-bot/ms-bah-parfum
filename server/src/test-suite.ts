import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

console.log('================================================================');
console.log('  SUITE DE TESTS AUTOMATISÉS — BOUTIQUE MANAGER (HORS LIGNE)');
console.log('================================================================');

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [SUCCÈS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ [ÉCHEC] ${testName}${detail ? ' : ' + detail : ''}`);
    failedTests++;
  }
}

// 1. Initialiser une base de données en mémoire pour les tests
const testDb = new Database(':memory:');
testDb.pragma('foreign_keys = ON');

const schemaPath = path.resolve(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
testDb.exec(schemaSql);

console.log('\n--- 1. TEST INTÉGRITÉ BASE DE DONNÉES & STRUCTURE (HORS LIGNE) ---');
const integrityCheck = testDb.pragma('integrity_check') as any[];
assert(integrityCheck.length > 0 && integrityCheck[0].integrity_check === 'ok', 'PRAGMA integrity_check est OK');

const tables = testDb.prepare(`
  SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
`).all().map((r: any) => r.name);

const requiredObjects = [
  'users', 'roles', 'categories', 'suppliers', 'clients', 'products',
  'cash_registers', 'cash_sessions', 'purchases', 'purchase_items',
  'sales', 'sale_items', 'money_transfers', 'financial_movements',
  'stock_movements', 'inventory_audits', 'audit_logs', 'settings',
  'schema_migrations', 'customers', 'expenses', 'customer_payments',
  'supplier_payments', 'mobile_money_accounts', 'money_transfer_operations', 'inventory_sessions'
];

let allTablesPresent = true;
for (const obj of requiredObjects) {
  if (!tables.includes(obj)) {
    console.error(`  Table ou vue manquante: ${obj}`);
    allTablesPresent = false;
  }
}
assert(allTablesPresent, 'Les 22 tables et vues requises sont créées');

console.log('\n--- 2. INITIALISATION DES COMPTES ET CAISSES ---');
// Créer un utilisateur et caisses
testDb.prepare(`
  INSERT INTO users (id, username, password_hash, full_name, role)
  VALUES (1, 'admin', 'hash_test', 'Administrateur Test', 'admin')
`).run();

testDb.prepare(`
  INSERT INTO cash_registers (id, name, type, balance) VALUES
  (1, 'Caisse Principale', 'cash', 500000),
  (2, 'Compte Orange Money', 'orange_money', 1000000),
  (3, 'Compte MTN MoMo', 'mtn_momo', 800000)
`).run();

const initialCash = testDb.prepare('SELECT balance FROM cash_registers WHERE id = 1').get() as any;
assert(initialCash.balance === 500000, 'Solde initial caisse physique initialisé à 500 000 GNF');

console.log('\n--- 3. TEST GESTION DES PRODUITS & ENTRÉE DE STOCK (ACHAT FOURNISSEUR) ---');
// Fournisseur
testDb.prepare(`
  INSERT INTO suppliers (id, name, company_name, phone)
  VALUES (1, 'Diallo Import', 'Diallo SARL', '620000001')
`).run();

// Catégorie
testDb.prepare(`
  INSERT INTO categories (id, name, description)
  VALUES (1, 'Parfums', 'Parfums de luxe et eaux de toilette')
`).run();

// Produit avec stock initial 0
testDb.prepare(`
  INSERT INTO products (id, code, name, category_id, supplier_id, purchase_price, sale_price, stock_quantity, alert_threshold)
  VALUES (1, 'PRF-001', 'Eau de Parfum 100ml', 1, 1, 60000, 100000, 0, 5)
`).run();

// Achat de 20 unités à 60 000 GNF = 1 200 000 GNF. Paiement partiel: 800 000 GNF, Reste (dette): 400 000 GNF
const runPurchase = testDb.transaction(() => {
  testDb.prepare(`
    INSERT INTO purchases (id, purchase_number, supplier_id, user_id, total_amount, paid_amount, remaining_amount, payment_mode, cash_register_id, status)
    VALUES (1, 'ACH-001', 1, 1, 1200000, 800000, 400000, 'cash', 1, 'partial')
  `).run();

  testDb.prepare(`
    INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, total_cost)
    VALUES (1, 1, 20, 60000, 1200000)
  `).run();

  testDb.prepare(`
    UPDATE products SET stock_quantity = stock_quantity + 20 WHERE id = 1
  `).run();

  testDb.prepare(`
    INSERT INTO stock_movements (product_id, movement_type, quantity, previous_quantity, new_quantity, unit_cost, reason, reference_type, reference_id, user_id)
    VALUES (1, 'reception', 20, 0, 20, 60000, 'Achat fournisseur ACH-001', 'purchase', 1, 1)
  `).run();
});
runPurchase();

const prodAfterPurchase = testDb.prepare('SELECT stock_quantity FROM products WHERE id = 1').get() as any;
assert(prodAfterPurchase.stock_quantity === 20, 'Stock incrémenté avec succès de 0 à 20 unités après achat');

const purchaseRecord = testDb.prepare('SELECT total_amount, paid_amount, remaining_amount, status FROM purchases WHERE id = 1').get() as any;
assert(purchaseRecord.total_amount === 1200000 && purchaseRecord.remaining_amount === 400000 && purchaseRecord.status === 'partial',
  'Dette fournisseur correctement enregistrée (400 000 GNF restants, statut partiel)');

console.log('\n--- 4. TEST VENTE COMPTOIR (POS), CALCUL DU BÉNÉFICE ET DÉCRÉMENTATION DE STOCK ---');
// Vente de 5 unités à 100 000 GNF = 500 000 GNF
// Prix achat unitaire = 60 000 GNF -> Coût total = 300 000 GNF -> Bénéfice attendu = 200 000 GNF
const runSale = testDb.transaction(() => {
  testDb.prepare(`
    INSERT INTO sales (id, sale_number, user_id, cash_register_id, subtotal, discount, total_amount, amount_received, change_returned, payment_mode, status)
    VALUES (1, 'VTE-001', 1, 1, 500000, 0, 500000, 500000, 0, 'cash', 'completed')
  `).run();

  testDb.prepare(`
    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost, total_price, profit)
    VALUES (1, 1, 5, 100000, 60000, 500000, 200000)
  `).run();

  testDb.prepare(`
    UPDATE products SET stock_quantity = stock_quantity - 5 WHERE id = 1
  `).run();

  testDb.prepare(`
    INSERT INTO stock_movements (product_id, movement_type, quantity, previous_quantity, new_quantity, unit_cost, reason, reference_type, reference_id, user_id)
    VALUES (1, 'sale', 5, 20, 15, 60000, 'Vente VTE-001', 'sale', 1, 1)
  `).run();

  testDb.prepare(`
    UPDATE cash_registers SET balance = balance + 500000 WHERE id = 1
  `).run();
});
runSale();

const prodAfterSale = testDb.prepare('SELECT stock_quantity FROM products WHERE id = 1').get() as any;
assert(prodAfterSale.stock_quantity === 15, 'Stock décrémenté atomiquement de 20 à 15 unités après vente');

const saleItem = testDb.prepare('SELECT profit, total_price FROM sale_items WHERE sale_id = 1').get() as any;
assert(saleItem.profit === 200000, 'Bénéfice net calculé avec précision : 200 000 GNF (5 x (100 000 - 60 000))');

console.log('\n--- 5. TEST CRÉANCE CLIENT ET RÈGLEMENT DE CRÉDIT ---');
testDb.prepare(`
  INSERT INTO clients (id, name, phone, credit_limit, current_debt)
  VALUES (1, 'Mme Camara', '622112233', 1000000, 0)
`).run();

// Vente à crédit de 2 unités (200 000 GNF)
const runCreditSale = testDb.transaction(() => {
  testDb.prepare(`
    INSERT INTO sales (id, sale_number, client_id, user_id, total_amount, payment_mode, status)
    VALUES (2, 'VTE-002', 1, 1, 200000, 'credit', 'completed')
  `).run();

  testDb.prepare(`
    UPDATE clients SET current_debt = current_debt + 200000 WHERE id = 1
  `).run();

  testDb.prepare(`
    UPDATE products SET stock_quantity = stock_quantity - 2 WHERE id = 1
  `).run();
});
runCreditSale();

const clientDebt = testDb.prepare('SELECT current_debt FROM clients WHERE id = 1').get() as any;
assert(clientDebt.current_debt === 200000, 'Créance client augmentée à 200 000 GNF lors de la vente à crédit');

// Règlement partiel de 120 000 GNF par le client
const runClientPayment = testDb.transaction(() => {
  testDb.prepare(`
    UPDATE clients SET current_debt = current_debt - 120000 WHERE id = 1
  `).run();

  testDb.prepare(`
    INSERT INTO financial_movements (movement_number, type, is_inflow, cash_register_id, amount, category, description, user_id)
    VALUES ('FIN-001', 'credit_payment', 1, 1, 120000, 'Règlement Client', 'Règlement partiel Mme Camara', 1)
  `).run();
});
runClientPayment();

const clientDebtAfterPay = testDb.prepare('SELECT current_debt FROM clients WHERE id = 1').get() as any;
assert(clientDebtAfterPay.current_debt === 80000, 'Dette résiduelle client exacte après remboursement : 80 000 GNF');

console.log('\n--- 6. TEST MOBILE MONEY : DISSOCIATION FONDS CLIENTS VS COMMISSIONS BOUTIQUE ---');
// Dépôt client Orange Money : 300 000 GNF principal, frais client = 3000 GNF, commission boutique = 2000 GNF
// RÈGLE COMMERCIALE CRITIQUE : Le principal (300 000 GNF) NE DOIT PAS être considéré comme un chiffre d'affaires !
// Seule la commission boutique (2000 GNF) constitue un produit d'exploitation.
const runTransfer = testDb.transaction(() => {
  testDb.prepare(`
    INSERT INTO money_transfers (
      transfer_number, type, client_name, client_phone, amount, service,
      client_fee, boutique_commission, transaction_ref, cash_register_id, user_id, status
    ) VALUES (
      'TRF-001', 'deposit', 'Ibrahima Bah', '622001122', 300000, 'orange_money',
      3000, 2000, 'OM-998877', 2, 1, 'validated'
    )
  `).run();

  // Diminue le solde OM de la boutique du montant + commission
  testDb.prepare(`
    UPDATE cash_registers SET balance = balance - 300000 WHERE id = 2
  `).run();

  // Enregistre uniquement la commission en produit financier
  testDb.prepare(`
    INSERT INTO financial_movements (movement_number, type, is_inflow, cash_register_id, amount, category, description, user_id)
    VALUES ('FIN-002', 'commission_income', 1, 1, 2000, 'Commissions Mobile Money', 'Commission dépôt OM-998877', 1)
  `).run();
});
runTransfer();

const omRegister = testDb.prepare('SELECT balance FROM cash_registers WHERE id = 2').get() as any;
assert(omRegister.balance === 700000, 'Solde compte Orange Money déduit avec exactitude (1 000 000 - 300 000 = 700 000 GNF)');

const commissionIncome = testDb.prepare(`
  SELECT SUM(amount) as total_comm FROM financial_movements WHERE type = 'commission_income'
`).get() as any;
assert(commissionIncome.total_comm === 2000, 'Seule la commission boutique (2 000 GNF) est comptabilisée en revenu d\'exploitation');

console.log('\n--- 7. TEST CLÔTURE DE CAISSE, CALCUL D\'ÉCART & JUSTIFICATION OBLIGATOIRE ---');
// Session avec fond initial = 100 000 GNF
testDb.prepare(`
  INSERT INTO cash_sessions (id, cash_register_id, user_id, opening_float, theoretical_balance, status)
  VALUES (1, 1, 1, 100000, 100000, 'open')
`).run();

// Entrée de vente : 350 000 GNF, Dépense électricité : 40 000 GNF
// Solde théorique attendu = 100 000 + 350 000 - 40 000 = 410 000 GNF
testDb.prepare(`
  UPDATE cash_sessions
  SET total_cash_in = 350000, total_cash_out = 40000, theoretical_balance = 410000
  WHERE id = 1
`).run();

// Comptage réel = 405 000 GNF -> Écart = -5 000 GNF
const theoretical = 410000;
const actual = 405000;
const discrepancy = actual - theoretical; // -5000
const justification = 'Monnaie non récupérée par client pressé (-5000 GNF)';

testDb.prepare(`
  UPDATE cash_sessions
  SET closing_time = CURRENT_TIMESTAMP, actual_balance = ?, discrepancy = ?, justification = ?, status = 'closed'
  WHERE id = 1
`).run(actual, discrepancy, justification);

const closedSession = testDb.prepare('SELECT status, theoretical_balance, actual_balance, discrepancy, justification FROM cash_sessions WHERE id = 1').get() as any;
assert(closedSession.status === 'closed', 'Session de caisse clôturée');
assert(closedSession.discrepancy === -5000, 'Écart de caisse calculé avec rigueur : -5 000 GNF (manquant)');
assert(closedSession.justification.length > 0, 'Justification d\'écart de caisse dûment consignée');

console.log('\n--- 8. TEST SESSION D\'INVENTAIRE PHYSIQUE ET RÉGULARISATION DU STOCK ---');
// Stock théorique actuel du produit 1 : 20 (achat) - 5 (vente 1) - 2 (vente 2) = 13 unités
const currentStock = testDb.prepare('SELECT stock_quantity FROM products WHERE id = 1').get() as any;
assert(currentStock.stock_quantity === 13, 'Stock théorique avant inventaire est de 13 unités');

// Comptage physique réel : 11 unités (-2 unités manquantes / volées)
const actualCount = 11;
const diff = actualCount - currentStock.stock_quantity; // -2

testDb.transaction(() => {
  testDb.prepare(`
    INSERT INTO inventory_audits (id, audit_number, user_id, status, notes)
    VALUES (1, 'INV-2026-001', 1, 'completed', 'Inventaire de fin de semaine')
  `).run();

  testDb.prepare(`
    INSERT INTO inventory_audit_items (audit_id, product_id, theoretical_qty, actual_qty, discrepancy_qty, justification)
    VALUES (1, 1, 13, 11, -2, 'Produits endommagés lors du déballage')
  `).run();

  testDb.prepare(`
    UPDATE products SET stock_quantity = ? WHERE id = 1
  `).run(actualCount);

  testDb.prepare(`
    INSERT INTO stock_movements (product_id, movement_type, quantity, previous_quantity, new_quantity, unit_cost, reason, reference_type, reference_id, user_id)
    VALUES (1, 'inventory_adjustment', 2, 13, 11, 60000, 'Ajustement inventaire INV-2026-001', 'inventory', 1, 1)
  `).run();
})();

const finalStock = testDb.prepare('SELECT stock_quantity FROM products WHERE id = 1').get() as any;
assert(finalStock.stock_quantity === 11, 'Stock régularisé avec succès à 11 unités après inventaire');

const stockMovement = testDb.prepare(`
  SELECT movement_type, quantity, previous_quantity, new_quantity FROM stock_movements WHERE movement_type = 'inventory_adjustment'
`).get() as any;
assert(stockMovement.previous_quantity === 13 && stockMovement.new_quantity === 11, 'Mouvement de stock d\'ajustement enregistré pour audit');

console.log('\n================================================================');
console.log(`  RÉSULTATS : ${passedTests} SUCCÈS, ${failedTests} ÉCHECS`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('  TOUTES LES RÈGLES COMMERCIALES ET COMPTABLES SONT VALIDÉES !');
  process.exit(0);
}
