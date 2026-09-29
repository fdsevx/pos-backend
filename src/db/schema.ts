import { pgTable, varchar, uuid, text, boolean, integer, numeric, date, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const outlets = pgTable('outlets', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 20 }).notNull().unique(), // 'restoran'|'cafe'
  is_active: boolean('is_active').default(true).notNull(),
  timezone: varchar('timezone', { length: 50 }).default('Asia/Jakarta').notNull(),
  tax_percent: numeric('tax_percent', { precision: 5, scale: 2 }).default('0').notNull(),
  service_percent: numeric('service_percent', { precision: 5, scale: 2 }).default('0').notNull(),
  receipt_header: text('receipt_header'),
  receipt_footer: text('receipt_footer'),
  payment_methods_enabled: jsonb('payment_methods_enabled').default(['TUNAI', 'QRIS']).notNull(),
  low_stock_threshold: integer('low_stock_threshold').default(5).notNull(),
  enable_table_number: boolean('enable_table_number').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  display_name: varchar('display_name', { length: 100 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(), // super_admin|manager|cashier|accountant|crm_staff
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
});

export const user_outlets = pgTable('user_outlets', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: uuid('user_id').references(() => users.id).notNull(),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
}, (t) => ({
  unq: uniqueIndex('user_outlets_user_id_outlet_id_idx').on(t.user_id, t.outlet_id)
}));

export const user_permissions = pgTable('user_permissions', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: uuid('user_id').references(() => users.id).notNull(),
  permission: varchar('permission', { length: 50 }).notNull(),
}, (t) => ({
  unq: uniqueIndex('user_permissions_user_id_permission_idx').on(t.user_id, t.permission)
}));

export const devices = pgTable('devices', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
  user_id: uuid('user_id').references(() => users.id),
  registered_at: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
  last_seen_at: timestamp('last_seen_at', { withTimezone: true }),
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  sort_order: integer('sort_order').default(0).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  outlet_idx: index('categories_outlet_id_idx').on(t.outlet_id)
}));

export const products = pgTable('products', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
  category_id: uuid('category_id').references(() => categories.id),
  sku: varchar('sku', { length: 50 }).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  unit: varchar('unit', { length: 20 }).default('pcs').notNull(),
  price: numeric('price', { precision: 15, scale: 2 }).notNull(),
  cost_price: numeric('cost_price', { precision: 15, scale: 2 }).default('0').notNull(),
  stock: integer('stock').default(0).notNull(),
  track_stock: boolean('track_stock').default(true).notNull(),
  is_available: boolean('is_available').default(true).notNull(),
  image_url: text('image_url'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  outlet_idx: index('products_outlet_id_idx').on(t.outlet_id),
  outlet_sku_idx: index('products_outlet_id_sku_idx').on(t.outlet_id, t.sku)
}));

export const pricing_history = pgTable('pricing_history', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  product_id: uuid('product_id').references(() => products.id).notNull(),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
  field_changed: varchar('field_changed', { length: 20 }).notNull(), // 'price'|'cost_price'
  old_value: numeric('old_value', { precision: 15, scale: 2 }).notNull(),
  new_value: numeric('new_value', { precision: 15, scale: 2 }).notNull(),
  changed_by: uuid('changed_by').references(() => users.id).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  outlet_idx: index('pricing_history_outlet_id_idx').on(t.outlet_id)
}));

export const discounts = pgTable('discounts', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 10 }).notNull(), // 'percent'|'nominal'
  value: numeric('value', { precision: 15, scale: 2 }).notNull(),
  scope: varchar('scope', { length: 10 }).notNull(), // 'product'|'transaction'
  product_id: uuid('product_id').references(() => products.id),
  member_only: boolean('member_only').default(false).notNull(),
  start_date: timestamp('start_date', { withTimezone: true }),
  end_date: timestamp('end_date', { withTimezone: true }),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  outlet_idx: index('discounts_outlet_id_idx').on(t.outlet_id)
}));

export const stock_movements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  product_id: uuid('product_id').references(() => products.id).notNull(),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'sale'|'purchase'|'opname'|'return'|'void'
  quantity: integer('quantity').notNull(),
  reference_id: uuid('reference_id'),
  notes: text('notes'),
  created_by: uuid('created_by').references(() => users.id).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  outlet_idx: index('stock_movements_outlet_id_idx').on(t.outlet_id),
  product_outlet_idx: index('stock_movements_product_id_outlet_id_idx').on(t.product_id, t.outlet_id)
}));

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  member_type: varchar('member_type', { length: 20 }), // 'silver'|'gold'|'platinum'
  points: integer('points').default(0).notNull(),
  total_spending: numeric('total_spending', { precision: 15, scale: 2 }).default('0').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  outlet_idx: index('customers_outlet_id_idx').on(t.outlet_id),
  outlet_phone_idx: uniqueIndex('customers_outlet_id_phone_idx').on(t.outlet_id, t.phone)
}));

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
  cashier_id: uuid('cashier_id').references(() => users.id).notNull(),
  device_id: varchar('device_id', { length: 50 }).notNull(),
  cash_opening: numeric('cash_opening', { precision: 15, scale: 2 }).notNull(),
  cash_closing: numeric('cash_closing', { precision: 15, scale: 2 }),
  expected_cash: numeric('expected_cash', { precision: 15, scale: 2 }),
  cash_difference: numeric('cash_difference', { precision: 15, scale: 2 }),
  opened_at: timestamp('opened_at', { withTimezone: true }).notNull(),
  closed_at: timestamp('closed_at', { withTimezone: true }),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  outlet_idx: index('shifts_outlet_id_idx').on(t.outlet_id)
}));

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
  device_id: varchar('device_id', { length: 50 }).notNull(),
  receipt_number: varchar('receipt_number', { length: 50 }).notNull(),
  customer_id: uuid('customer_id').references(() => customers.id),
  cashier_id: uuid('cashier_id').references(() => users.id).notNull(),
  shift_id: uuid('shift_id').references(() => shifts.id),
  table_number: varchar('table_number', { length: 10 }),
  subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull(),
  discount_amount: numeric('discount_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  discount_id: uuid('discount_id').references(() => discounts.id),
  tax_amount: numeric('tax_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  service_amount: numeric('service_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  grand_total: numeric('grand_total', { precision: 15, scale: 2 }).notNull(),
  status: varchar('status', { length: 10 }).notNull(), // 'PAID'|'VOID'|'REFUNDED'
  notes: text('notes'),
  voided_at: timestamp('voided_at', { withTimezone: true }),
  voided_by: uuid('voided_by').references(() => users.id),
  void_reason: text('void_reason'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  outlet_idx: index('transactions_outlet_id_idx').on(t.outlet_id),
  outlet_created_at_idx: index('transactions_outlet_id_created_at_idx').on(t.outlet_id, t.created_at),
  outlet_status_idx: index('transactions_outlet_id_status_idx').on(t.outlet_id, t.status),
  receipt_number_idx: index('transactions_receipt_number_idx').on(t.receipt_number)
}));

