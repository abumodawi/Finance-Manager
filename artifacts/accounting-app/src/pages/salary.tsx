import { useState, useEffect } from "react";
import { useGetSalary, useUpsertSalary, getGetSalaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Salary() {
  const { data: salary, isLoading } = useGetSalary();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const upsertSalary = useUpsertSalary();

  const [formData, setFormData] = useState({ amount: 0, depositDay: 1 });

  useEffect(() => {
    if (salary) {
      setFormData({ amount: salary.amount, depositDay: salary.depositDay });
    }
  }, [salary]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    upsertSalary.mutate(
      { data: { amount: formData.amount, depositDay: formData.depositDay } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSalaryQueryKey() });
          toast({ title: "تم حفظ إعدادات الراتب بنجاح" });
        },
        onError: () => {
          toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h2 className="text-3xl font-bold">إعدادات الراتب</h2>

      <Card>
        <CardHeader>
          <CardTitle>الراتب الشهري</CardTitle>
          <CardDescription>أدخل مبلغ الراتب ويوم نزوله لتسهيل متابعة ميزانيتك</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>مبلغ الراتب</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount || ""}
                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    dir="ltr"
                    className="pr-12 text-right text-lg font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">ر.س</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>يوم الإيداع (من الشهر الميلادي)</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={formData.depositDay || ""}
                  onChange={e => setFormData({ ...formData, depositDay: parseInt(e.target.value) || 1 })}
                  dir="ltr"
                  className="text-right"
                />
              </div>

              <Button type="submit" className="w-full" disabled={upsertSalary.isPending}>
                حفظ التغييرات
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
