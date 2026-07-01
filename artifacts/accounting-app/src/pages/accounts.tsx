import { useState } from "react";
import { useListAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount, getListAccountsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { EmojiPicker } from "@/components/emoji-picker";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Accounts() {
  const { data: accounts, isLoading } = useListAccounts();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", bankName: "", accountNumber: "", emoji: "🏦", initialBalance: 0 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAccount.mutate({ data: formData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        setIsOpen(false);
        setFormData({ name: "", bankName: "", accountNumber: "", emoji: "🏦", initialBalance: 0 });
        toast({ title: "تم إضافة الحساب بنجاح" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا الحساب؟")) {
      deleteAccount.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          toast({ title: "تم حذف الحساب بنجاح" });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">الحسابات البنكية</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-2 h-4 w-4" /> إضافة حساب</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة حساب جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-4">
                <div className="space-y-2">
                  <Label>الرمز</Label>
                  <EmojiPicker value={formData.emoji} onChange={(emoji) => setFormData({...formData, emoji})} />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>اسم الحساب</Label>
                  <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="مثال: الحساب الجاري" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>اسم البنك</Label>
                <Input required value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} placeholder="مثال: مصرف الراجحي" />
              </div>
              <div className="space-y-2">
                <Label>رقم الحساب</Label>
                <Input required value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} dir="ltr" className="text-right" />
              </div>
              <div className="space-y-2">
                <Label>الرصيد الافتتاحي</Label>
                <Input type="number" step="0.01" value={formData.initialBalance} onChange={e => setFormData({...formData, initialBalance: parseFloat(e.target.value)})} dir="ltr" className="text-right" />
              </div>
              <Button type="submit" className="w-full" disabled={createAccount.isPending}>حفظ الحساب</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts?.map(account => (
            <Card key={account.id} className="relative group">
              <CardContent className="p-6">
                <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDelete(account.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-4xl bg-muted p-3 rounded-full">{account.emoji}</div>
                  <div>
                    <h3 className="font-bold text-lg">{account.name}</h3>
                    <p className="text-sm text-muted-foreground">{account.bankName}</p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mb-2" dir="ltr">{account.accountNumber}</div>
                <div className="text-2xl font-bold">{formatCurrency(account.balance)}</div>
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
