import { Link } from "wouter";
import {
  useGetAccountBreakdown,
  useListAccounts,
  useMoveSubcategoryFunds,
  getListAccountsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetAccountBreakdownQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, ArrowLeftRight, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AccountDetail({ params }: { params: { id: string } }) {
  const accountId = parseInt(params.id);
  const { data, isLoading, isError } = useGetAccountBreakdown(
    { accountId },
    {
      query: {
        queryKey: getGetAccountBreakdownQueryKey({ accountId }),
        enabled: !isNaN(accountId),
      },
    }
  );
  const { data: accounts } = useListAccounts();
  const moveFunds = useMoveSubcategoryFunds();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleMoveSubcategory = (
    subcategoryId: number,
    target: number,
    amount: number | undefined,
    onDone?: () => void,
  ) => {
    if (isNaN(target) || target === accountId) return;
    moveFunds.mutate(
      { data: { subcategoryId, fromAccountId: accountId, toAccountId: target, ...(amount != null ? { amount } : {}) } },
      {
        onSuccess: (result) => {
          if (result.moved === 0) {
            toast({ title: "لا توجد مبالغ في هذا التصنيف لنقلها" });
            return;
          }
          queryClient.invalidateQueries({ queryKey: getGetAccountBreakdownQueryKey({ accountId }) });
          queryClient.invalidateQueries({ queryKey: getGetAccountBreakdownQueryKey({ accountId: target }) });
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "تم نقل المبلغ إلى الحساب الآخر" });
          onDone?.();
        },
        onError: () => toast({ title: "حدث خطأ أثناء النقل", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Link href="/accounts">
          <Button variant="ghost"><ArrowRight className="ml-2 h-4 w-4" /> رجوع للحسابات</Button>
        </Link>
        <div className="text-center p-12 border border-dashed rounded-lg text-muted-foreground">
          تعذر تحميل بيانات الحساب
        </div>
      </div>
    );
  }

  const { account, categories, totalReceived, totalSpent } = data;

  return (
    <div className="space-y-6">
      <Link href="/accounts">
        <Button variant="ghost" className="px-2"><ArrowRight className="ml-2 h-4 w-4" /> رجوع للحسابات</Button>
      </Link>

      {/* Account header */}
      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <div className="text-4xl bg-muted p-3 rounded-full shrink-0">{account.emoji ?? "🏦"}</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold truncate">{account.name}</h2>
            <p className="text-sm text-muted-foreground">{account.bankName}</p>
          </div>
          <div className="text-left">
            <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
            <p className="text-2xl font-bold">{formatCurrency(account.balance)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-600/10 text-green-600"><TrendingUp className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الوارد</p>
              <p className="font-bold text-green-600">{formatCurrency(totalReceived)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10 text-destructive"><TrendingDown className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي المصروف</p>
              <p className="font-bold text-destructive">{formatCurrency(totalSpent)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <h3 className="text-lg font-bold">التصنيفات والمبالغ</h3>

      {categories.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-lg text-muted-foreground">
          لا توجد تصنيفات مرتبطة بهذا الحساب
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <Card key={cat.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 min-w-0 mb-3">
                  <span className="text-2xl shrink-0">{cat.emoji}</span>
                  <p className="font-bold truncate">{cat.name}</p>
                </div>

                {cat.subcategories.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1">لا توجد تصنيفات فرعية</p>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {cat.subcategories.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2 p-3">
                        <span className="text-lg shrink-0">{sub.emoji}</span>
                        <span className="font-medium truncate flex-1 min-w-0">{sub.name}</span>
                        <span className="hidden sm:inline text-xs text-green-600 shrink-0" title="الوارد">+{formatCurrency(sub.received)}</span>
                        <span className="hidden sm:inline text-xs text-destructive shrink-0" title="المصروف">-{formatCurrency(sub.spent)}</span>
                        <span
                          className={`font-bold text-sm shrink-0 ${sub.net >= 0 ? "text-foreground" : "text-destructive"}`}
                          title="الصافي"
                        >
                          {formatCurrency(sub.net)}
                        </span>
                        <TransferPopover
                          sub={sub}
                          accounts={(accounts ?? []).filter((a) => a.id !== accountId)}
                          isPending={moveFunds.isPending}
                          onTransfer={(target, amount, onDone) => handleMoveSubcategory(sub.id, target, amount, onDone)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface TransferPopoverProps {
  sub: { id: number; name: string; net: number };
  accounts: { id: number; name: string }[];
  isPending: boolean;
  onTransfer: (target: number, amount: number | undefined, onDone: () => void) => void;
}

function TransferPopover({ sub, accounts, isPending, onTransfer }: TransferPopoverProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const max = Math.max(sub.net, 0);

  const reset = () => {
    setTarget("");
    setAmount("");
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) {
      setAmount(max > 0 ? String(max) : "");
    } else {
      reset();
    }
  };

  const parsedAmount = parseFloat(amount);
  const validAmount = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= max + 0.0001;
  const canSubmit = target !== "" && validAmount && max > 0;

  const submit = () => {
    if (!canSubmit) return;
    const full = parsedAmount >= max - 0.0001;
    onTransfer(parseInt(target), full ? undefined : parsedAmount, () => handleOpenChange(false));
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs shrink-0" title="نقل إلى حساب آخر">
          <ArrowLeftRight className="h-3.5 w-3.5" />
          نقل
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" sideOffset={6} collisionPadding={12} className="w-64 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-bold">نقل «{sub.name}»</p>
          <p className="text-xs text-muted-foreground">المتاح: {formatCurrency(max)}</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">إلى حساب</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="اختر الحساب" />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" avoidCollisions={false}>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={String(acc.id)}>{acc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">المبلغ</Label>
          <div className="flex gap-1.5">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={max}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 text-xs"
              onClick={() => setAmount(String(max))}
            >
              الكل
            </Button>
          </div>
          {amount !== "" && !validAmount && (
            <p className="text-xs text-destructive">أدخل مبلغاً بين 0 و {formatCurrency(max)}</p>
          )}
        </div>

        <Button className="w-full h-9" disabled={!canSubmit || isPending} onClick={submit}>
          {isPending ? "جارٍ النقل..." : "تأكيد النقل"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
