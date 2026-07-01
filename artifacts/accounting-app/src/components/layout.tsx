import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  WalletCards,
  Tags,
  Banknote,
  ArrowRightLeft,
  FileText,
  CreditCard,
  Monitor,
  Smartphone,
  Maximize,
  Minimize,
} from "lucide-react";

const navigation = [
  { name: "لوحة القيادة", href: "/", icon: LayoutDashboard },
  { name: "الحسابات", href: "/accounts", icon: WalletCards },
  { name: "العمليات", href: "/transactions", icon: ArrowRightLeft },
  { name: "كشف الحساب", href: "/statement", icon: FileText },
  { name: "الراتب", href: "/salary", icon: Banknote },
  { name: "الديون", href: "/loans", icon: CreditCard },
  { name: "التصنيفات", href: "/categories", icon: Tags },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const Toolbar = () => (
    <div className="flex items-center gap-1">
      <div className="flex items-center rounded-md border border-border p-0.5">
        <Button
          variant={viewMode === "desktop" ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => setViewMode("desktop")}
          title="عرض الكمبيوتر"
        >
          <Monitor className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === "mobile" ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => setViewMode("mobile")}
          title="عرض الجوال"
        >
          <Smartphone className="h-4 w-4" />
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={toggleFullscreen}
        title={isFullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
      >
        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
      </Button>
    </div>
  );

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
        {/* Top toolbar (both desktop and mobile) */}
        <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-card shrink-0">
          <h1 className="text-xl font-bold text-primary md:hidden">المحاسب الشخصي</h1>
          <span className="hidden md:block text-sm text-muted-foreground">
            {viewMode === "mobile" ? "معاينة الجوال" : "معاينة الكمبيوتر"}
          </span>
          <Toolbar />
        </div>

        <div className="flex-1 overflow-auto bg-muted/30">
          <div
            className={cn(
              "transition-all duration-300",
              viewMode === "mobile"
                ? "mx-auto my-4 max-w-[420px] min-h-[calc(100%-2rem)] border border-border rounded-2xl shadow-lg bg-background overflow-hidden"
                : "w-full min-h-full bg-background"
            )}
          >
            <div className="p-4 md:p-8">
              <div className="mx-auto max-w-5xl">{children}</div>
            </div>
          </div>
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
