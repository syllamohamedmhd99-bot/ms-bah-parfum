export type UserRole = 'admin' | 'manager' | 'cashier' | 'stock_manager';

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  is_active?: number;
  created_at?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  product_count?: number;
}

export interface Supplier {
  id: number;
  name: string;
  company_name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  product_count?: number;
  total_purchased?: number;
  total_unpaid_debt?: number;
}

export interface Client {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  credit_limit: number;
  current_debt: number;
  notes?: string;
  total_sales_count?: number;
  total_purchased?: number;
}

export interface Product {
  id: number;
  code: string;
  name: string;
  category_id?: number;
  category_name?: string;
  brand?: string;
  description?: string;
  supplier_id?: number;
  supplier_name?: string;
  purchase_price: number;
  sale_price: number;
  stock_quantity: number;
  alert_threshold: number;
  expiry_date?: string;
  batch_number?: string;
  image_url?: string;
  is_archived: number;
  import_source?: string;
  import_date?: string;
  needs_completion?: number | boolean;
  total_purchase_value?: number;
  total_sale_value?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CashRegister {
  id: number;
  name: string;
  type: 'cash' | 'orange_money' | 'mtn_momo' | 'bank' | 'other';
  balance: number;
  is_active: number;
  phone_number?: string;
  notes?: string;
  is_currently_open?: number;
}

export interface CashSession {
  id: number;
  cash_register_id: number;
  register_name?: string;
  register_type?: string;
  user_id: number;
  user_name?: string;
  opening_time: string;
  closing_time?: string;
  opening_float: number;
  total_cash_in: number;
  total_cash_out: number;
  theoretical_balance: number;
  actual_balance?: number;
  discrepancy?: number;
  justification?: string;
  status: 'open' | 'closed';
  notes?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export interface Sale {
  id: number;
  sale_number: string;
  client_id?: number;
  client_name?: string;
  client_phone?: string;
  user_id: number;
  cashier_name?: string;
  cash_session_id?: number;
  cash_register_id?: number;
  register_name?: string;
  date: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  amount_received: number;
  change_returned: number;
  payment_mode: 'cash' | 'orange_money' | 'mtn_momo' | 'mixed' | 'credit';
  status: 'completed' | 'cancelled';
  cancellation_reason?: string;
  cancelled_by_name?: string;
  cancelled_at?: string;
  notes?: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total_price: number;
  profit: number;
}

export interface MoneyTransfer {
  id: number;
  transfer_number: string;
  type: 'deposit' | 'withdrawal';
  client_name: string;
  client_phone: string;
  amount: number;
  service: 'orange_money' | 'mtn_momo' | 'other';
  client_fee: number;
  boutique_commission: number;
  transaction_ref?: string;
  cash_register_id?: number;
  wallet_name?: string;
  cash_desk_id?: number;
  cash_desk_name?: string;
  user_id: number;
  operator_name?: string;
  status: 'pending' | 'validated' | 'cancelled' | 'error';
  cancellation_reason?: string;
  cancelled_by_name?: string;
  notes?: string;
  created_at: string;
}

export interface FinancialMovement {
  id: number;
  movement_number: string;
  type: string;
  is_inflow: number; // 1: inflow, 0: outflow, 2: transfer
  cash_register_id: number;
  register_name?: string;
  target_register_id?: number;
  target_register_name?: string;
  amount: number;
  date: string;
  category: string;
  description: string;
  reference_type?: string;
  reference_id?: number;
  user_id: number;
  user_name?: string;
  is_cancelled: number;
  cancellation_reason?: string;
  created_at: string;
}

export interface StockMovement {
  id: number;
  product_id: number;
  product_name: string;
  product_code: string;
  movement_type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  unit_cost: number;
  reason: string;
  reference_type?: string;
  reference_id?: number;
  user_id: number;
  user_name?: string;
  created_at: string;
}

export interface InventoryAudit {
  id: number;
  audit_number: string;
  user_id: number;
  auditor_name?: string;
  date: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  total_items_checked?: number;
  discrepancies_count?: number;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface AlertsSummary {
  totalCount: number;
  outOfStock: Product[];
  lowStock: Product[];
  expired: Product[];
  expiringSoon: (Product & { days_remaining: number })[];
  unpaidPurchases: any[];
  clientDebts: Client[];
  cashDiscrepancies: any[];
}

export interface ParsedProductItem {
  row: number;
  name: string;
  category: string;
  selling_price: number | null;
  purchase_price: number | null;
  stock_quantity: number;
  alert_threshold: number;
  needs_completion: boolean;
  duplicate_type?: 'internal' | 'existing_db' | null;
  existing_product?: any;
  duplicate_action?: 'create' | 'update' | 'skip';
}

export interface IgnoredLine {
  row: number;
  reason: string;
  content?: string;
}

export interface ExcelPreviewResult {
  fileName: string;
  totalRows: number;
  totalDetected: number;
  validPriceCount: number;
  needsCompletionCount: number;
  duplicatesCount: number;
  ignoredLinesCount: number;
  categoriesDetected: { name: string; count: number }[];
  products: ParsedProductItem[];
  ignoredLines: IgnoredLine[];
}

export interface ImportReport {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  needsCompletionCount: number;
  duplicatesCount: number;
  ignoredLinesCount: number;
  backupPath: string | null;
  categoriesCreated: string[];
  importedProducts: { id: number; code: string; name: string; category: string; sale_price: number; status: string }[];
  errors: string[];
}

