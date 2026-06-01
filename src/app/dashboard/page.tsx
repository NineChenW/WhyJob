import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { Sidebar } from "@/components/layout/sidebar";
import { CompanyList } from "@/components/companies/company-list";
import { mockUser, mockCompanies } from "@/lib/mock-data";
import { Search } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile menu button is inside Sidebar */}
            <div className="relative w-80 max-w-full hidden md:block">
              <Input
                placeholder="Search..."
                className="pl-10 bg-muted/50 border-0 focus-visible:ring-1"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button>New Company</Button>
            <ThemeSwitch />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {mockUser.name}
              </span>
              {mockUser.isPro && (
                <span className="text-xs bg-primary/20 text-primary-foreground px-2 py-0.5 rounded hidden sm:inline">
                  PRO
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">Companies</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage and research your target companies
              </p>
            </div>
            <CompanyList companies={mockCompanies} />
          </div>
        </main>
      </div>
    </div>
  );
}