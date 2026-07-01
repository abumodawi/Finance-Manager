import { useState, useEffect } from "react";
import {
  useGetSalary,
  useUpsertSalary,
  useListSalaryAllocations,
  useCreateSalaryAllocation,
  useUpdateSalaryAllocation,
  useDeleteSalaryAllocation,
  useProcessSalary,
  useListLoans,
  useListCategories,
  useListAccounts,
  getGetSalaryQueryKey,
  getListSalaryAllocationsQueryKey,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Pencil, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export default function Salary() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: salary, isLoading } = useGetSalary();
  const { data: allocations } = useListSalaryAllocations();
  const { data: loans } = useListLoans();
  const { data: categories } = useListCategories();
  const { data: accounts } = useListAccounts();

  const upsertSalary = useUpsertSalary();
  const createAllocation = useCreateSalaryAllocation();
  const updateAllocation = useUpdateSalaryAllocation();
  const deleteAllocation = useDeleteSalaryAllocation();
  const processSalary = useProcessSalary();

  const [salaryForm, setSalaryForm] = useState({ amount: 0, depositDay: 25, accountId: "" });
  const [newAlloc, setNewAlloc] = useState({ categoryId: "", amount: "" });
  const [editAllocId, setEditAllocId] = useState<number | null>(null);
  const [editAllocAmount, setEditAllocAmount] = useState("");

  useEffect(() => {
    if (salary) {
      setSalaryForm({
        amount: salary.amount,
        depositDay: salary.depositDay,
        accountId: salary.accountId ? String(salary.accountId) : "",
      });
    }
  }, [salary]);

  const invalidateSalary = () => {
    queryClient.invalidateQueries({ queryKey: getGetSalaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListSalaryAllocationsQueryKey() });
  };

  const handleSalarySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertSalary.mutate(
      {
        data: {
          amount: salaryForm.amount,
          depositDay: salaryForm.depositDay,
          accountId: salaryForm.accountId ? parseInt(salaryForm.accountId) : null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSalaryQueryKey() });
          toast({ title: "تم حفظ إعدادات الراتب بنجاح" });
        },
        onError: () => toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" }),
      }
    );
  };

  const handleAddAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlloc.categoryId || !newAlloc.amount) return;
    createAllocation.mutate(
      { data: { categoryId: parseInt(newAlloc.categoryId), amount: parseFloat(newAlloc.amount) } },
      {
        onSuccess: () => {
          invalidateSalary();
          setNewAlloc({ categoryId: "", amount: "" });
          toast({ title: "تمت إضافة التوزيع" });
        },
      }
    );
  };

  const handleUpdateAllocation = (id: number) => {
    if (!editAllocAmount) return;
    updateAllocation.mutate(
      { id, data: { amount: parseFloat(editAllocAmount) } },
      {
        onSuccess: () => {
          invalidateSalary();
          setEditAllocId(null);
          toast({ title: "تم تحديث المبلغ" });
        },
      }
    );
  };

  const handleDeleteAllocation = (id: number) => {
    deleteAllocation.mutate(
      { id },
      { onSuccess: () => { invalidateSalary(); toast({ title: "تم حذف التوزيع" }); } }
    );
  };

  const handleProcess = () => {
    processSalary.mutate(undefined, {
      onSuccess: (data) => {
        if (data.processed) {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: data.message });
        } else {
          toast({ title: data.message, variant: data.alreadyProcessed ? "default" : "destructive" });
        }
      },
    });
  };

  const activeLoans = loans?.filter((l) => l.isActive) ?? [];
  const totalAllocations = allocations?.reduce((s, a) => s + a.amount, 0) ?? 0;
  const totalLoanDeductions = activeLoans.reduce((s, l) => s + l.monthlyInstallment, 0);
  const remaining = (salary?.amount ?? 0) - totalAllocations - totalLoanDeductions;

  const allocatedCategoryIds = new Set(allocations?.map((a) => a.categoryId) ?? []);
  const availableCategories = categories?.filter((c) => !allocatedCategoryIds.has(c.id)) ?? [];

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold">إعدادات الراتب</h2>

      {/* Salary Config */}
      <Card>
        <CardHeader>
          <CardTitle>الراتب الشهري</CardTitle>
          <CardDescription>حدد المبلغ ويوم الإيداع والحساب الذي يُودع فيه</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSalarySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>مبلغ الراتب</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={salaryForm.amount || ""}
                  onChange={(e) => setSalaryForm({ ...salaryForm, amount: parseFloat(e.target.value) || 0 })}
                  dir="ltr"
                  className="pr-12 text-right text-lg font-bold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">ر.س</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>يوم الإيداع (1-31)</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={salaryForm.depositDay || ""}
                  onChange={(e) => setSalaryForm({ ...salaryForm, depositDay: parseInt(e.target.value) || 1 })}
                  dir="ltr"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label>حساب الإيداع</Label>
                <Select
                  value={salaryForm.accountId || "none"}
                  onValueChange={(v) => setSalaryForm({ ...salaryForm, accountId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحساب" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون حساب</SelectItem>
                    {accounts?.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={upsertSalary.isPending}>
              حفظ إعدادات الراتب
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Salary Allocations */}
      <Card>
        <CardHeader>
          <CardTitle>توزيع الراتب على التصنيفات</CardTitle>
          <CardDescription>حدد كم يذهب من الراتب لكل تصنيف شهرياً</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing allocations */}
          {allocations && allocations.length > 0 && (
            <div className="space-y-2">
              {allocations.map((alloc) => (
                <div key={alloc.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <span className="text-xl">{alloc.categoryEmoji}</span>
                  <span className="flex-1 font-medium">{alloc.categoryName}</span>
                  {editAllocId === alloc.id ? (
                    <div className="flex items-center gap-2">
                      <div className="relative w-28">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editAllocAmount}
                          onChange={(e) => setEditAllocAmount(e.target.value)}
                          dir="ltr"
                          className="text-right pr-10 h-8 text-sm"
                          autoFocus
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ر.س</span>
                      </div>
                      <Button size="sm" className="h-8" onClick={() => handleUpdateAllocation(alloc.id)}>
                        ✓
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditAllocId(null)}>
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-600">{formatCurrency(alloc.amount)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => { setEditAllocId(alloc.id); setEditAllocAmount(String(alloc.amount)); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDeleteAllocation(alloc.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new allocation */}
          {availableCategories.length > 0 && (
            <form onSubmit={handleAddAllocation} className="flex gap-2">
              <Select value={newAlloc.categoryId} onValueChange={(v) => setNewAlloc({ ...newAlloc, categoryId: v })}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="اختر التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.emoji} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-32">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="المبلغ"
                  value={newAlloc.amount}
                  onChange={(e) => setNewAlloc({ ...newAlloc, amount: e.target.value })}
                  dir="ltr"
                  className="text-right pr-10"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ر.س</span>
              </div>
              <Button type="submit" size="icon" disabled={createAllocation.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          )}

          {allocations?.length === 0 && availableCategories.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-2">لا توجد تصنيفات. أضف تصنيفات أولاً.</p>
          )}
        </CardContent>
      </Card>

      {/* Active Loans deductions */}
      {activeLoans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>الأقساط الشهرية (الديون)</CardTitle>
            <CardDescription>تُخصم تلقائياً من الراتب</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeLoans.map((loan) => (
              <div key={loan.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <div>
                  <p className="font-medium">{loan.name}</p>
                  <p className="text-xs text-muted-foreground">متبقي {loan.remainingMonths} شهر</p>
                </div>
                <span className="font-bold text-orange-600">{formatCurrency(loan.monthlyInstallment)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      {salary && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">إجمالي الراتب</span>
              <span className="font-bold text-lg">{formatCurrency(salary.amount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">المخصص للتصنيفات</span>
              <span className="font-medium text-emerald-600">- {formatCurrency(totalAllocations)}</span>
            </div>
            {totalLoanDeductions > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">الأقساط الشهرية</span>
                <span className="font-medium text-orange-600">- {formatCurrency(totalLoanDeductions)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between items-center">
              <span className="font-semibold">المتبقي غير الموزع</span>
              <span
                className={`font-bold text-xl ${remaining >= 0 ? "text-emerald-600" : "text-destructive"}`}
              >
                {formatCurrency(remaining)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Process Salary */}
      {salary && (
        <Card>
          <CardHeader>
            <CardTitle>معالجة الراتب الشهري</CardTitle>
            <CardDescription>
              عند الضغط سيتم إيداع الراتب في الحساب المحدد وتحديث ميزانية التصنيفات
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              variant="default"
              onClick={handleProcess}
              disabled={processSalary.isPending}
            >
              <RefreshCw className={`ml-2 h-4 w-4 ${processSalary.isPending ? "animate-spin" : ""}`} />
              معالجة راتب الشهر الحالي
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
