---
name: Account breakdown & subcategory transfers
description: How per-account category totals and balances are computed, and what "transfer between accounts" actually does
---

Account balances and the account-breakdown (`summary.ts /summary/account-breakdown`) are computed PURELY from `transactions.accountId` — never from any category/subcategory "home account" field. Breakdown aggregates deposits/expenses grouped by `subcategoryId` for a given account and skips null-subcategory rows.

- `categories.accountId` is a vestigial LABEL. It does NOT affect balances or the breakdown. The old category-level "transfer" only relabeled it and moved no money. Do not treat it as a source of truth for where money is.
- **Transfer between accounts = MOVE money at the subcategory level** via `POST /transactions/move` (`{subcategoryId, fromAccountId, toAccountId}` → `moveSubcategoryFunds`). It reassigns `accountId` on every transaction matching `(fromAccountId, subcategoryId)` and returns `{moved}`. Because balances/breakdown are transaction-based, this correctly shifts the balance and the category line to the target account.

**Why:** User wants to deposit the full salary into one account, then move individual subcategory buckets (including remainder "المتبقي" and debt "الأقساط") to other bank accounts. Reassigning transactions is the only thing that actually moves money in this data model.

**How to apply:** For anything "which account does this money live in", filter transactions by `accountId`. UI transfer control lives per-subcategory in `account-detail.tsx` (a "نقل إلى" account select defaulting to the current page's account). After a move, invalidate breakdown for BOTH accounts + accounts list + dashboard. Handle `moved === 0` (no funds) with a distinct message.
