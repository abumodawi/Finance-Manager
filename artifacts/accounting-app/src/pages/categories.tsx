import { useState } from "react";
import {
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateSubcategory,
  useDeleteSubcategory,
  useListAccounts,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useQueryClient } from "@tanstack/react-query";
import { EmojiPicker } from "@/components/emoji-picker";
import { Plus, Trash2, Pencil, TrendingDown, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

function BalanceBadge({ budget, current }: { budget: number | null | undefined; current: number | null | undefined }) {
  if (budget === null || budget === undefined) return null;
  const bal = current ?? budget;
  const pct = budget > 0 ? Math.min(100, Math.max(0, ((budget - (budget - bal)) / budget) * 100)) : 0;
  const isLow = bal < budget * 0.2;
  const isOver = bal < 0;
  return (
    <div className="text-left space-y-1 min-w-[110px]">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>المتبقي</span>
        <span className={cn("font-bold", isOver ? "text-destructive" : isLow ? "text-orange-500" : "text-emerald-600")}>
          {formatCurrency(bal)}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", isOver ? "bg-destructive" : isLow ? "bg-orange-400" : "bg-emerald-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">من {formatCurrency(budget)}</div>
    </div>
  );
}

export default function Categories() {
  const { data: categories, isLoading } = useListCategories();
  const { data: accounts } = useListAccounts();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const createSubcategory = useCreateSubcategory();
  const deleteSubcategory = useDeleteSubcategory();

  const [isCatOpen, setIsCatOpen] = useState(false);
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [catData, setCatData] = useState({ name: "", emoji: "🏷️", budget: "", accountId: "" });

  const [isSubOpen, setIsSubOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [subData, setSubData] = useState({ name: "", emoji: "📌" });

  const openCreateCat = () => {
    setEditCatId(null);
    setCatData({ name: "", emoji: "🏷️", budget: "", accountId: "" });
    setIsCatOpen(true);
  };

  const openEditCat = (cat: NonNullable<typeof categories>[number], e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCatId(cat.id);
    setCatData({
      name: cat.name,
      emoji: cat.emoji,
      budget: cat.budget !== null && cat.budget !== undefined ? String(cat.budget) : "",
      accountId: cat.accountId !== null && cat.accountId !== undefined ? String(cat.accountId) : "",
    });
    setIsCatOpen(true);
  };

  const invalidateCats = () => queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });

  const handleCreateOrUpdateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: catData.name,
      emoji: catData.emoji,
      budget: catData.budget ? parseFloat(catData.budget) : null,
      accountId: catData.accountId ? parseInt(catData.accountId) : null,
    };

    if (editCatId !== null) {
      updateCategory.mutate(
        { id: editCatId, data: payload },
        {
          onSuccess: () => {
            invalidateCats();
            setIsCatOpen(false);
            toast({ title: "تم تحديث التصنيف" });
          },
        }
      );
    } else {
      createCategory.mutate(
        { data: payload },
        {
          onSuccess: () => {
            invalidateCats();
            setIsCatOpen(false);
            setCatData({ name: "", emoji: "🏷️", budget: "", accountId: "" });
            toast({ title: "تم إضافة التصنيف الرئيسي" });
          },
        }
      );
    }
  };

  const handleCreateSubcategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentId) return;
    createSubcategory.mutate(
      { data: { categoryId: selectedParentId, ...subData } },
      {
        onSuccess: () => {
          invalidateCats();
          setIsSubOpen(false);
          setSubData({ name: "", emoji: "📌" });
          toast({ title: "تم إضافة التصنيف الفرعي" });
        },
      }
    );
  };

  const handleDeleteCat = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("حذف هذا التصنيف سيحذف جميع التصنيفات الفرعية. متأكد؟")) {
      deleteCategory.mutate({ id }, { onSuccess: invalidateCats });
    }
  };

  const handleDeleteSub = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا التصنيف الفرعي؟")) {
      deleteSubcategory.mutate({ id }, { onSuccess: invalidateCats });
    }
  };

  const catDialogTitle = editCatId !== null ? "تعديل التصنيف" : "إضافة تصنيف رئيسي";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">تصنيفات المصروفات</h2>

        <Dialog open={isCatOpen} onOpenChange={setIsCatOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateCat}>
              <Plus className="ml-2 h-4 w-4" /> تصنيف رئيسي
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{catDialogTitle}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateOrUpdateCategory} className="space-y-4">
              <div className="flex gap-4">
                <div className="space-y-2">
                  <Label>الرمز</Label>
                  <EmojiPicker value={catData.emoji} onChange={(emoji) => setCatData({ ...catData, emoji })} />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>اسم التصنيف</Label>
                  <Input
                    required
                    value={catData.name}
                    onChange={(e) => setCatData({ ...catData, name: e.target.value })}
                    placeholder="مثال: المنزل"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>المبلغ الشهري المخصص (اختياري)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={catData.budget}
                    onChange={(e) => setCatData({ ...catData, budget: e.target.value })}
                    placeholder="مثال: 750"
                    dir="ltr"
                    className="text-right pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">ر.س</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>الحساب البنكي (اختياري)</Label>
                <Select
                  value={catData.accountId || "none"}
                  onValueChange={(v) => setCatData({ ...catData, accountId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحساب" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون حساب</SelectItem>
                    {accounts?.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name} — {acc.bankName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={createCategory.isPending || updateCategory.isPending}>
                حفظ
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isSubOpen} onOpenChange={setIsSubOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة تصنيف فرعي</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubcategory} className="space-y-4">
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label>الرمز</Label>
                <EmojiPicker value={subData.emoji} onChange={(emoji) => setSubData({ ...subData, emoji })} />
              </div>
              <div className="space-y-2 flex-1">
                <Label>الاسم</Label>
                <Input
                  required
                  value={subData.name}
                  onChange={(e) => setSubData({ ...subData, name: e.target.value })}
                  placeholder="مثال: الإيجار"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createSubcategory.isPending}>
              حفظ
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <Accordion type="multiple" className="w-full space-y-4">
          {categories?.map((cat) => (
            <AccordionItem key={cat.id} value={cat.id.toString()} className="border rounded-lg bg-card px-4">
              <div className="flex items-center gap-2">
                <AccordionTrigger className="flex-1 hover:no-underline py-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-2xl shrink-0">{cat.emoji}</span>
                    <div className="flex flex-col items-start min-w-0">
                      <span className="font-bold text-lg">{cat.name}</span>
                      {cat.accountName && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Wallet className="h-3 w-3" />
                          {cat.accountName}
                        </span>
                      )}
                    </div>
                    {cat.budget !== null && cat.budget !== undefined && (
                      <div className="mr-auto pr-4">
                        <BalanceBadge budget={cat.budget} current={cat.currentBalance} />
                      </div>
                    )}
                  </div>
                </AccordionTrigger>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => openEditCat(cat, e)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedParentId(cat.id);
                      setIsSubOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 ml-1" /> فرعي
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-8 w-8"
                    onClick={(e) => handleDeleteCat(cat.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <AccordionContent className="pt-0 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
                  {cat.subcategories?.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-md group"
                    >
                      <div className="flex items-center gap-2">
                        <span>{sub.emoji}</span>
                        <span className="font-medium text-sm">{sub.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                        onClick={() => handleDeleteSub(sub.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!cat.subcategories || cat.subcategories.length === 0) && (
                    <div className="col-span-full text-sm text-muted-foreground text-center py-2">
                      لا توجد تصنيفات فرعية
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
          {categories?.length === 0 && (
            <div className="text-center p-12 border border-dashed rounded-lg text-muted-foreground">
              قم بإضافة تصنيفات لمصروفاتك (مثال: طعام، مواصلات، فواتير)
            </div>
          )}
        </Accordion>
      )}
    </div>
  );
}
