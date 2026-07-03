import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  useListAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useListCategories,
  getListAccountsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Upload, ImageIcon, Tags } from "lucide-react";
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

async function fileToResizedDataUrl(file: File, maxDim = 512, quality = 0.85): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("تعذّر قراءة الملف"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("تعذّر تحميل الصورة"));
    image.src = dataUrl;
  });

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function ImageUpload({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const resized = await fileToResizedDataUrl(file);
      onChange(resized);
    } catch {
      toast({ title: "تعذّر معالجة الصورة. جرّب صورة أخرى.", variant: "destructive" });
    }
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
  const [, navigate] = useLocation();

  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AccountForm>(EMPTY_FORM);

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
          onError: () =>
            toast({ title: "تعذّر حفظ الحساب. تأكد من حجم الصورة وحاول مجددًا.", variant: "destructive" }),
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
          onError: () =>
            toast({ title: "تعذّر حفظ الحساب. تأكد من حجم الصورة وحاول مجددًا.", variant: "destructive" }),
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
                  onClick={() => navigate(`/accounts/${account.id}`)}
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
                    <span className="text-primary text-xs">عرض التفاصيل ←</span>
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
    </div>
  );
}
