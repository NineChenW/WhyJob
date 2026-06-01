import { notFound } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { CompanyView } from "@/components/companies/company-view";
import { mockCompanies, mockCompanyContents, mockUser } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft } from "lucide-react";

interface CompanyPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { id } = await params;
  const company = mockCompanies.find((c) => c.id === id);

  if (!company) {
    notFound();
  }

  // Get company contents for this specific company
  const companyContents = mockCompanyContents.filter(
    (c) => c.sourceId === company.id
  );

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4 flex-1">
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
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Companies
          </Link>
          <CompanyView company={company} contents={companyContents} />
        </main>
      </div>
    </div>
  );
}