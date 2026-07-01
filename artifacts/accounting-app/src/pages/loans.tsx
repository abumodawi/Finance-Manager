import { useState } from "react";
import {
  useListLoans,
  useCreateLoan,
  useUpdateLoan,
  useDeleteLoan,
  getListLoansQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";

type LoanForm = {
  name: string;
  totalAmount: string;
  months: string;
  startDate: string;
};

const EMPTY_FORM: LoanForm = {
  name: "",
  totalAmount: "",
  months: "",
  startDate: new Date().toISOString().slice(0, 10),
};

export default function Loans() {
  const { data: loans, isLoading } = useListLoans();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createLoan = useCreateLoan();
  const updateLoan = useUpdateLoan();
  const deleteLoan = useDeleteLoan();

  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<LoanForm>(EMPTY_FORM);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListLoansQueryKey() });

  // Auto-calculated monthly installment
  const totalNum = parseFloat(form.totalAmount) || 0;
  const monthsNum = parseInt(form.months) || 0;
  const monthlyInstallment = monthsNum > 0 ? totalNum / monthsNum : 0;

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  };

  const openEdit = (loan: NonNullable<typeof loans>[number]) => {
    setEditId(loan.id);
    setForm({
      name: loan.name,
      totalAmount: String(loan.totalAmount),
      months: String(loan.months),
      startDate: loan.startDate,
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const months = parseInt(form.months);
    const total = parseFloat(form.totalAmount);
    if (!form.name || !total || !months) {
      toast({ title: "يرجى تعبئة جميع الحقول", variant: "destructive" });
      return;
    }
    const installment = months > 0 ? total / months : 0;

    if (editId !== null) {
      updateLoan.mutate(
        {
          id: editId,
          data: {
            name: form.name,
            totalAmount: total,
            monthlyInstallment: installment,
            months,
          },
        },
        {
          onSuccess: () => {
            invalidate();
            setIsOpen(false);
            toast({ title: "تم تحديث الدين بنجاح" });
          },
          onError: () => toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" }),
        }
      );
    } else {
      createLoan.mutate(
        {
          data: {
            name: form.name,
            totalAmount: total,
            monthlyInstallment: installment,
            months,
            startDate: form.startDate,
          },
        },
        {
          onSuccess: () => {
            invalidate();
            setIsOpen(false);
            setForm(EMPTY_FORM);
            toast({ title: "تم إضافة الدين بنجاح" });
          },
          onError: () => toast({ title: "حدث خطأ أثناء الإضافة", variant: "destructive" }),
        }
      );
    }
  };

  const handleToggleActive = (id: number, isActive: boolean) => {
    updateLoan.mutate(
      { id, data: { isActive: !isActive } },
      { onSuccess: () => { invalidate(); toast({ title: !isActive ? "تم تفعيل الدين" : "تم تعطيل الدين" }); } }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا الدين؟")) {
      deleteLoan.mutate(
        { id },
        { onSuccess: () => { invalidate(); toast({ title: "تم حذف الدين" }); } }
      );
    }
  };

  const activeLoans = loans?.filter((l) => l.isActive) ?? [];
  const totalMonthly = activeLoans.reduce((s, l) => s + l.monthlyInstallment, 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">الديون والأقساط</h2>
          {activeLoans.length > 0 && (
            <p className="text-muted-foreground text-sm mt-1">
              إجمالي الأقساط الشهرية:{" "}
              <span className="font-semibold text-orange-600">{formatCurrency(totalMonthly)}</span>
            </p>
          )}
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="ml-2 h-4 w-4" /> إضافة دين
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editId !== null ? "تعديل الدين" : "إضافة دين جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>اسم الدين</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: قرض السيارة"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>المبلغ الإجمالي</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={form.totalAmount}
                      onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                      dir="ltr"
                      className="text-right pr-10"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ر.س</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>عدد الأشهر</Label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={form.months}
                    onChange={(e) => setForm({ ...form, months: e.target.value })}
                    dir="ltr"
                    className="text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>القسط الشهري</Label>
                  <div className="relative">
                    <Input
                      readOnly
                      tabIndex={-1}
                      value={monthlyInstallment > 0 ? monthlyInstallment.toFixed(2) : ""}
                      placeholder="تلقائي"
                      dir="ltr"
                      className="text-right pr-10 bg-muted font-bold text-orange-600"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ر.س</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>تاريخ أول قسط</Label>
                  <Input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    dir="ltr"
                    disabled={editId !== null}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                يُحسب القسط الشهري تلقائياً: المبلغ الإجمالي ÷ عدد الأشهر
              </p>

              <Button type="submit" className="w-full" disabled={createLoan.isPending || updateLoan.isPending}>
                {editId !== null ? "حفظ التعديلات" : "إضافة الدين"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {loans?.map((loan) => {
            const paidMonths = loan.months - loan.remainingMonths;
            const pct = loan.months > 0 ? Math.round((paidMonths / loan.months) * 100) : 0;
            return (
              <Card key={loan.id} className={`relative group ${!loan.isActive ? "opacity-60" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-full bg-orange-100 dark:bg-orange-900/30">
                        <CreditCard className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base">{loan.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          بدأ: {loan.startDate} · {loan.months} شهر إجمالاً
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={loan.isActive}
                        onCheckedChange={() => handleToggleActive(loan.id, loan.isActive)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => openEdit(loan)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                        onClick={() => handleDelete(loan.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">القسط الشهري</p>
                      <p className="font-bold text-orange-600">{formatCurrency(loan.monthlyInstallment)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">المبلغ الإجمالي</p>
                      <p className="font-semibold">{formatCurrency(loan.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">أشهر متبقية</p>
                      <p className="font-bold">{loan.remainingMonths}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>المدفوع {pct}%</span>
                      <span>{paidMonths} من {loan.months} شهر</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {!loan.isActive && (
                    <Badge variant="secondary" className="mt-2">معطل</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {loans?.length === 0 && (
            <div className="text-center p-12 border border-dashed rounded-lg text-muted-foreground">
              لا توجد ديون أو أقساط مسجلة
            </div>
          )}
        </div>
      )}
    </div>
  );
}
