---
name: Salary processing creates categorized deposits
description: How /salary/process turns salary + allocations + loans into real deposit transactions
---

Processing a salary month (`POST /salary/process`) creates REAL deposit transactions, not just budget updates. It is RE-RUNNABLE (idempotent refresh), not a one-shot.

- Requires `salary.accountId`. If null, returns `{processed:false}` with an Arabic message to pick a deposit account first — it does NOT silently skip.
- **Re-runnable**: inside one DB transaction it first takes a per-month advisory lock (`pg_advisory_xact_lock(hashtext('salary-process-'||month))`) to serialize concurrent runs, then DELETEs prior salary deposits for the month (`type='deposit' AND notes LIKE 'راتب {month}%'`) and recreates them. The delete is constrained to `type='deposit'` + the note prefix so manual deposits/expenses are never touched.
- One deposit per allocation, tagged with `subcategoryId` (may be null), note `راتب {month} - {label}`.
- Remainder and debt are surfaced as REAL subcategories (not null) via `ensureSystemSubcategory` find-or-create, guarded by a global advisory lock `salary-system-subcategories`: system categories "المتبقي من الراتب" (sub "إدخال") and "الديون" (sub "الأقساط"). Looked up by NAME, auto-recreated if the user deletes them. All active loans share the ONE "الأقساط" subcategory (the per-loan name only lives in the deposit note `قسط {loan.name}`, never as a subcategory).
- **Renaming a system subcategory (find-or-create-by-name) does NOT rename old rows.** Changing "المتبقي"→"إدخال" makes the code create a NEW subcategory; deposits from previously-processed months stay under the old name until that month is REPROCESSED (reprocess deletes+recreates the month's deposits under the new sub). Same applies in production after a deploy: user must re-run "معالجة الراتب" per month to migrate old data.
- One deposit per ACTIVE loan (`loansTable` where `isActive`), amount = `monthlyInstallment`, subcategoryId = debt sub, note `راتب {month} - قسط {loan.name}`.
- Final remainder deposit = `salary - sum(allocations) - sum(active loan installments)`, subcategoryId = remainder sub, note `راتب {month} - غير موزع` (or full `راتب {month}` when nothing committed).
- **Why real subcategories:** the account-breakdown (`summary.ts`) groups by subcategoryId and SKIPS null rows, so remainder/debt were invisible in the breakdown though they hit the balance. Tagging them makes the per-category totals equal the account balance AND makes them transferable/spendable like any subcategory. Legacy null-subcategory salary rows from older months only migrate when that month is reprocessed.
- Guard: reject (`processed:false`) if `allocations + loan installments > salary`. Processing-log insert uses `.onConflictDoNothing()` (log is informational only, no longer blocks).

**Why:** User's mental model is that the FULL salary is deposited into the account and split into buckets — categories AND debt/loans — so they can then transfer portions anywhere. A stale bug (old code logged a month as processed even when accountId was null, creating no deposit) permanently blocked re-processing via an "already processed" early-return; that early-return was removed so processing always deposits. Keep total deposited == salary.amount in every branch.

**How to apply:** Never re-add an "already processed" early-return — the delete-and-recreate flow is what makes it self-healing. The DELETE match relies on the `راتب {month}` note prefix; if you change the note format, update the delete predicate in lockstep or reprocessing will leave duplicates. Loans ARE deposited now (as debt) — this reverses the earlier "loans are not auto-converted" note.
