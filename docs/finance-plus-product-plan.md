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
- Basic price comparison: available in every plan. FINANCE PLUS adds the advanced VERA: Modo Ahorro workflow described below.
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
- VERA: Modo Ahorro: advanced nearby merchant comparison, verified discounts, smart shopping lists, lower-cost alternatives and purchase-budget guidance.
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

## VERA: Modo Ahorro (FINANCE PLUS)

### Product promise
Help users spend less on planned purchases by comparing trustworthy local offers and the real total cost, not by presenting unverified discounts or generic spending advice.

### Core capabilities
1. **Nearby merchant comparison:** compare the same product and presentation across supermarkets, pharmacies, stores and other supported merchants. Show merchant, exact product/presentation, price, currency, distance when location is explicitly shared, availability when verified, source and last-updated timestamp.
2. **Discount and promotion finder:** surface coupons, bank/card promotions and merchant offers only when source, eligibility, validity dates, terms and geographic restrictions are known. Clearly label user-submitted or unverified offers and never present expired offers as active.
3. **Smart shopping list:** let users add products by text or image, quantity and preferred brands. Compare basket totals and optionally split a list across merchants only when the estimated savings exceed travel/delivery costs and any minimum-purchase conditions.
4. **Lower-cost alternatives:** suggest comparable products or pack sizes, normalizing price by unit (kg, litre, unit, etc.). Explain meaningful differences; do not claim products are identical when they are not.
5. **Purchase budget:** set a target amount for a shopping trip or list, identify over-budget items and suggest alternatives without pressuring the user to buy.
6. **Savings report:** estimate potential savings from verified comparable offers, then record realized savings only after the user confirms the actual purchase price. Separate estimates from confirmed savings.

### Data quality and privacy rules
- Every displayed offer must carry source, currency, product/presentation, checked-at time and freshness status. Include delivery fees, minimum basket, distance/travel estimate and promotion conditions in total-cost calculations when known.
- Never fabricate prices, stock, discounts, store locations, opening hours or availability. If no reliable source exists, say that no verified offer was found.
- Match exact product identity first (brand, model, size, flavour/variant, quantity and barcode when available). Do not compare unlike presentations without clearly marking the difference and normalizing unit price.
- Nearby comparison requires an explicit location permission or a user-entered area. Do not collect or retain precise location by default; allow approximate area and manual search.
- Do not sell, purchase, reserve, redeem coupons or share personal data with merchants. The module is advisory and does not initiate transactions.
- Respect provider licensing and merchant terms. No scraping or public commercial display unless the data source explicitly permits it.

### Plan boundaries
- **FINANCE FREE:** retain the existing basic/general price-comparison access; do not remove or paywall it.
- **FINANCE PLUS:** unlock Modo Ahorro's advanced local basket comparison, promotion eligibility checks, multiple-store optimization, image-assisted shopping lists, saved lists and VERA's personalized savings analysis.

### Delivery phases (no invented live data)
1. Build the module shell, list editor, product identity model, manual area entry and comparison-result schema.
2. Integrate one or more sources only after confirming geographic coverage, update frequency, commercial display rights and terms. Start with source-backed merchant/product data; keep manual price entry as a clearly labeled fallback.
3. Add discounts with validity/eligibility validation and a stale-offer policy.
4. Add basket optimization with travel/delivery/minimum-purchase costs and explainable calculations.
5. Add image-assisted item recognition and VERA summaries after accuracy and privacy testing.

**Release gate:** do not label the feature live or show sample/demo prices as real offers until an authorized data provider is integrated and freshness checks pass.

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
2. Connect VERA to the approved financial context and implement Plus capability limits.
3. Implement VERA: Modo Ahorro shell and source-backed local comparison; activate offers only after provider licensing and data-quality validation.
4. Implement in-app notifications, preferences, event generation and deduplication.
5. Build Wall Street accordion UI and provider adapter; activate live/daily quotes only after display rights are confirmed.
6. Complete document analysis, transaction review, monthly close reports and expanded simulator.
7. Validate pricing, billing/legal requirements, payment integration and launch marketing.

## Release discipline

- Work on `feature/finance-plus-unification`.
- Do not merge to `main` or deploy production without explicit approval.
- Validate preview build, RLS, server-side entitlement checks and user isolation before considering release.
- Database migrations must be committed alongside code and applied only to the intended environment after review.
