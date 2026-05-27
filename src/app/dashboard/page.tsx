import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { mockUser } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">WhyJob</h1>
          <div className="relative w-80">
            <Input
              placeholder="Search..."
              className="pl-10 bg-muted/50 border-0 focus-visible:ring-1"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button>New Company</Button>
          <ThemeSwitch />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{mockUser.name}</span>
            {mockUser.isPro && (
              <span className="text-xs bg-primary/20 text-primary-foreground px-2 py-0.5 rounded">
                PRO
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1">
        {/* Sidebar Placeholder */}
        <aside className="w-64 border-r border-border p-4">
          <h2 className="text-xl font-semibold text-muted-foreground">Sidebar</h2>
        </aside>

        {/* Main Area Placeholder */}
        <main className="flex-1 p-6">
          <h2 className="text-xl font-semibold text-muted-foreground">Main</h2>
        </main>
      </div>
    </div>
  );
}