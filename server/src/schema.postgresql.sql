-- =======================================================
-- SCHEMA POSTGRESQL POUR NEON DATABASE
-- Application : MS BAH PARFUM (Boutique Manager en Ligne)
-- Devise : GNF (Nombres entiers stricts / NUMERIC(15,0))
-- Synchronisation : UUIDs, Idempotency, Versioning & Audit Trail
-- =======================================================

-- 1. UTILISATEURS ET COMPTES EMPLOYÉS
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK(role IN ('admin', 'manager', 'cashier', 'stock_manager')),
  phone VARCHAR(50),
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. CATÉGORIES DE PRODUITS
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  sync_uuid VARCHAR(36) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. FOURNISSEURS
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(100),
  address TEXT,
  notes TEXT,
  sync_uuid VARCHAR(36) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. CLIENTS ET CRÉANCES
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  credit_limit NUMERIC(15,0) DEFAULT 0,
  current_debt NUMERIC(15,0) DEFAULT 0,
  notes TEXT,
  sync_uuid VARCHAR(36) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. PRODUITS DU CATALOGUE (320+ ARTICLES MS BAH PARFUM)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  brand VARCHAR(150),
  description TEXT,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_price NUMERIC(15,0) NOT NULL DEFAULT 0,
  sale_price NUMERIC(15,0) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  alert_threshold INTEGER NOT NULL DEFAULT 5,
  expiry_date DATE,
  batch_number VARCHAR(100),
  image_url TEXT,
  is_archived SMALLINT NOT NULL DEFAULT 0,
  needs_completion SMALLINT NOT NULL DEFAULT 0,
  import_source VARCHAR(255),
  import_date TIMESTAMPTZ,
  sync_uuid VARCHAR(36) UNIQUE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

-- 6. CAISSES ET COMPTES FINANCIERS (ESPÈCES, OM, MOMO, BANQUE)
CREATE TABLE IF NOT EXISTS cash_registers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK(type IN ('cash', 'orange_money', 'mtn_momo', 'bank', 'other')),
  balance NUMERIC(15,0) NOT NULL DEFAULT 0,
  is_active SMALLINT NOT NULL DEFAULT 1,
  phone_number VARCHAR(50),
  notes TEXT,
  sync_uuid VARCHAR(36) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. SESSIONS DE CAISSE (OUVERTURE / CLÔTURE)
CREATE TABLE IF NOT EXISTS cash_sessions (
  id SERIAL PRIMARY KEY,
  cash_register_id INTEGER NOT NULL REFERENCES cash_registers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  opening_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closing_time TIMESTAMPTZ,
  opening_float NUMERIC(15,0) NOT NULL DEFAULT 0,
  total_cash_in NUMERIC(15,0) DEFAULT 0,
  total_cash_out NUMERIC(15,0) DEFAULT 0,
  theoretical_balance NUMERIC(15,0) NOT NULL DEFAULT 0,
  actual_balance NUMERIC(15,0),
  discrepancy NUMERIC(15,0),
  justification TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  notes TEXT,
  sync_uuid VARCHAR(36) UNIQUE
);

-- 8. ACHATS MARCHANDISES FOURNISSEURS
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  purchase_number VARCHAR(100) UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash' CHECK(payment_mode IN ('cash', 'orange_money', 'mtn_momo', 'bank', 'credit')),
  cash_register_id INTEGER REFERENCES cash_registers(id),
  invoice_number VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'partial', 'unpaid', 'cancelled')),
  notes TEXT,
  sync_uuid VARCHAR(36) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. LIGNES D'ACHATS
CREATE TABLE IF NOT EXISTS purchase_items (
  id SERIAL PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(15,0) NOT NULL,
  total_cost NUMERIC(15,0) NOT NULL,
  batch_number VARCHAR(100),
  expiry_date DATE
);

-- 10. VENTES COMPTOIR & REÇUS
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  sale_number VARCHAR(100) UNIQUE NOT NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  cash_session_id INTEGER REFERENCES cash_sessions(id) ON DELETE SET NULL,
  cash_register_id INTEGER REFERENCES cash_registers(id) ON DELETE SET NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  subtotal NUMERIC(15,0) NOT NULL DEFAULT 0,
  discount NUMERIC(15,0) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,0) NOT NULL DEFAULT 0,
  amount_received NUMERIC(15,0) NOT NULL DEFAULT 0,
  change_returned NUMERIC(15,0) NOT NULL DEFAULT 0,
  payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash' CHECK(payment_mode IN ('cash', 'orange_money', 'mtn_momo', 'mixed', 'credit')),
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'cancelled')),
  cancellation_reason TEXT,
  cancelled_by INTEGER REFERENCES users(id),
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  sync_uuid VARCHAR(36) UNIQUE,
  idempotency_key VARCHAR(100) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. ARTICLES VENDUS
CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(15,0) NOT NULL,
  unit_cost NUMERIC(15,0) NOT NULL,
  total_price NUMERIC(15,0) NOT NULL,
  profit NUMERIC(15,0) NOT NULL
);

-- 12. OPÉRATIONS MOBILE MONEY (ORANGE MONEY & MTN MOMO)
CREATE TABLE IF NOT EXISTS money_transfers (
  id SERIAL PRIMARY KEY,
  transfer_number VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL CHECK(type IN ('deposit', 'withdrawal')),
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(50) NOT NULL,
  amount NUMERIC(15,0) NOT NULL,
  service VARCHAR(50) NOT NULL CHECK(service IN ('orange_money', 'mtn_momo', 'other')),
  client_fee NUMERIC(15,0) NOT NULL DEFAULT 0,
  boutique_commission NUMERIC(15,0) NOT NULL DEFAULT 0,
  transaction_ref VARCHAR(100),
  cash_register_id INTEGER REFERENCES cash_registers(id),
  cash_desk_id INTEGER REFERENCES cash_registers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'validated' CHECK(status IN ('pending', 'validated', 'cancelled', 'error')),
  cancellation_reason TEXT,
  cancelled_by INTEGER REFERENCES users(id),
  notes TEXT,
  sync_uuid VARCHAR(36) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. MOUVEMENTS FINANCIERS & DÉPENSES
CREATE TABLE IF NOT EXISTS financial_movements (
  id SERIAL PRIMARY KEY,
  movement_number VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL CHECK(type IN (
    'sale_income', 'credit_payment', 'owner_contribution', 'commission_income', 'other_income',
    'purchase_expense', 'supplier_payment', 'rent', 'electricity', 'transport', 'salary',
    'operating_expense', 'owner_withdrawal', 'other_expense', 'register_transfer'
  )),
  is_inflow INTEGER NOT NULL,
  cash_register_id INTEGER NOT NULL REFERENCES cash_registers(id),
  target_register_id INTEGER REFERENCES cash_registers(id),
  amount NUMERIC(15,0) NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  category VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  reference_type VARCHAR(50),
  reference_id INTEGER,
  user_id INTEGER NOT NULL REFERENCES users(id),
  is_cancelled SMALLINT NOT NULL DEFAULT 0,
  cancellation_reason TEXT,
  cancelled_by INTEGER REFERENCES users(id),
  sync_uuid VARCHAR(36) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. MOUVEMENTS DE STOCKS (ENTRÉES, SORTIES, PERTES, INVENTAIRES)
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  movement_type VARCHAR(50) NOT NULL CHECK(movement_type IN (
    'reception', 'sale', 'damaged', 'expired', 'loss_theft', 'internal_use',
    'return_supplier', 'return_client', 'inventory_adjustment', 'transfer_in', 'transfer_out'
  )),
  quantity INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  unit_cost NUMERIC(15,0) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  reference_type VARCHAR(50),
  reference_id INTEGER,
  user_id INTEGER NOT NULL REFERENCES users(id),
  sync_uuid VARCHAR(36) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 15. AUDITS D'INVENTAIRE PHYSIQUE
CREATE TABLE IF NOT EXISTS inventory_audits (
  id SERIAL PRIMARY KEY,
  audit_number VARCHAR(100) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK(status IN ('in_progress', 'completed', 'cancelled')),
  notes TEXT,
  sync_uuid VARCHAR(36) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_audit_items (
  id SERIAL PRIMARY KEY,
  audit_id INTEGER NOT NULL REFERENCES inventory_audits(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  theoretical_qty INTEGER NOT NULL,
  actual_qty INTEGER NOT NULL,
  discrepancy_qty INTEGER NOT NULL,
  justification TEXT
);

-- 16. JOURNAL D'AUDIT SÉCURITÉ
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id INTEGER,
  details TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 17. CONFIGURATION BOUTIQUE
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 18. ÉVÉNEMENTS DE SYNCHRONISATION (IDEMPOTENCE & AUDIT TRACE)
CREATE TABLE IF NOT EXISTS sync_events (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(100) NOT NULL,
  device_name VARCHAR(150),
  mutation_id VARCHAR(100) UNIQUE NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'applied',
  conflict_details TEXT,
  received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =======================================================
-- INDEXES DE PERFORMANCE POUR RECHERCHE ET ANALYTICS
-- =======================================================
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_updated ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_idempotency ON sales(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_financial_date ON financial_movements(date);
CREATE INDEX IF NOT EXISTS idx_money_transfers_date ON money_transfers(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_events_mutation ON sync_events(mutation_id);
