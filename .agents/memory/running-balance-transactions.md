---
name: Running balance in transactions/statement
description: How per-account running balance is computed and why salary rows collapse the way they do
---

# Running balance (العمليات + كشف الحساب)

The transactions list (`GET /transactions`) and the account-statement endpoint return a per-account `runningBalance` (balance AFTER each operation) plus `accountName`. Both the العمليات (transactions.tsx) and كشف الحساب (statement.tsx) pages render a 7-column table: colored arrow, date, colored amount (red expense `-`, green deposit `+`), bank account, category, running balance, notes.

**Computation:** per account, opening = `initialBalance` + sum of all prior-month transactions when a `month` filter is set (no month = from account creation). Then apply each op chronologically. Verified: the last runningBalance per account equals the `/accounts` balance exactly for every account.

**Why salary rows collapse:** salary deposits for a month are consecutive, same-account rows. The UI collapses them into a single "الراتب" row and shows the LAST salary deposit's runningBalance (= post-salary balance). This is intentional and correct for the auto-generated salary batches (see salary-processing-deposits.md).

**Edge-case caveat:** collapse groups by `salaryMonthOf()` (month token), not a strict contiguous-batch identity. If a user ever creates a manual deposit whose notes match the salary pattern, or salary rows become non-contiguous, the collapsed row could show a balance from a later row at an earlier position. Not an issue for current data, but harden to contiguous-batch grouping if salary grouping bugs appear.
