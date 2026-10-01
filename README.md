# Deals & Discounts

A responsive Next.js + TypeScript storefront based on the supplied Deals & Discounts screenshot. Supabase supplies managed PostgreSQL, email/password authentication and a REST/RPC backend. CSS design tokens keep the orange-and-white interface easy to maintain without an additional styling dependency.

## Run locally

Install Node.js 22. Use the included `.nvmrc` if you use nvm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. With empty environment values, the app provides a labelled demo catalogue, search, location/category filtering, shop/deal pages and persistent cart. Demo mode does not simulate authenticated users or successful orders.

For a production-mode preview:

```sh
npm run build
npm start
```

## Connect the backend

1. Create a Supabase project. Run `supabase/schema.sql` once in its SQL editor against a fresh project. Then optionally run `supabase/seed.sql` to load the five demo shops, eight categories and five offers.
2. Copy the project URL and publishable/legacy anon key from the project settings into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. These are public client credentials; row-level security is the authorization boundary. Never use a service-role secret here.
3. In Supabase Authentication, enable email/password and email confirmation. Set Site URL to your website origin. Add `http://localhost:3000/account` and your deployed `/account` URL to allowed redirect URLs. Allow `/account?recovery=1` for password resets. Configure your own SMTP provider for live email delivery and appropriate signup/reset rate limits. Set the minimum password length to 12 in Supabase as well as the UI.
4. Restart the application after changing environment values. Create an account using the website, confirm the email and sign in.
5. Promote the first admin from the Supabase SQL editor using the confirmed user's UUID from Authentication → Users:

```sql
update public.profiles set role = 'admin' where id = 'YOUR-USER-UUID';
```

There are deliberately no seeded passwords or default administrator accounts. The Admin management navigation item appears after signing in again. Always retain at least one admin; a project owner can restore roles through SQL.

## What works

- Responsive desktop sidebar and mobile menu; screenshot-inspired header, category tiles, featured shops and daily offers.
- State/city selection, text search, categories, shops, restaurants and individual shop/deal routes.
- Email registration, confirmation, sign-in, sign-out, password recovery, and editable profile.
- Device-local cart with quantity controls; signed-in pay-on-collection ordering; order history and item snapshots.
- Admin create/edit/delete for shops, categories and deals, including visibility, featured status, stock, expiry and HTTPS image URLs.
- Admin user roles and suspension/reactivation. User deletion is deliberately not exposed because order history must remain intact. Supabase Authentication manages account deletion and email addresses.
- Admin order progression: placed → confirmed → ready → completed. Cancellation is permitted before completion and restores stock exactly once.

The seed covers Narsapur. Other selectable cities intentionally have empty states. Add shops in those cities through admin. Extend the `locations` map in `components/storefront.tsx` to support additional regions. Currency is INR. Monetary amounts are integer paise, so ₹199 is entered as 19900. Items are deals/products sold in a single purchasable form; size/colour variants are not implemented.

## Backend and security model

The Supabase Data API is the backend; a duplicate Next.js API proxy is unnecessary. `lib/supabase.ts` creates the public client. `supabase/schema.sql` defines tables, foreign keys, indexes, constraints, row-level policies and transaction functions.

| Endpoint / table | Access |
| --- | --- |
| categories | Public read; active admins manage |
| shops, deals | Public visible listings; active admins manage |
| profiles | Customer reads/updates own name and phone; active admin manages roles/status |
| orders, order_items | Customer reads own orders; active admin reads all |
| RPC `place_order(items, address, request_id)` | Active authenticated customer; prices read from database |
| RPC `change_order_status(order_id, new_status)` | Active admins; validated lifecycle transitions |

`place_order` locks inventory in deterministic order, validates expiry/availability, snapshots titles/prices, decrements inventory, and creates the order in one transaction. Duplicate requests with the same customer/request UUID return the existing order. The request UUID persists alongside the cart, including across reloads, and changes whenever the cart changes. Check order history before changing the cart after an uncertain checkout result. The database rejects direct order writes and role escalation. Frontend visibility is never relied on for authorization.

Supabase manages session persistence and token refresh in the browser. Private records are loaded only through authenticated RLS-protected requests. This application uses a client-rendered catalogue, so search-engine indexing of individual listings is limited. It does not store card details or collect online payments. Collection instructions include contact information visible only to the order owner and admins.

## Deploy to Vercel + Supabase

1. Put this folder in a Git repository and import it into Vercel as a Next.js project. Select Node.js 22, with build command `npm run build` and install command `npm ci`.
2. Configure the two environment variables for the intended environment. Use separate Supabase projects for preview/staging and production.
3. Apply schema and reviewed catalogue data in the production Supabase project before publishing. Configure authentication URL settings and SMTP as above.
4. Deploy, connect your domain, then test confirmation/reset emails, customer checkout and admin fulfilment on the deployed origin. Environment changes require rebuilding because the public values are bundled into the client.
5. Enable database backups appropriate to the business, review Supabase Auth rate limits and abuse protection, and monitor application/auth/database errors.

Any Node.js hosting service can also run `npm ci`, `npm run build`, and `npm start` behind HTTPS. A static-only host is not the intended deployment target.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

The database test executes the real schema and seed in embedded PostgreSQL (PGlite) with a minimal Supabase auth harness. It covers customer data isolation, role escalation rejection, admin-only writes, trusted prices, atomic stock updates, idempotent checkout, quantity limits, cancellation restoration and order transition checks. It is not a substitute for testing the actual hosted Supabase Auth service, email delivery, or production load.

Manual browser checks during development covered the home screen, cart add/quantity/remove, search, location filtering, account and protected admin pages. See `VERIFICATION.md` for the actual check results and remaining launch work.

## Project structure

- `app/`: Next.js entry point, metadata, favicon and responsive styles.
- `components/storefront.tsx`: customer routes and shared storefront state.
- `components/admin.tsx`: administrative forms and tables.
- `lib/models.ts`: shared types, checkout validation and money formatting.
- `lib/demo.ts`: credential-free demo catalogue.
- `supabase/`: complete schema/security policies and seed SQL.
- `tests/`: validation and PostgreSQL integration tests.

Demo product art uses system emoji, with no third-party photography or implied real merchant affiliation. Replace it with licensed shop/product photos using the admin image URL fields before launch. The screenshot supplies layout direction, not real merchant inventory. Font requests use Google Fonts with system fallbacks.

## Launch boundary

The project files are implemented and locally verified, but no live Supabase project, email provider, business catalogue or public deployment was supplied. These external integrations have not been verified end-to-end. Do not treat the local demo as a production service. Before accepting real orders, connect the backend, replace demo inventory/contact details, test on staging, and publish the business's contact/support, privacy, collection and cancellation terms. Online payments, delivery logistics, automated merchant notifications and tax invoices are outside the implemented pay-on-collection flow.

### Role dashboards

- `/customer` — Customer Hub: personal orders, in-progress purchases, and cart.
- `/merchant` — Merchant Studio: assigned shops, offer publishing, stock, and availability.
- `/admin` — Admin Console: marketplace listings, users, shop assignments, and order management.

Sign-in opens the dashboard for the account's role. New accounts remain customers. An administrator can change a user's role to `merchant` under Users, then edit a shop and select that shopkeeper. Merchants cannot assign ownership, feature listings, access other customers' orders, or manage other merchants' shops. Order fulfillment remains administrator-managed.

For an **existing database**, run `supabase/migrations/20261001_role_dashboards.sql` once in the Supabase SQL editor. Fresh installations use `supabase/schema.sql`, which already includes this migration. Dashboards require authenticated accounts; the disconnected demo remains a browsing catalogue.
