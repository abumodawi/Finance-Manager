import { useMemo, useState } from "react";
import { 
  useListTransactions, 
  useCreateTransaction, 
  useDeleteTransaction,
  useListAccounts,
  useListCategories,
  getListTransactionsQueryKey,
  getListAccountsQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { formatCurrency, formatDate, salaryMonthOf } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Transactions() {
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [showAll, setShowAll] = useState(false);
  const { data: transactions, isLoading } = useListTransactions(showAll ? {} : { month: filterMonth });
  const { data: accounts } = useListAccounts();
  const { data: categories } = useListCategories();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createTransaction = useCreateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "expense" as "expense" | "deposit",
    amount: "",
    date: new Date().toISOString().split('T')[0],
    accountId: "",
    subcategoryId: "none",
    notes: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountId) return alert("اختر الحساب");
    if (formData.subcategoryId === "none") return alert("اختر التصنيف");

    const payload = {
      type: formData.type,
      amount: parseFloat(formData.amount),
      date: formData.date,
      accountId: parseInt(formData.accountId),
      subcategoryId: formData.subcategoryId === "none" ? null : parseInt(formData.subcategoryId),
      notes: formData.notes || null
    };

    createTransaction.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setIsOpen(false);
        setFormData({ ...formData, amount: "", notes: "" });
        toast({ title: "تم إضافة العملية بنجاح" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذه العملية؟ سيتم تحديث رصيد الحساب.")) {
      deleteTransaction.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "تم حذف العملية بنجاح" });
        }
      });
    }
  };

  const handleDeleteSalary = async (ids: number[]) => {
    if (!confirm("سيتم حذف الراتب بالكامل (جميع إيداعات هذا الشهر). هل أنت متأكد؟")) return;
    try {
      for (const id of ids) {
        await deleteTransaction.mutateAsync({ id });
      }
      queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast({ title: "تم حذف الراتب" });
    } catch {
      toast({ title: "حدث خطأ أثناء الحذف", variant: "destructive" });
    }
  };

  // Collapse the many per-subcategory salary deposits of a month into a single
  // "الراتب" row so the operations list stays readable.
  const displayRows = useMemo(() => {
    const list = transactions ?? [];
    const groups = new Map<
      string,
      { date: string; amount: number; ids: number[]; accountName: string | null; runningBalance: number | null }
    >();
    for (const tx of list) {
      const m = salaryMonthOf(tx);
      if (!m) continue;
      const g =
        groups.get(m) ??
        { date: tx.date, amount: 0, ids: [], accountName: tx.accountName ?? null, runningBalance: tx.runningBalance ?? null };
      g.amount += tx.amount;
      g.ids.push(tx.id);
      // rows arrive in chronological order, so the last salary deposit carries
      // the account balance right after the whole salary was credited.
      g.runningBalance = tx.runningBalance ?? g.runningBalance;
      groups.set(m, g);
    }
    const emitted = new Set<string>();
    const rows: Array<
      | { kind: "tx"; tx: (typeof list)[number] }
      | {
          kind: "salary";
          key: string;
          date: string;
          amount: number;
          ids: number[];
          accountName: string | null;
          runningBalance: number | null;
        }
    > = [];
    for (const tx of list) {
      const m = salaryMonthOf(tx);
      if (m) {
        if (!emitted.has(m)) {
          emitted.add(m);
          const g = groups.get(m)!;
          rows.push({
            kind: "salary",
            key: `salary-${m}`,
            date: g.date,
            amount: g.amount,
            ids: g.ids,
            accountName: g.accountName,
            runningBalance: g.runningBalance,
          });
        }
      } else {
        rows.push({ kind: "tx", tx });
      }
    }
    return rows;
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold">العمليات</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={showAll ? "default" : "outline"}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "كل الشهور" : "شهر محدد"}
          </Button>
          <Input 
            type="month" 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)}
            disabled={showAll}
            className="w-40"
          />
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="ml-2 h-4 w-4" /> إضافة عملية</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>إضافة عملية جديدة</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2 p-1 bg-muted rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: "expense"})}
                    className={cn(
                      "flex-1 py-2 text-sm font-bold rounded-md transition-colors",
                      formData.type === "expense" ? "bg-destructive text-destructive-foreground shadow-sm" : "hover:bg-muted-foreground/10"
                    )}
                  >
                    مصروف
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: "deposit"})}
                    className={cn(
                      "flex-1 py-2 text-sm font-bold rounded-md transition-colors",
                      formData.type === "deposit" ? "bg-green-600 text-white shadow-sm" : "hover:bg-muted-foreground/10"
                    )}
                  >
                    إيداع
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>المبلغ</Label>
                    <Input required type="number" step="0.01" min="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} dir="ltr" className="text-right font-bold text-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label>التاريخ</Label>
                    <Input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>الحساب البنكي</Label>
                  <Select value={formData.accountId} onValueChange={v => setFormData({...formData, accountId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الحساب..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map(acc => (
                        <SelectItem key={acc.id} value={acc.id.toString()}>{acc.emoji} {acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{formData.type === "expense" ? "تصنيف المصروف" : "تصنيف الإيداع"}</Label>
                  <Select value={formData.subcategoryId} onValueChange={v => setFormData({...formData, subcategoryId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر التصنيف..." />
                    </SelectTrigger>
                    <SelectContent position="popper" side="bottom" avoidCollisions={false} className="max-h-72">
                      {categories?.map(cat => (
                        <SelectGroup key={cat.id}>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground bg-muted/50">{cat.emoji} {cat.name}</SelectLabel>
                          {cat.subcategories?.map(sub => (
                            <SelectItem key={sub.id} value={sub.id.toString()} className="pr-8">
                              {sub.emoji} {sub.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>ملاحظات (اختياري)</Label>
                  <Input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="تفاصيل إضافية..." />
                </div>

                <Button type="submit" className="w-full" disabled={createTransaction.isPending}>إضافة</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="divide-y">
              {[1,2,3,4].map(i => <div key={i} className="h-16 animate-pulse bg-muted/50" />)}
            </div>
          ) : (
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
                  <th className="p-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayRows.map((row) =>
                  row.kind === "salary" ? (
                    <tr key={row.key} className="hover:bg-muted/20 transition-colors group">
                      <td className="p-3">
                        <div className="p-1.5 rounded-full bg-green-600/10 text-green-600 w-fit">
                          <ArrowDownCircle className="h-5 w-5" />
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{formatDate(row.date)}</td>
                      <td className="p-3 font-bold text-green-600 whitespace-nowrap">+{formatCurrency(row.amount)}</td>
                      <td className="p-3 whitespace-nowrap">{row.accountName ?? "-"}</td>
                      <td className="p-3 font-medium whitespace-nowrap">الراتب</td>
                      <td className="p-3 font-bold whitespace-nowrap bg-muted/10">
                        {row.runningBalance != null ? formatCurrency(row.runningBalance) : "-"}
                      </td>
                      <td className="p-3 text-muted-foreground">-</td>
                      <td className="p-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDeleteSalary(row.ids)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.tx.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="p-3">
                        <div className={cn("p-1.5 rounded-full w-fit", row.tx.type === "expense" ? "bg-destructive/10 text-destructive" : "bg-green-600/10 text-green-600")}>
                          {row.tx.type === "expense" ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{formatDate(row.tx.date)}</td>
                      <td className={cn("p-3 font-bold whitespace-nowrap", row.tx.type === "expense" ? "text-destructive" : "text-green-600")}>
                        {row.tx.type === "expense" ? "-" : "+"}{formatCurrency(row.tx.amount)}
                      </td>
                      <td className="p-3 whitespace-nowrap">{row.tx.accountName ?? "-"}</td>
                      <td className="p-3 font-medium whitespace-nowrap">
                        {row.tx.subcategoryName ?? (row.tx.type === "expense" ? "مصروف" : "إيداع")}
                      </td>
                      <td className="p-3 font-bold whitespace-nowrap bg-muted/10">
                        {row.tx.runningBalance != null ? formatCurrency(row.tx.runningBalance) : "-"}
                      </td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate">{row.tx.notes || "-"}</td>
                      <td className="p-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDelete(row.tx.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                )}
                {displayRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-muted-foreground">لا توجد عمليات في هذا الشهر</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
