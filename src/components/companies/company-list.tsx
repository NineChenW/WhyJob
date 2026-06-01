"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Company } from "@/lib/db.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Globe, MapPin, Search, X } from "lucide-react";

interface CompanyListProps {
  companies: Company[];
}

export function CompanyList({ companies }: CompanyListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

  const industries = useMemo(() => {
    const uniqueIndustries = new Set(
      companies
        .map((c) => c.industry)
        .filter((industry): industry is string => industry != null)
    );
    return Array.from(uniqueIndustries).sort();
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const matchesSearch =
        searchQuery === "" ||
        company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.industry?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.headquarters?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesIndustry =
        selectedIndustry === null || company.industry === selectedIndustry;

      return matchesSearch && matchesIndustry;
    });
  }, [companies, searchQuery, selectedIndustry]);

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Industry Filter Tags */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedIndustry === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedIndustry(null)}
          >
            All
          </Badge>
          {industries.map((industry) => (
            <Badge
              key={industry}
              variant={selectedIndustry === industry ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() =>
                setSelectedIndustry(
                  selectedIndustry === industry ? null : industry
                )
              }
            >
              {industry}
            </Badge>
          ))}
        </div>
      </div>

      {/* Company List */}
      <div className="space-y-2">
        {filteredCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">No companies found</p>
            <p className="text-sm text-muted-foreground">
              {searchQuery || selectedIndustry
                ? "Try adjusting your search or filter"
                : "Add your first company to get started"}
            </p>
          </div>
        ) : (
          filteredCompanies.map((company) => (
            <div
              key={company.id}
              className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/companies/${company.id}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <h3 className="font-medium truncate">{company.name}</h3>
                  {company.stage && (
                    <Badge variant="secondary" className="text-xs">
                      {company.stage}
                    </Badge>
                  )}
                </Link>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                  {company.industry && (
                    <span className="truncate">{company.industry}</span>
                  )}
                  {company.size && (
                    <span className="truncate">{company.size} employees</span>
                  )}
                  {company.headquarters && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3" />
                      {company.headquarters}
                    </span>
                  )}
                </div>
              </div>
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg p-2 hover:bg-muted transition-colors"
                  aria-label={`Visit ${company.name} website`}
                >
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </a>
              )}
            </div>
          ))
        )}
      </div>

      {/* Results Count */}
      {filteredCompanies.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredCompanies.length} of {companies.length} companies
        </p>
      )}
    </div>
  );
}