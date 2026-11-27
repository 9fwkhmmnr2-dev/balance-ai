# FINANCE PLUS — Product and implementation plan

Status: working specification, not a production release.
Working branch: `feature/finance-plus-unification`
Base branch: `feature/mis-cuentas`

## Product structure

- FINANCE.TRACK is the financial platform.
- VERA is the integrated financial assistant, not a separate paid product.
- FINANCE FREE is the free plan.
- FINANCE PLUS is the only paid plan.
- Keep the existing database plan values `free` and `premium` initially for compatibility; show `premium` as FINANCE PLUS in the UI. Do not create a second subscription system.
- Retire the VERA GOLD brand and route. Preserve old URLs with a redirect to `/finance-plus` until all old links are migrated.

## Plan matrix

### FREE
- Accounts, movements, transfers, budgets and goals: core functionality.
- VERA: basic assistant access, shorter context and conservative fair-use limits.
- Markets: public market overview, company directory, favorites and daily data when display licensing permits.
- Price comparison: available in every plan.
- Notifications: essential in-app alerts and a low-frequency summary.
- Monthly finance summary: basic, factual totals and categories.

### FINANCE PLUS
- VERA: higher fair-use allowance, longer conversations, more detailed answers and deeper analysis.
- Financial analysis: compare periods, categories and trends; explain changes using the user's actual records.
- Decision simulator: purchases, payments, installments and alternatives; separate known data from assumptions.
- Financial position: historical cash-flow view, liquidity estimate and coverage indicators with clear data-quality caveats.
- Document intelligence: PDF, XLSX, CSV and DOCX statement/receipt ingestion, transaction extraction, automatic categorization with user review before saving, and question-answering over the uploaded document.
- Monthly close: AI-generated report based on actual movements and account data.
- Goal planning: contribution scenarios and projections.
- Notifications: customizable thresholds, unusual spending signals, due-date reminders, favorite-market alerts (only when licensed data supports them), and a richer weekly/monthly VERA digest.
- No plan should execute transfers, payments, trades or edits to financial records without a separate explicit user confirmation.

## VERA integration

- Keep the existing provider abstraction so the AI provider can be changed without rebuilding product logic.
- Connect only the minimum relevant user-owned financial context for each request.
- Enforce authentication, adult eligibility, current legal versions, explicit AI data consent, and row-level security on every server path.
- Entitlements must be checked server-side. Client UI state is never an authorization source.
- Consolidate legacy Gold checks into one subscription/entitlement service backed by `user_plan_subscriptions`; validate active status and expiry. Do not trust user-editable metadata as the subscription source of truth.
- Do not relax the existing adult/consent gates to test VERA.

## Markets / Wall Street

- Add expandable groups for indices, companies and followed markets.
- Initial indices: S&P 500, Nasdaq Composite and Dow Jones Industrial Average.
- Keep country company directories and favorites.
- Every quote must include instrument, symbol, currency, exchange, value, quote date/time, source, frequency/delay status and stale-data state.
- Never synthesize, infer or retain a stale quote as if current.
- Provider integration requires written confirmation that the selected plan grants public/external display rights for the intended countries, exchanges and commercial product. Free personal/internal API plans are not sufficient.
- Build a provider adapter and cache only after licensing is confirmed. Daily closing data is the first target; realtime is deferred until revenue supports the required licensing.

## Notifications

- Start with an in-app notification center and per-user preferences.
- Proposed event types: budget threshold, unusual spending, upcoming commitment, goal milestone, monthly close ready, favorite market movement and VERA insight.
- Free: essential alerts and low-frequency digest.
- Plus: custom thresholds, more alert types, market alerts (licensed source only), and richer digest.
- Store delivery status and deduplication keys to prevent repeated notifications.
- Add web push/email only after explicit opt-in, permission UX, unsubscribe controls and provider/legal review.
- Notifications are informational; avoid alarmist wording or claims that a market move predicts future performance.

## Billing and go-to-market

- Keep checkout disabled until the plan matrix, costs, legal terms, taxes, billing ownership and provider contracts are validated.
- Existing UI price is provisional only: USD 3.99/month and USD 39.99/year; validate before publishing.
- Payment account and contracts must be held by an eligible adult/legal business representative; do not bypass provider age or identity requirements.
- Later billing work: provider adapter, signed webhook verification, idempotent subscription updates, cancellation/expiry handling, receipts and support/refund flow.
- Later marketing: public landing page, feature comparison, onboarding, product demos, launch content and referral measurement. Start organic and measure activation, retention and conversion before paid acquisition.

## Delivery order

1. Audit and centralize plan entitlements; replace Gold terminology with FINANCE PLUS without breaking existing access.
2. Connect VERA to the full approved financial context and implement the Plus capability limits.
3. Implement in-app notifications, preferences, event generation and deduplication.
4. Build Wall Street accordion UI and provider adapter; activate live/daily quotes only after display rights are confirmed.
5. Implement document analysis and transaction review workflow.
6. Implement monthly close reports and the expanded simulator.
7. Validate pricing, billing/legal requirements, payment integration and launch marketing.

## Release discipline

- Work on `feature/finance-plus-unification`.
- Do not merge to `main` or deploy production without explicit approval.
- Validate preview build, RLS, server-side entitlement checks and user isolation before considering release.
- Database migrations must be committed alongside code and applied only to the intended environment after review.
