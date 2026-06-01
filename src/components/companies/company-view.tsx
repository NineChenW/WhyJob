"use client";

import { useState } from "react";
import type { Company, Content } from "@/lib/db.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Globe,
  MapPin,
  Pencil,
  Trash2,
  Users,
  Briefcase,
  GraduationCap,
  Calendar,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

interface CompanyViewProps {
  company: Company;
  contents: Content[];
}

type TabId = "basic" | "website" | "culture" | "jobs";

interface Tab {
  id: TabId;
  label: string;
}

const tabs: Tab[] = [
  { id: "basic", label: "Basic Information" },
  { id: "website", label: "Official Website" },
  { id: "culture", label: "Company Culture" },
  { id: "jobs", label: "Recent Job Posting" },
];

// Helper to get content by type
function getContentByType(
  contents: Content[],
  contentType: string
): Content | undefined {
  return contents.find((c) => c.contentType === contentType);
}

export function CompanyView({ company, contents }: CompanyViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("basic");

  // Get culture and news content
  const cultureContent = getContentByType(contents, "company_culture");
  const newsContent = getContentByType(contents, "company_news");
  const hiringContent = getContentByType(contents, "company_hiring_trends");

  return (
    <div className="max-w-5xl">
      {/* Company Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          {/* Company Icon */}
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 shrink-0">
            <Building2 className="h-7 w-7 text-primary" />
          </div>

          {/* Company Info */}
          <div>
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {company.industry}
              {company.headquarters && ` · ${company.headquarters}`}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {company.stage && (
                <Badge variant="secondary">{company.stage}</Badge>
              )}
              {company.size && (
                <Badge variant="outline">{company.size} employees</Badge>
              )}
              {company.industry && (
                <Badge variant="outline">{company.industry}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Edit and Delete Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tracking Columns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <TrackingCard
          icon={<Building2 className="h-5 w-5" />}
          label="Company Stage"
          value={company.stage || "—"}
        />
        <TrackingCard
          icon={<Users className="h-5 w-5" />}
          label="Company Size"
          value={company.size || "—"}
        />
        <TrackingCard
          icon={<MapPin className="h-5 w-5" />}
          label="Headquarters"
          value={company.headquarters || "—"}
        />
        <TrackingCard
          icon={<Calendar className="h-5 w-5" />}
          label="Added On"
          value={company.createdAt.toLocaleDateString()}
        />
      </div>

      {/* Tabbed Information Area */}
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-border bg-muted/30">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-foreground bg-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 bg-background min-h-[300px]">
          {activeTab === "basic" && (
            <div className="space-y-6">
              <BasicInfoSection company={company} />
            </div>
          )}

          {activeTab === "website" && (
            <div className="space-y-6">
              <WebsiteSection company={company} />
            </div>
          )}

          {activeTab === "culture" && (
            <div className="space-y-6">
              <CultureSection
                culture={cultureContent?.content}
                news={newsContent?.content}
              />
            </div>
          )}

          {activeTab === "jobs" && (
            <div className="space-y-6">
              <JobPostingSection hiringTrends={hiringContent?.content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Tracking Card Component
function TrackingCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

// Basic Information Section
function BasicInfoSection({ company }: { company: Company }) {
  const infoItems = [
    { label: "Company Name", value: company.name },
    { label: "Industry", value: company.industry || "—" },
    { label: "Stage", value: company.stage || "—" },
    { label: "Size", value: company.size || "—" },
    { label: "Headquarters", value: company.headquarters || "—" },
    { label: "Website", value: company.website || "—" },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {infoItems.map((item) => (
          <div key={item.label} className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium text-right">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Website Section
function WebsiteSection({ company }: { company: Company }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Official Website</h3>
      {company.website ? (
        <div className="space-y-4">
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
          >
            <Globe className="h-8 w-8 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">{company.website}</p>
              <p className="text-sm text-muted-foreground">Visit official website</p>
            </div>
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
          </a>
        </div>
      ) : (
        <p className="text-muted-foreground">No website information available.</p>
      )}
    </div>
  );
}

// Culture Section
function CultureSection({
  culture,
  news,
}: {
  culture?: string;
  news?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Company Culture</h3>
        <p className="text-muted-foreground leading-relaxed">
          {culture || "No culture information available."}
        </p>
      </div>

      {news && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Recent News</h3>
          <p className="text-muted-foreground leading-relaxed">{news}</p>
        </div>
      )}
    </div>
  );
}

// Job Posting Section
function JobPostingSection({ hiringTrends }: { hiringTrends?: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Recent Job Posting</h3>
      {hiringTrends ? (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
          <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
          <p className="text-muted-foreground leading-relaxed">{hiringTrends}</p>
        </div>
      ) : (
        <p className="text-muted-foreground">No job posting information available.</p>
      )}
    </div>
  );
}