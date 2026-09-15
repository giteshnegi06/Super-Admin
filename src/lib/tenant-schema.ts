/**
 * Shared multi-tenant schema — applied ONCE to a single shared database used
 * by every cafe. Every tenant table carries `cafe_id`; every unique
 * constraint that could collide across cafes is scoped to `(cafe_id, ...)`.
 * Kept as a TS string (not a loose .sql file) so it is bundled into the
 * Vercel serverless function. Every statement is idempotent.
 */
export const TENANT_SCHEMA_SQL: string = `-- =====================================================================
-- Shared schema: one database, every cafe scoped by cafe_id.
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

-- NOTE on ids below: admin_users/categories/menu_items/tables/service_requests
-- all use ids that are NOT cryptographically random (deterministic sequences
-- like "table-01", or client Date.now()-based ids like "cat-1737...") — safe
-- when each cafe has its own database, but two different cafes CAN land on
-- the exact same id in a shared one. Every such table's primary key is
-- therefore (cafe_id, id), not id alone. Cross-table lookups that used to be
-- enforced with a single-column FK (menu_items.category_id, order_items.
-- menu_item_id, password_resets.user_id) are now plain columns instead —
-- the app already always has cafe_id in scope to join correctly, and losing
-- ON DELETE CASCADE/SET NULL on these specific lookups is an acceptable
-- trade for eliminating cross-tenant id collisions. order_items/order_rounds
-- keep single-column ids (real gen_random_uuid()), where collision is not
-- a practical concern.

CREATE TABLE IF NOT EXISTS admin_users (
  id          text NOT NULL,
  cafe_id     text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text NOT NULL,
  role        text NOT NULL,
  -- "salt:hash" hex via scrypt (see the app's server/auth.ts); NULL = cannot log in
  password_hash text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_admin_users PRIMARY KEY (cafe_id, id),
  CONSTRAINT uq_admin_users_cafe_email UNIQUE (cafe_id, email)
);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_email_key;
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_pkey;

CREATE TABLE IF NOT EXISTS categories (
  id             text NOT NULL,
  cafe_id        text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  name           text NOT NULL,
  icon           text,
  display_order  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_categories PRIMARY KEY (cafe_id, id)
);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories (cafe_id, display_order);

CREATE TABLE IF NOT EXISTS menu_items (
  id                    text NOT NULL,
  cafe_id               text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  category_id           text,
  name                  text NOT NULL,
  description           text,
  price                 numeric NOT NULL,
  veg_type              text NOT NULL,
  image_url             text,
  is_available          boolean NOT NULL DEFAULT true,
  preparation_time_min  integer,
  customization_groups  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_menu_items PRIMARY KEY (cafe_id, id)
);
CREATE INDEX IF NOT EXISTS idx_menu_items_cafe ON menu_items (cafe_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items (cafe_id, category_id);

CREATE TABLE IF NOT EXISTS tables (
  id               text NOT NULL,
  cafe_id          text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  number           text NOT NULL,
  code             text NOT NULL,
  capacity         integer NOT NULL DEFAULT 4,
  status           text NOT NULL DEFAULT 'available',
  active_order_id  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_tables PRIMARY KEY (cafe_id, id),
  CONSTRAINT uq_tables_cafe_number UNIQUE (cafe_id, number),
  CONSTRAINT uq_tables_cafe_code UNIQUE (cafe_id, code)
);
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_code_key;
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_pkey;

CREATE TABLE IF NOT EXISTS orders (
  -- id (e.g. "ORD-1001") is only allocated unique PER CAFE (see cafeBackend's
  -- allocateOrderId) — two different cafes can legitimately land on the same
  -- id, so the primary key is (cafe_id, id), not id alone.
  id                    text NOT NULL,
  cafe_id               text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  table_id              text NOT NULL,
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
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_orders PRIMARY KEY (cafe_id, id),
  CONSTRAINT fk_orders_table FOREIGN KEY (cafe_id, table_id) REFERENCES tables (cafe_id, id) ON DELETE CASCADE
);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_table_id_fkey;
CREATE INDEX IF NOT EXISTS idx_orders_table_active ON orders (table_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_active_kitchen ON orders (cafe_id, status) WHERE status NOT IN ('served', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_orders_cafe_created ON orders (cafe_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_rounds (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id                  text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  order_id                 text NOT NULL,
  round_number             integer NOT NULL,
  placed_at                timestamptz NOT NULL DEFAULT now(),
  estimated_prep_time_min  integer NOT NULL DEFAULT 15,
  preparing_started_at     timestamptz,
  ready_at                 timestamptz,
  status                   text NOT NULL DEFAULT 'received',
  -- order_id is only unique per cafe (same reasoning as orders.id above)
  CONSTRAINT uq_order_round UNIQUE (cafe_id, order_id, round_number),
  -- orders' PK is (cafe_id, id), not id alone — match it here
  CONSTRAINT fk_order_rounds_order FOREIGN KEY (cafe_id, order_id) REFERENCES orders (cafe_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_order_rounds_order_id ON order_rounds (order_id);
CREATE INDEX IF NOT EXISTS idx_order_rounds_cafe ON order_rounds (cafe_id);

CREATE TABLE IF NOT EXISTS order_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id                  text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  order_round_id           uuid NOT NULL REFERENCES order_rounds(id) ON DELETE CASCADE,
  menu_item_id             text,
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
CREATE INDEX IF NOT EXISTS idx_order_items_cafe ON order_items (cafe_id);

-- Daily revenue rollup (source of truth stays \`orders\`; the app rebuilds it)
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

-- Table-side assistance requests ("Need Water", "Call Server")
CREATE TABLE IF NOT EXISTS service_requests (
  id            text NOT NULL,
  cafe_id       text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  table_id      text NOT NULL,
  table_number  text NOT NULL,
  request_type  text NOT NULL,
  status        text NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  CONSTRAINT pk_service_requests PRIMARY KEY (cafe_id, id)
);
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_pkey;
CREATE INDEX IF NOT EXISTS idx_service_requests_pending
  ON service_requests (cafe_id, created_at)
  WHERE status = 'pending';

-- One-time password reset tokens for the "Forgot password?" email flow.
-- token_hash is a SHA-256 hash of a cryptographically random token, so it
-- stays a plain global primary key (collision is not a practical concern).
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  text PRIMARY KEY,
  cafe_id     text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  user_id     text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (cafe_id, user_id);
`;
