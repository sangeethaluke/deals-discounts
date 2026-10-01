# Verification record

## Passed locally

- Optimized Next.js production build and TypeScript checks.
- PostgreSQL integration tests using the actual schema and seed in PGlite: profile/order isolation, role escalation rejection, unauthorized catalogue writes, database prices, stock decrement, duplicate request reuse, quantity validation, insufficient stock, expired offers, suspended customers, admin-only status changes, transition validation, and stock restoration exactly once.
- Browser: home layout, add to cart, quantity change (₹1,299 → ₹2,598), remove/empty cart, sneakers search, location change to an empty catalogue, account page and unsigned admin access gate.
- Responsive home inspected at 390 × 844; document width equals viewport width (no horizontal overflow).
- Local production server returns HTTP 200.
- npm dependency audit reported zero known vulnerabilities at install time.

## Not yet verified

- Hosted Supabase auth/email confirmation/password recovery, SMTP delivery and real user/admin browser flows. No project credentials were provided.
- Public deployment, domain, HTTPS configuration, real catalogue images/data, business order fulfilment or production load.
- Concurrent multi-connection stock contention (transaction logic is implemented; embedded tests run serially).
- Accessibility audit across screen readers, browsers and 200% text zoom.

Node.js 22 is required by the current Supabase SDK. The final production build uses Node.js 22. Demo imagery uses emoji and can be replaced through the admin image URL field.
