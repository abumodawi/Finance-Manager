---
name: Account breakdown & subcategory transfers
description: How per-account category totals and balances are computed, and what "transfer between accounts" actually does
---

Account balances and the account-breakdown (`summary.ts /summary/account-breakdown`) are computed PURELY from `transactions.accountId` — never from any category/subcategory "home account" field. Breakdown aggregates deposits/expenses grouped by `subcategoryId` for a given account and skips null-subcategory rows.

- `categories.accountId` is a vestigial LABEL. It does NOT affect balances or the breakdown. The old category-level "transfer" only relabeled it and moved no money. Do not treat it as a source of truth for where money is.
- **Transfer between accounts = MOVE money at the subcategory level** via `POST /transactions/move` (`{subcategoryId, fromAccountId, toAccountId, amount?}` → `moveSubcategoryFunds`), returns `{moved}`.
  - **Full move** (amount omitted, or amount ≥ available net): reassigns `accountId` on every transaction matching `(fromAccountId, subcategoryId)` — no residue, keeps history.
  - **Partial move** (0 < amount < available net): does NOT reassign. Creates a BALANCING PAIR in one DB transaction — an `expense` of amount in the SOURCE (note `تحويل إلى {toAccount}`) + a `deposit` of amount in the TARGET (note `تحويل من {fromAccount}`), both tagged to the same subcategory. Net effect: source drops by amount, target rises by amount, global total conserved. The leftover stays in the source.
  - The read of available net AND the mutation run inside ONE `db.transaction` guarded by `pg_advisory_xact_lock(hashtext('subcat-move-{from}-{sub}'))` so concurrent moves can't both pass validation and overdraw. Amount is normalized to 2 decimals server-side before compare/persist.
  - available net = deposits − expenses for `(fromAccountId, subcategoryId)`; if ≤ 0 returns `{moved:0}`.

**Why:** User wants to deposit the full salary into one account, then move individual subcategory buckets (including remainder "المتبقي" and debt "الأقساط") to other bank accounts. Reassigning transactions is the only thing that actually moves money in this data model.

**How to apply:** For anything "which account does this money live in", filter transactions by `accountId`. UI transfer control lives per-subcategory in `account-detail.tsx` (`TransferPopover`: target-account select + amount input defaulting to full net, with an "الكل" fill button). After a move, invalidate breakdown for BOTH accounts + accounts list + dashboard. Handle `moved === 0` (no funds) with a distinct message.
