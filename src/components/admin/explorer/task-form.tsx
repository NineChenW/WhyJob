/**
 * Task Form - Submit New Exploration Task
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTaskAction } from '@/actions/explorer';
import { getCompanies } from '@/actions/companies';
import type { ContentType } from '@/schemas/explorer';

const CONTENT_TYPES: { id: ContentType; label: string; description: string }[] = [
  { id: 'job_listing', label: 'Job Listings', description: 'Careers page, job board' },
  { id: 'company_culture', label: 'Company Culture', description: 'About page, values' },
  { id: 'company_wechat', label: 'WeChat', description: 'WeChat official account info' },
];

interface TaskFormProps {
  companies: Array<{ id: string; name: string }>;
}

export function TaskForm({ companies }: TaskFormProps) {
  const router = useRouter();
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedTypes, setSelectedTypes] = useState<ContentType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleType = (type: ContentType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) {
      toast.error('Please select a company');
      return;
    }
    if (selectedTypes.length === 0) {
      toast.error('Please select at least one content type');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createTaskAction({
        companyId: selectedCompany,
        contentTypes: selectedTypes,
      });

      if (result.success) {
        toast.success('Exploration task created');
        setSelectedCompany('');
        setSelectedTypes([]);
        router.refresh();
      } else {
        toast.error(result.error ?? 'Failed to create task');
      }
    } catch {
      toast.error('Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompanyChange = (value: string | null) => {
    if (value !== null) {
      setSelectedCompany(value);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Explore Company Data</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Company Select */}
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Select value={selectedCompany} onValueChange={handleCompanyChange}>
              <SelectTrigger id="company">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content Types */}
          <div className="space-y-2">
            <Label>Content Types (select one or more)</Label>
            <div className="space-y-2">
              {CONTENT_TYPES.map((ct) => (
                <div key={ct.id} className="flex items-start space-x-2">
                  <Checkbox
                    id={ct.id}
                    checked={selectedTypes.includes(ct.id)}
                    onCheckedChange={() => toggleType(ct.id)}
                  />
                  <div className="grid gap-0.5">
                    <Label htmlFor={ct.id} className="text-sm font-medium cursor-pointer">
                      {ct.label}
                    </Label>
                    <span className="text-xs text-muted-foreground">{ct.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Start Exploration'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}