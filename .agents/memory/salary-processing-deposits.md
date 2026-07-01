---
name: Salary processing creates categorized deposits
description: How /salary/process turns salary + allocations into real deposit transactions
---

Processing a salary month (`POST /salary/process`) creates REAL deposit transactions, not just budget updates:

- Requires `salary.accountId`. If null, it returns `{processed:false}` with an Arabic message telling the user to pick a deposit account first — it does NOT silently skip.
- One deposit transaction per salary allocation, tagged with the allocation's `subcategoryId` (may be null for category-level allocations), dated `${month}-${depositDay}`, note `راتب {month} - {label}`.
- A final deposit for the unallocated remainder (`salary.amount - sum(allocations)`) with no subcategory, note `راتب {month} - غير موزع` (or the full salary as `راتب {month}` when there are no allocations).

**Why:** User's mental model is that salary money is "received" into each category bucket (including a debt allocation they create), and every deposit must show in the operations list + account statement + per-subcategory "received" in the account breakdown. The remainder deposit keeps the account balance equal to the full salary.

**How to apply:** Keep total deposited == salary.amount whenever changing this. Loans (loansTable) are separate from allocations and are NOT auto-converted to deposits — only user-created allocations become deposits. If asked to reflect loan installments as transactions, that's a distinct feature.
