---
name: Salary processing creates categorized deposits
description: How /salary/process turns salary + allocations + loans into real deposit transactions
---

Processing a salary month (`POST /salary/process`) creates REAL deposit transactions, not just budget updates. It is RE-RUNNABLE (idempotent refresh), not a one-shot.

- Requires `salary.accountId`. If null, returns `{processed:false}` with an Arabic message to pick a deposit account first — it does NOT silently skip.
- **Re-runnable**: inside one DB transaction it first takes a per-month advisory lock (`pg_advisory_xact_lock(hashtext('salary-process-'||month))`) to serialize concurrent runs, then DELETEs prior salary deposits for the month (`type='deposit' AND notes LIKE 'راتب {month}%'`) and recreates them. The delete is constrained to `type='deposit'` + the note prefix so manual deposits/expenses are never touched.
- One deposit per allocation, tagged with `subcategoryId` (may be null), note `راتب {month} - {label}`.
- One deposit per ACTIVE loan (`loansTable` where `isActive`), amount = `monthlyInstallment`, subcategoryId null, note `راتب {month} - قسط {loan.name}`. This is the "debt" portion the user wants shown alongside categories.
- Final remainder deposit = `salary - sum(allocations) - sum(active loan installments)`, note `راتب {month} - غير موزع` (or full `راتب {month}` when nothing committed).
- Guard: reject (`processed:false`) if `allocations + loan installments > salary`. Processing-log insert uses `.onConflictDoNothing()` (log is informational only, no longer blocks).

**Why:** User's mental model is that the FULL salary is deposited into the account and split into buckets — categories AND debt/loans — so they can then transfer portions anywhere. A stale bug (old code logged a month as processed even when accountId was null, creating no deposit) permanently blocked re-processing via an "already processed" early-return; that early-return was removed so processing always deposits. Keep total deposited == salary.amount in every branch.

**How to apply:** Never re-add an "already processed" early-return — the delete-and-recreate flow is what makes it self-healing. The DELETE match relies on the `راتب {month}` note prefix; if you change the note format, update the delete predicate in lockstep or reprocessing will leave duplicates. Loans ARE deposited now (as debt) — this reverses the earlier "loans are not auto-converted" note.
