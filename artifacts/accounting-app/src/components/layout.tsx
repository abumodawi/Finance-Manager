import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  WalletCards,
  Tags,
  Banknote,
  ArrowRightLeft,
  FileText,
  CreditCard,
} from "lucide-react";

const navigation = [
  { name: "لوحة القيادة", href: "/", icon: LayoutDashboard },
  { name: "الحسابات", href: "/accounts", icon: WalletCards },
  { name: "المعاملات", href: "/transactions", icon: ArrowRightLeft },
  { name: "كشف الحساب", href: "/statement", icon: FileText },
  { name: "الراتب", href: "/salary", icon: Banknote },
  { name: "الديون", href: "/loans", icon: CreditCard },
  { name: "التصنيفات", href: "/categories", icon: Tags },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen w-full bg-background" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 border-l border-border bg-card hidden md:block shrink-0">
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center px-6 border-b border-border">
            <h1 className="text-xl font-bold text-primary">المحاسب الشخصي</h1>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden h-16 border-b border-border flex items-center px-4 bg-card shrink-0">
          <h1 className="text-xl font-bold text-primary">المحاسب الشخصي</h1>
        </div>
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden border-t border-border bg-card p-2 flex justify-around shrink-0 pb-safe overflow-x-auto">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-md text-[10px] font-medium shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
