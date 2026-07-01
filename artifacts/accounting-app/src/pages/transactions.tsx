import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Transactions() {
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const { data: transactions, isLoading } = useListTransactions({ month: filterMonth });
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
    if (formData.type === "expense" && formData.subcategoryId === "none") return alert("اختر التصنيف");

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold">العمليات</h2>
        <div className="flex items-center gap-2">
          <Input 
            type="month" 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)}
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

                {formData.type === "expense" && (
                  <div className="space-y-2">
                    <Label>التصنيف</Label>
                    <Select value={formData.subcategoryId} onValueChange={v => setFormData({...formData, subcategoryId: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر التصنيف..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map(cat => (
                          <div key={cat.id}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">{cat.emoji} {cat.name}</div>
                            {cat.subcategories?.map(sub => (
                              <SelectItem key={sub.id} value={sub.id.toString()} className="pl-6">
                                {sub.emoji} {sub.name}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {[1,2,3,4].map(i => <div key={i} className="h-16 animate-pulse bg-muted/50" />)}
            </div>
          ) : (
            <div className="divide-y">
              {transactions?.map(tx => (
                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-full", tx.type === "expense" ? "bg-destructive/10 text-destructive" : "bg-green-600/10 text-green-600")}>
                      {tx.type === "expense" ? <ArrowUpCircle className="h-6 w-6" /> : <ArrowDownCircle className="h-6 w-6" />}
                    </div>
                    <div>
                      <div className="font-semibold text-base">
                        {tx.type === "expense" ? tx.subcategoryName : "إيداع"}
                        {tx.notes && <span className="text-sm font-normal text-muted-foreground mr-2">({tx.notes})</span>}
                      </div>
                      <div className="text-sm text-muted-foreground">{formatDate(tx.date)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={cn("font-bold text-lg", tx.type === "expense" ? "text-destructive" : "text-green-600")}>
                      {tx.type === "expense" ? "-" : "+"}{formatCurrency(tx.amount)}
                    </div>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDelete(tx.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!transactions || transactions.length === 0) && (
                <div className="p-12 text-center text-muted-foreground">لا توجد عمليات في هذا الشهر</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