export const transaction_items = pgTable('transaction_items', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  transaction_id: uuid('transaction_id').references(() => transactions.id).notNull(),
  product_id: uuid('product_id').references(() => products.id).notNull(),
  product_name: varchar('product_name', { length: 150 }).notNull(),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 15, scale: 2 }).notNull(),
  cost_price_snapshot: numeric('cost_price_snapshot', { precision: 15, scale: 2 }).notNull(),
  discount_amount: numeric('discount_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  transaction_id: uuid('transaction_id').references(() => transactions.id).notNull(),
  method: varchar('method', { length: 10 }).notNull(), // 'TUNAI'|'QRIS'
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  amount_received: numeric('amount_received', { precision: 15, scale: 2 }),
  change_amount: numeric('change_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  qris_reference: varchar('qris_reference', { length: 100 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  outlet_idx: index('suppliers_outlet_id_idx').on(t.outlet_id)
}));

export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
  supplier_id: uuid('supplier_id').references(() => suppliers.id),
  receipt_number: varchar('receipt_number', { length: 50 }),
  total_amount: numeric('total_amount', { precision: 15, scale: 2 }).notNull(),
  notes: text('notes'),
  purchased_at: timestamp('purchased_at', { withTimezone: true }).notNull(),
  created_by: uuid('created_by').references(() => users.id).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  outlet_idx: index('purchases_outlet_id_idx').on(t.outlet_id)
}));

export const purchase_items = pgTable('purchase_items', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  purchase_id: uuid('purchase_id').references(() => purchases.id).notNull(),
  product_id: uuid('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(),
  unit_cost: numeric('unit_cost', { precision: 15, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  description: text('description'),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  expense_date: date('expense_date').notNull(),
  created_by: uuid('created_by').references(() => users.id).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  outlet_idx: index('expenses_outlet_id_idx').on(t.outlet_id)
}));

export const coa_accounts = pgTable('coa_accounts', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: varchar('code', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'asset'|'liability'|'equity'|'revenue'|'expense'
  outlet_id: uuid('outlet_id').references(() => outlets.id),
  initial_balance: numeric('initial_balance', { precision: 15, scale: 2 }).default('0').notNull(),
  is_locked: boolean('is_locked').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  outlet_idx: index('coa_accounts_outlet_id_idx').on(t.outlet_id)
}));

export const journal_entries = pgTable('journal_entries', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  outlet_id: uuid('outlet_id').references(() => outlets.id).notNull(),
  entry_date: date('entry_date').notNull(),
  description: text('description').notNull(),
  reference_type: varchar('reference_type', { length: 20 }), // 'transaction'|'purchase'|'expense'|'void'|'opname'|'manual'|'shift'
  reference_id: uuid('reference_id'),
  is_reversed: boolean('is_reversed').default(false).notNull(),
  period_locked: boolean('period_locked').default(false).notNull(),
  created_by: uuid('created_by').references(() => users.id).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  outlet_idx: index('journal_entries_outlet_id_idx').on(t.outlet_id)
}));

export const journal_lines = pgTable('journal_lines', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  journal_entry_id: uuid('journal_entry_id').references(() => journal_entries.id).notNull(),
  account_id: uuid('account_id').references(() => coa_accounts.id).notNull(),
  debit: numeric('debit', { precision: 15, scale: 2 }).default('0').notNull(),
  credit: numeric('credit', { precision: 15, scale: 2 }).default('0').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  journal_entry_idx: index('journal_lines_journal_entry_id_idx').on(t.journal_entry_id)
}));

export const audit_logs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  outlet_id: uuid('outlet_id').references(() => outlets.id),
  user_id: uuid('user_id').references(() => users.id).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  entity_type: varchar('entity_type', { length: 50 }).notNull(),
  entity_id: uuid('entity_id'),
  before_data: jsonb('before_data'),
  after_data: jsonb('after_data'),
  ip_address: varchar('ip_address', { length: 45 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  outlet_idx: index('audit_logs_outlet_id_idx').on(t.outlet_id),
  entity_idx: index('audit_logs_entity_type_entity_id_idx').on(t.entity_type, t.entity_id)
}));
