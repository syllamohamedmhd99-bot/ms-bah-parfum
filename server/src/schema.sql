-- Seydou Boutique Database Schema (SQLite & compatible with PostgreSQL)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'cashier', 'stock_manager')),
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  credit_limit REAL DEFAULT 0,
  current_debt REAL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  brand TEXT,
  description TEXT,
  supplier_id INTEGER REFERENCES suppliers(id),
  purchase_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  alert_threshold INTEGER NOT NULL DEFAULT 5,
  expiry_date DATE,
  batch_number TEXT,
  image_url TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  needs_completion INTEGER NOT NULL DEFAULT 0,
  import_source TEXT,
  import_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_registers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('cash', 'orange_money', 'mtn_momo', 'bank', 'other')),
  balance REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  phone_number TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cash_register_id INTEGER NOT NULL REFERENCES cash_registers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  opening_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closing_time DATETIME,
  opening_float REAL NOT NULL DEFAULT 0,
  total_cash_in REAL DEFAULT 0,
  total_cash_out REAL DEFAULT 0,
  theoretical_balance REAL NOT NULL DEFAULT 0,
  actual_balance REAL,
  discrepancy REAL,
  justification TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_number TEXT UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  remaining_amount REAL NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK(payment_mode IN ('cash', 'orange_money', 'mtn_momo', 'bank', 'credit')),
  cash_register_id INTEGER REFERENCES cash_registers(id),
  invoice_number TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'partial', 'unpaid', 'cancelled')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL,
  batch_number TEXT,
  expiry_date DATE
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_number TEXT UNIQUE NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  cash_session_id INTEGER REFERENCES cash_sessions(id),
  cash_register_id INTEGER REFERENCES cash_registers(id),
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  amount_received REAL NOT NULL DEFAULT 0,
  change_returned REAL NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK(payment_mode IN ('cash', 'orange_money', 'mtn_momo', 'mixed', 'credit')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'cancelled')),
  cancellation_reason TEXT,
  cancelled_by INTEGER REFERENCES users(id),
  cancelled_at DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  unit_cost REAL NOT NULL,
  total_price REAL NOT NULL,
  profit REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS money_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal')),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  amount REAL NOT NULL,
  service TEXT NOT NULL CHECK(service IN ('orange_money', 'mtn_momo', 'other')),
  client_fee REAL NOT NULL DEFAULT 0,
  boutique_commission REAL NOT NULL DEFAULT 0,
  transaction_ref TEXT,
  cash_register_id INTEGER REFERENCES cash_registers(id),
  cash_desk_id INTEGER REFERENCES cash_registers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'validated' CHECK(status IN ('pending', 'validated', 'cancelled', 'error')),
  cancellation_reason TEXT,
  cancelled_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movement_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK(type IN (
    'sale_income', 'credit_payment', 'owner_contribution', 'commission_income', 'other_income',
    'purchase_expense', 'supplier_payment', 'rent', 'electricity', 'transport', 'salary',
    'operating_expense', 'owner_withdrawal', 'other_expense', 'register_transfer'
  )),
  is_inflow INTEGER NOT NULL,
  cash_register_id INTEGER NOT NULL REFERENCES cash_registers(id),
  target_register_id INTEGER REFERENCES cash_registers(id),
  amount REAL NOT NULL,
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  reference_type TEXT,
  reference_id INTEGER,
  user_id INTEGER NOT NULL REFERENCES users(id),
  is_cancelled INTEGER NOT NULL DEFAULT 0,
  cancellation_reason TEXT,
  cancelled_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL CHECK(movement_type IN (
    'reception', 'sale', 'damaged', 'expired', 'loss_theft', 'internal_use',
    'return_supplier', 'return_client', 'inventory_adjustment', 'transfer_in', 'transfer_out'
  )),
  quantity INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  unit_cost REAL NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id INTEGER,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_number TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_audit_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id INTEGER NOT NULL REFERENCES inventory_audits(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  theoretical_qty INTEGER NOT NULL,
  actual_qty INTEGER NOT NULL,
  discrepancy_qty INTEGER NOT NULL,
  justification TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT
);

-- Indexes for maximum query performance
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_financial_date ON financial_movements(date);
CREATE INDEX IF NOT EXISTS idx_money_transfers_date ON money_transfers(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT
);

-- Schema Migrations table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  description TEXT,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sync events table for offline synchronization and idempotency
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


-- Seed initial roles if empty
INSERT OR IGNORE INTO roles (name, description, permissions) VALUES
  ('admin', 'Administrateur Général', 'all'),
  ('manager', 'Gérant de Boutique', 'sales,purchases,stock,transfers,cash,finances,reports,clients,suppliers,inventory'),
  ('cashier', 'Caissier / Vendeur', 'pos,sales,transfers,cash_read,clients'),
  ('stock_manager', 'Gestionnaire de Stock', 'stock,purchases,inventory,products,suppliers');

-- Record base migration
INSERT OR IGNORE INTO schema_migrations (version, description) VALUES
  ('1.0.0', 'Initial baseline schema migration');

-- Compatibility views matching exact prompt table naming specifications
CREATE VIEW IF NOT EXISTS customers AS SELECT * FROM clients;
CREATE VIEW IF NOT EXISTS expenses AS SELECT * FROM financial_movements WHERE is_inflow = 0;
CREATE VIEW IF NOT EXISTS customer_payments AS SELECT * FROM financial_movements WHERE type = 'credit_payment';
CREATE VIEW IF NOT EXISTS supplier_payments AS SELECT * FROM financial_movements WHERE type = 'supplier_payment';
CREATE VIEW IF NOT EXISTS mobile_money_accounts AS SELECT * FROM cash_registers WHERE type IN ('orange_money', 'mtn_momo');
CREATE VIEW IF NOT EXISTS money_transfer_operations AS SELECT * FROM money_transfers;
CREATE VIEW IF NOT EXISTS inventory_sessions AS SELECT * FROM inventory_audits;
