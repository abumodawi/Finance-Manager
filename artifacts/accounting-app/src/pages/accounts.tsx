import { useState, useRef } from "react";
import {
  useListAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useListCategories,
  useUpdateCategory,
  getListAccountsQueryKey,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Upload, ImageIcon, Tags, ArrowLeftRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AccountForm = {
  name: string;
  bankName: string;
  accountNumber: string;
  imageUrl: string | null;
  initialBalance: number;
};

const EMPTY_FORM: AccountForm = {
  name: "",
  bankName: "",
  accountNumber: "",
  imageUrl: null,
  initialBalance: 0,
};

function ImageUpload({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-20 h-20 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden bg-muted hover:bg-muted/70 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {value ? (
          <img src={value} alt="صورة الحساب" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
        <Upload className="h-3 w-3 ml-1" />
        {value ? "تغيير الصورة" : "اختر صورة"}
      </Button>
      {value && (
        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onChange(null)}>
          حذف الصورة
        </Button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

function AccountAvatar({ account }: { account: { imageUrl?: string | null; emoji?: string | null; name: string } }) {
  if (account.imageUrl) {
    return (
      <div className="w-14 h-14 rounded-full overflow-hidden bg-muted shrink-0">
        <img src={account.imageUrl} alt={account.name} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="text-4xl bg-muted p-3 rounded-full shrink-0">
      {account.emoji ?? "🏦"}
    </div>
  );
}

export default function Accounts() {
  const { data: accounts, isLoading } = useListAccounts();
  const { data: categories } = useListCategories();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const updateCategory = useUpdateCategory();

  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AccountForm>(EMPTY_FORM);
  const [viewAccountId, setViewAccountId] = useState<number | null>(null);

  const viewAccount = accounts?.find((a) => a.id === viewAccountId) ?? null;
  const accountCategories = categories?.filter((c) => c.accountId === viewAccountId) ?? [];

  const handleTransferCategory = (categoryId: number, newAccountId: string) => {
    updateCategory.mutate(
      { id: categoryId, data: { accountId: newAccountId === "none" ? null : parseInt(newAccountId) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: "تم نقل التصنيف بنجاح" });
        },
        onError: () => toast({ title: "حدث خطأ أثناء النقل", variant: "destructive" }),
      }
    );
  };

  const openCreate = () => {
    setEditId(null);
    setFormData(EMPTY_FORM);
    setIsOpen(true);
  };

  const openEdit = (account: NonNullable<typeof accounts>[number]) => {
    setEditId(account.id);
    setFormData({
      name: account.name,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      imageUrl: account.imageUrl ?? null,
      initialBalance: 0,
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const invalidate = () => queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });

    if (editId !== null) {
      updateAccount.mutate(
        { id: editId, data: { name: formData.name, bankName: formData.bankName, accountNumber: formData.accountNumber, imageUrl: formData.imageUrl } },
        {
          onSuccess: () => {
            invalidate();
            setIsOpen(false);
            toast({ title: "تم تحديث الحساب بنجاح" });
          },
        }
      );
    } else {
      createAccount.mutate(
        { data: { name: formData.name, bankName: formData.bankName, accountNumber: formData.accountNumber, imageUrl: formData.imageUrl, initialBalance: formData.initialBalance } },
        {
          onSuccess: () => {
            invalidate();
            setIsOpen(false);
            setFormData(EMPTY_FORM);
            toast({ title: "تم إضافة الحساب بنجاح" });
          },
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا الحساب؟")) {
      deleteAccount.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
            toast({ title: "تم حذف الحساب بنجاح" });
          },
        }
      );
    }
  };

  const isPending = createAccount.isPending || updateAccount.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">الحسابات البنكية</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="ml-2 h-4 w-4" /> إضافة حساب
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editId !== null ? "تعديل الحساب" : "إضافة حساب جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex justify-center">
                <ImageUpload
                  value={formData.imageUrl}
                  onChange={(imageUrl) => setFormData({ ...formData, imageUrl })}
                />
              </div>
              <div className="space-y-2">
                <Label>اسم الحساب</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: الحساب الجاري"
                />
              </div>
              <div className="space-y-2">
                <Label>اسم البنك</Label>
                <Input
                  required
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  placeholder="مثال: مصرف الراجحي"
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الحساب</Label>
                <Input
                  required
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  dir="ltr"
                  className="text-right"
                />
              </div>
              {editId === null && (
                <div className="space-y-2">
                  <Label>الرصيد الافتتاحي</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.initialBalance}
                    onChange={(e) => setFormData({ ...formData, initialBalance: parseFloat(e.target.value) || 0 })}
                    dir="ltr"
                    className="text-right"
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isPending}>
                {editId !== null ? "حفظ التعديلات" : "حفظ الحساب"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts?.map((account) => (
            <Card key={account.id} className="relative group">
              <CardContent className="p-6">
                <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(account)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-7 w-7"
                    onClick={() => handleDelete(account.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div
                  className="cursor-pointer"
                  onClick={() => setViewAccountId(account.id)}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <AccountAvatar account={account} />
                    <div>
                      <h3 className="font-bold text-lg">{account.name}</h3>
                      <p className="text-sm text-muted-foreground">{account.bankName}</p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2" dir="ltr">
                    {account.accountNumber}
                  </div>
                  <div className="text-2xl font-bold">{formatCurrency(account.balance)}</div>
                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Tags className="h-3.5 w-3.5" />
                      {(categories?.filter((c) => c.accountId === account.id).length ?? 0)} تصنيف
                    </span>
                    <span className="text-primary text-xs">عرض التصنيفات ←</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {accounts?.length === 0 && (
            <div className="col-span-full text-center p-12 border border-dashed rounded-lg text-muted-foreground">
              لا توجد حسابات مسجلة. قم بإضافة حسابك الأول للبدء.
            </div>
          )}
        </div>
      )}

      {/* Account categories dialog */}
      <Dialog open={viewAccountId !== null} onOpenChange={(o) => !o && setViewAccountId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewAccount && <AccountAvatarSmall account={viewAccount} />}
              تصنيفات: {viewAccount?.name}
            </DialogTitle>
            <DialogDescription>
              التصنيفات المرتبطة بهذا الحساب. يمكنك نقل أي تصنيف إلى حساب آخر.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {accountCategories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                لا توجد تصنيفات مرتبطة بهذا الحساب
              </div>
            ) : (
              accountCategories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <span className="text-2xl shrink-0">{cat.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{cat.name}</p>
                    {cat.budget !== null && cat.budget !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        الميزانية: {formatCurrency(cat.budget)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select
                      value={cat.accountId != null ? String(cat.accountId) : "none"}
                      onValueChange={(v) => handleTransferCategory(cat.id, v)}
                    >
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue />
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
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountAvatarSmall({ account }: { account: { imageUrl?: string | null; emoji?: string | null; name: string } }) {
  if (account.imageUrl) {
    return (
      <div className="w-7 h-7 rounded-full overflow-hidden bg-muted shrink-0 inline-block">
        <img src={account.imageUrl} alt={account.name} className="w-full h-full object-cover" />
      </div>
    );
  }
  return <span className="text-xl">{account.emoji ?? "🏦"}</span>;
}
