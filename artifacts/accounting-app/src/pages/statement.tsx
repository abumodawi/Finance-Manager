import { useMemo, useState } from "react";
import { 
  useGetAccountStatement,
  useListAccounts,
  getGetAccountStatementQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { formatCurrency, formatDate, salaryMonthOf, cn } from "@/lib/utils";

export default function Statement() {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const { data: accounts } = useListAccounts();
  const accountIdNum = selectedAccountId ? parseInt(selectedAccountId) : 0;

  const { data: statement, isLoading } = useGetAccountStatement(
    { accountId: accountIdNum, month: filterMonth },
    { query: { enabled: !!accountIdNum, queryKey: getGetAccountStatementQueryKey({ accountId: accountIdNum, month: filterMonth }) } }
  );

  // Collapse consecutive per-subcategory salary deposits (same date) into one
  // "الراتب" line, keeping the running balance after the last of them.
  const rows = useMemo(() => {
    const txs = statement?.transactions ?? [];
    const out: Array<
      | { kind: "tx"; tx: (typeof txs)[number] }
      | { kind: "salary"; key: string; date: string; amount: number; runningBalance: number }
    > = [];
    let i = 0;
    while (i < txs.length) {
      const m = salaryMonthOf(txs[i]);
      if (m) {
        let amount = 0;
        let runningBalance = txs[i].runningBalance;
        let j = i;
        while (j < txs.length && salaryMonthOf(txs[j]) === m) {
          amount += txs[j].amount;
          runningBalance = txs[j].runningBalance;
          j++;
        }
        out.push({ kind: "salary", key: `salary-${m}-${i}`, date: txs[i].date, amount, runningBalance });
        i = j;
      } else {
        out.push({ kind: "tx", tx: txs[i] });
        i++;
      }
    }
    return out;
  }, [statement]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">كشف الحساب</h2>
      
      <div className="flex gap-4 p-4 bg-card rounded-xl border shadow-sm">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">اختر الحساب</label>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="اختر حساباً..." />
            </SelectTrigger>
            <SelectContent>
              {accounts?.map(acc => (
                <SelectItem key={acc.id} value={acc.id.toString()}>{acc.emoji} {acc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">الشهر</label>
          <Input 
            type="month" 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)}
          />
        </div>
      </div>

      {!selectedAccountId ? (
        <div className="text-center p-12 border border-dashed rounded-xl text-muted-foreground bg-muted/20">
          قم باختيار حساب لعرض كشف الحساب الخاص به
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          <div className="h-24 bg-muted animate-pulse rounded-xl" />
          <div className="h-96 bg-muted animate-pulse rounded-xl" />
        </div>
      ) : statement ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-muted/50 border-none shadow-none">
              <CardContent className="p-6">
                <div className="text-sm text-muted-foreground mb-1">الرصيد الافتتاحي (أول الشهر)</div>
                <div className="text-2xl font-bold">{formatCurrency(statement.openingBalance)}</div>
              </CardContent>
            </Card>
            <Card className="bg-primary text-primary-foreground border-none shadow-none">
              <CardContent className="p-6">
                <div className="text-sm opacity-90 mb-1">الرصيد الختامي (نهاية الشهر)</div>
                <div className="text-2xl font-bold">{formatCurrency(statement.closingBalance)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">سجل الحركات</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-right">
                    <th className="p-3 font-medium w-10"></th>
                    <th className="p-3 font-medium whitespace-nowrap">التاريخ</th>
                    <th className="p-3 font-medium whitespace-nowrap">المبلغ</th>
                    <th className="p-3 font-medium whitespace-nowrap">الحساب البنكي</th>
                    <th className="p-3 font-medium whitespace-nowrap">التصنيف</th>
                    <th className="p-3 font-medium whitespace-nowrap">الرصيد</th>
                    <th className="p-3 font-medium">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) =>
                    row.kind === "salary" ? (
                      <tr key={row.key} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3">
                          <div className="p-1.5 rounded-full bg-green-600/10 text-green-600 w-fit">
                            <ArrowDownCircle className="h-5 w-5" />
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{formatDate(row.date)}</td>
                        <td className="p-3 font-bold text-green-600 whitespace-nowrap">+{formatCurrency(row.amount)}</td>
                        <td className="p-3 whitespace-nowrap">
                          {statement.account.emoji} {statement.account.name}
                        </td>
                        <td className="p-3 font-medium whitespace-nowrap">الراتب</td>
                        <td className="p-3 font-bold whitespace-nowrap bg-muted/10">
                          {formatCurrency(row.runningBalance)}
                        </td>
                        <td className="p-3 text-muted-foreground">-</td>
                      </tr>
                    ) : (
                      <tr key={row.tx.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3">
                          <div className={cn("p-1.5 rounded-full w-fit", row.tx.type === "expense" ? "bg-destructive/10 text-destructive" : "bg-green-600/10 text-green-600")}>
                            {row.tx.type === "expense" ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{formatDate(row.tx.date)}</td>
                        <td className={cn("p-3 font-bold whitespace-nowrap", row.tx.type === "expense" ? "text-destructive" : "text-green-600")}>
                          {row.tx.type === "expense" ? "-" : "+"}{formatCurrency(row.tx.amount)}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {statement.account.emoji} {statement.account.name}
                        </td>
                        <td className="p-3 font-medium whitespace-nowrap">
                          {row.tx.subcategoryName || (row.tx.type === 'deposit' ? 'إيداع' : 'مصروف')}
                        </td>
                        <td className="p-3 font-bold whitespace-nowrap bg-muted/10">
                          {formatCurrency(row.tx.runningBalance)}
                        </td>
                        <td className="p-3 text-muted-foreground max-w-[200px] truncate">{row.tx.notes || "-"}</td>
                      </tr>
                    )
                  )}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">لا توجد حركات في هذه الفترة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
