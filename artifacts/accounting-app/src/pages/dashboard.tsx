import { useGetDashboardSummary, useGetSpendingByCategory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: spending, isLoading: isLoadingSpending } = useGetSpendingByCategory({ 
    query: { enabled: true } 
  });

  if (isLoadingSummary || isLoadingSpending) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">لوحة القيادة</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الرصيد</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(summary.totalBalance)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">مصروفات الشهر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{formatCurrency(summary.monthlyExpenses)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إيداعات الشهر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(summary.monthlyDeposits)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-xl font-bold">الحسابات البنكية</h3>
          <div className="grid gap-3">
            {summary.accountBalances.map(acc => (
              <Card key={acc.accountId}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{acc.emoji}</div>
                    <div>
                      <div className="font-semibold">{acc.name}</div>
                      <div className="text-xs text-muted-foreground">{acc.bankName}</div>
                    </div>
                  </div>
                  <div className="font-bold">{formatCurrency(acc.balance)}</div>
                </CardContent>
              </Card>
            ))}
            {summary.accountBalances.length === 0 && (
              <div className="text-center p-8 text-muted-foreground border rounded-lg">
                لا توجد حسابات مضافة
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-bold">مصروفات التصنيفات ({summary.currentMonth})</h3>
          <div className="grid gap-3">
            {spending?.map(cat => (
              <Card key={cat.categoryId}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{cat.emoji}</div>
                    <div className="font-semibold">{cat.categoryName}</div>
                  </div>
                  <div className="font-bold text-destructive">{formatCurrency(cat.total)}</div>
                </CardContent>
              </Card>
            ))}
            {(!spending || spending.length === 0) && (
              <div className="text-center p-8 text-muted-foreground border rounded-lg">
                لا توجد مصروفات لهذا الشهر
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
