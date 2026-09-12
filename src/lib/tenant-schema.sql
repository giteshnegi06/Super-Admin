-- =====================================================================
-- Tenant schema: applied to every cafe's database.
-- Mirrors the live QR-Ordering (qr-ordering-sable.vercel.app) schema
-- exactly, as introspected from the "QR-Order" (Negi's Kitchen) database.
-- All statements are idempotent so it can be re-run safely.
-- =====================================================================

CREATE TABLE IF NOT EXISTS cafes (
  id                      text PRIMARY KEY,
  name                    text NOT NULL,
  tagline                 text,
  logo_url                text,
  address                 text,
  phone                   text,
  currency                text NOT NULL DEFAULT '₹',
  tax_percent             numeric NOT NULL DEFAULT 0,
  service_charge_percent  numeric NOT NULL DEFAULT 0,
  is_accepting_orders     boolean NOT NULL DEFAULT true,
  upi_id                  text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id          text PRIMARY KEY,
  cafe_id     text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,
  role        text NOT NULL,
  -- "salt:hash" hex via scrypt (see the app's server/auth.ts); NULL = cannot log in
  password_hash text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_hash text;

CREATE TABLE IF NOT EXISTS categories (
  id             text PRIMARY KEY,
  cafe_id        text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  name           text NOT NULL,
  icon           text,
  display_order  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories (cafe_id, display_order);

CREATE TABLE IF NOT EXISTS menu_items (
  id                    text PRIMARY KEY,
  cafe_id               text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  category_id           text REFERENCES categories(id) ON DELETE SET NULL,
  name                  text NOT NULL,
  description           text,
  price                 numeric NOT NULL,
  veg_type              text NOT NULL,
  image_url             text,
  is_available          boolean NOT NULL DEFAULT true,
  preparation_time_min  integer,
  customization_groups  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items (category_id);

CREATE TABLE IF NOT EXISTS tables (
  id               text PRIMARY KEY,
  cafe_id          text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  number           text NOT NULL,
  code             text NOT NULL UNIQUE,
  capacity         integer NOT NULL DEFAULT 4,
  status           text NOT NULL DEFAULT 'available',
  active_order_id  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tables_cafe_number UNIQUE (cafe_id, number)
);

CREATE TABLE IF NOT EXISTS orders (
  id                    text PRIMARY KEY,
  cafe_id               text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  table_id              text NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  table_number          text NOT NULL,
  status                text NOT NULL DEFAULT 'received',
  customer_name         text,
  customer_phone        text,
  special_instructions  text,
  payment_method        text NOT NULL,
  payment_status        text NOT NULL DEFAULT 'pending',
  subtotal              numeric NOT NULL DEFAULT 0,
  tax                   numeric NOT NULL DEFAULT 0,
  service_charge        numeric NOT NULL DEFAULT 0,
  total                 numeric NOT NULL DEFAULT 0,
  order_rounds_count    integer NOT NULL DEFAULT 1,
  is_merged             boolean NOT NULL DEFAULT false,
  merged_order_ids      text[] NOT NULL DEFAULT '{}'::text[],
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_table_active ON orders (table_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_active_kitchen ON orders (cafe_id, status) WHERE status NOT IN ('served', 'cancelled');

CREATE TABLE IF NOT EXISTS order_rounds (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                 text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  round_number             integer NOT NULL,
  placed_at                timestamptz NOT NULL DEFAULT now(),
  estimated_prep_time_min  integer NOT NULL DEFAULT 15,
  preparing_started_at     timestamptz,
  ready_at                 timestamptz,
  status                   text NOT NULL DEFAULT 'received',
  CONSTRAINT uq_order_round UNIQUE (order_id, round_number)
);
CREATE INDEX IF NOT EXISTS idx_order_rounds_order_id ON order_rounds (order_id);

CREATE TABLE IF NOT EXISTS order_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_round_id           uuid NOT NULL REFERENCES order_rounds(id) ON DELETE CASCADE,
  menu_item_id             text REFERENCES menu_items(id) ON DELETE SET NULL,
  name                     text NOT NULL,
  price                    numeric NOT NULL,
  veg_type                 text NOT NULL,
  quantity                 integer NOT NULL DEFAULT 1,
  item_total               numeric NOT NULL,
  special_instructions     text,
  preparation_time_min     integer,
  selected_customizations  jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_order_items_round_id ON order_items (order_round_id);

-- Daily revenue rollup (source of truth stays `orders`; the app rebuilds it)
CREATE TABLE IF NOT EXISTS daily_revenue (
  cafe_id         text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  business_date   date NOT NULL,
  orders_count    integer NOT NULL DEFAULT 0,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  service_charge  numeric(12,2) NOT NULL DEFAULT 0,
  tax             numeric(12,2) NOT NULL DEFAULT 0,
  revenue         numeric(12,2) NOT NULL DEFAULT 0,
  time_zone       text NOT NULL DEFAULT 'UTC',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cafe_id, business_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_revenue_date ON daily_revenue (business_date DESC);
