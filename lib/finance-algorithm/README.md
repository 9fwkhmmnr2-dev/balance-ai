# FINANCE: ALGORITHM CORE

First deterministic foundation for personalized financial analysis.

## Current scope

- Accepts normalized profile, active commitments, optional goals, and preferences.
- Normalizes reported income and commitments to monthly amounts.
- Keeps currencies separate; never applies an implicit exchange rate.
- Produces explainable insights with evidence, confidence, and explicit limitations.
- Marks every insight as requiring user confirmation.
- Performs no database writes, transfers, purchases, or automatic financial actions.

## Important interpretation rules

- A positive amount after known commitments is **not** disposable income or proven savings capacity. Unregistered expenses are not included.
- Approximate commitments reduce confidence.
- Variable or missing income is not converted into a guessed monthly figure.
- Goals are not treated as purchase intent and do not produce suggested contributions without supporting data.
- The engine does not infer that an interest (for example, technology or furniture) means the user intends to buy something.
- Currency totals are never combined across currencies.

## Next implementation steps

1. Add and secure the separate per-user preferences store.
2. Add Preferences to onboarding and profile editing.
3. Add authorized server-side data loading and map database rows into the normalized input contract.
4. Add candidate operation generation and user review/accept/reject feedback.
5. Add automated tests for currency separation, frequency normalization, missing data, and ownership boundaries.

This module is a foundation, not a complete personalized operations system.
