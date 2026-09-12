# QR Ordering — Super Admin

Control panel for the QR-ordering system. Manage every cafe that bought the system, see each cafe's revenue and tables, and **provision a dedicated Neon Postgres database
for each cafe** with one click.

## Architecture

```
Neon project "square-shadow-18088269" (one endpoint, many databases)
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  ┌───────────────┐
│ Admin           │  │ QR-Order         │  │ cafe_<slug>          │  │ cafe_<slug2>  │ ...
│ (this panel)    │  │ Negi's Kitchen   │  │ new cafe             │  │               │
│ clients, plans, │  │ cafes, tables,   │  │ same schema, seeded  │  │               │
│ payments, logs  │  │ orders, menu ... │  │ by "Add cafe"        │  │               │
└─────────────────┘  └────────▲─────────┘  └──────────▲───────────┘  └───────────────┘
                              │ DATABASE_URL           │ DATABASE_URL
                     qr-ordering-sable.vercel.app   <cafe>.vercel.app  (one QR-Ordering deploy per cafe)
```

* **Admin DB** – `Admin` database. Holds `AdminUser`, `Client`, `ActivityLog` (see `prisma/schema.prisma`).
* **Cafe DB** – one database per cafe *inside the same Neon project*, exactly
  like `QR-Order` for Negi's Kitchen. Created with `CREATE DATABASE` (the
  `neondb_owner` role has CREATEDB, so no Neon API key is needed), then
  `src/lib/tenant-schema.sql` — a 1:1 copy of the live product schema — is
  applied and the single `cafes` row, owner `admin_users` row and
  `Table 01…N` rows are seeded. The connection string is stored AES-256-GCM
  encrypted on the `Client` row.
* **Metrics** – the panel reads each cafe DB directly (Neon HTTP driver) for
  today / this-month / last-month / all-time revenue, order counts, table
  count, occupied tables, active orders and menu size. Revenue is computed the
  same way as the product's `/api/revenue/daily`: `subtotal + service_charge`,
  cancelled orders excluded, bucketed by business day in the cafe's time zone.

## File structure

```
admin/
├── .env                      # secrets (never commit)
├── .env.example
├── package.json
├── prisma/
│   ├── schema.prisma         # admin DB models
│   └── seed.ts               # default plans
├── scripts/
│   └── create-admin.ts       # create super-admin login
└── src/
    ├── middleware.ts         # auth guard (JWT cookie)
    ├── actions/              # server actions
    │   ├── auth.ts           # login / logout
    │   ├── clients.ts        # create / update / status / provision / delete / payments
    │   └── plans.ts
    ├── lib/
    │   ├── db.ts             # Prisma client
    │   ├── env.ts            # env validation
    │   ├── auth.ts           # sessions, roles, activity log
    │   ├── crypto.ts         # encrypt tenant connection strings
    │   ├── neon.ts           # Neon API v2 client (create/delete project)
    │   ├── provisioning.ts   # pipeline: Neon project → schema → seed
    │   ├── tenant-schema.sql # schema applied to every cafe DB
    │   ├── validations.ts    # zod schemas
    │   ├── format.ts
    │   └── cn.ts
    ├── components/
    │   ├── ui/               # button, input, card, badge
    │   ├── sidebar.tsx
    │   ├── client-form.tsx
    │   ├── client-table.tsx
    │   ├── provision-status.tsx  # live-polls provisioning progress
│   ├── cafe-metrics.tsx      # revenue tiles, 30-day chart, 12-month table
    │   └── ...
    ├── types/index.ts
    └── app/
        ├── login/
        ├── (dashboard)/
        │   ├── layout.tsx    # sidebar shell
        │   ├── dashboard/    # KPIs, recent clients, activity
        │   ├── clients/      # list · new · [id] detail
        │   ├── plans/
        │   └── settings/     # Neon status, admin team
        └── api/
            ├── health/
            └── clients/[id]/status/   # polled during provisioning
```

## Setup

```bash
npm install
```

1. Fill in `.env` (copy from `.env.example`):
   * `DATABASE_URL` – your Admin Neon DB
   * `NEON_PROJECT_ID` – from `.neon` in the QR-Ordering repo (only used for console links)
   * `ENCRYPTION_KEY`, `SESSION_SECRET` – already generated for you
2. Push the schema:

```bash
npm run db:push
```

3. Create your login:

```bash
npm run admin:create -- --email you@example.com --name "Your Name" --password "choose-a-strong-one"
```

4. Run:

```bash
npm run dev
```

Open http://localhost:3100 → sign in → **Add cafe** (port 3100 so it never clashes with the QR-Ordering dev server on 3000).

## Provisioning flow (what "Add cafe" does)

1. Inserts a `Client` row (`provisionStatus = PENDING`).
2. `CREATE DATABASE "cafe_<slug>"` on the Neon endpoint. (`CREATING_DATABASE`)
3. Applies `tenant-schema.sql` statement by statement. (`RUNNING_MIGRATIONS`)
4. Seeds `cafes` (id = slug), `admin_users` (owner) and N `tables`. (`SEEDING`)
5. Marks `READY`; the detail page polls `/api/clients/[id]/status` every 2s.
   Failures land in `FAILED` with the error shown and a **Retry** button.
6. **Going live:** deploy the QR-Ordering repo on Vercel for the cafe, set its
   `DATABASE_URL` to the value shown on the client page (copy button), and
   paste the resulting URL into the client's *App URL* field.

### Linking an existing cafe database

```bash
npm run client:import -- --db QR-Order --slug negis-kitchen --owner "Gitesh Negi" --email negigitesh@gmail.com --app https://qr-ordering-sable.vercel.app
```

## Roles

| Role         | Can                                                            |
|--------------|----------------------------------------------------------------|
| SUPER_ADMIN  | everything, incl. view connection strings, drop DBs/clients  |
| ADMIN        | manage clients and provisioning                                |
| SUPPORT      | read-only                                                      |

## Updating the tenant schema later

Add `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
statements to `tenant-schema.sql`, bump `schema_version`, then press
**Re-run schema** on each client (or loop over clients with a script calling
`provisionClient`).
