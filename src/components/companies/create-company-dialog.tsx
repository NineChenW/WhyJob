"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { createCompany } from "@/actions/companies";
import { createCompanySchema, type CreateCompanyInput } from "@/schemas/company";

const STAGE_OPTIONS = [
  { value: "Startup", label: "Startup" },
  { value: "Seed", label: "Seed" },
  { value: "Series A", label: "Series A" },
  { value: "Series B", label: "Series B" },
  { value: "Series C", label: "Series C" },
  { value: "Series D+", label: "Series D+" },
  { value: "Public", label: "Public" },
];

const TRACK_OPTIONS = [
  {
    id: "company_culture",
    label: "Company Culture",
    description: "Track company values, work environment, and team culture",
  },
  {
    id: "company_news",
    label: "Recent News",
    description: "Track latest company updates, funding rounds, and announcements",
  },
  {
    id: "company_wechat",
    label: "WeChat Account",
    description: "Track official WeChat account updates and content",
  },
  {
    id: "company_hiring_trends",
    label: "Hiring Trends",
    description: "Track hiring status, open roles, and recruitment patterns",
  },
];

export function CreateCompanyDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      name: "",
      description: "",
      stage: "",
      trackInfo: [],
    },
  });

  async function onSubmit(data: CreateCompanyInput) {
    setIsSubmitting(true);
    try {
      const result = await createCompany(data);
      if (result.success) {
        setOpen(false);
        form.reset();
        // Refresh the page to show new company
        router.refresh();
        toast.success("Company created successfully!");
      } else {
        const errorMessage = result.error || "Failed to create company";
        form.setError("root", {
          type: "server",
          message: errorMessage,
        });
        toast.error(errorMessage);
      }
    } catch (error) {
      const errorMessage = "An unexpected error occurred";
      form.setError("root", {
        type: "server",
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        New Company
      </Button>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add New Company</DialogTitle>
          <DialogDescription>
            Enter the company details and select what information you want to track.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Stripe, Linear, Vercel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the company, what they do, or any notes you have"
                      className="resize-none min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This will be saved as the initial company culture notes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Stage</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company stage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STAGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Information to Track</FormLabel>
              <FormDescription>
                Select the types of information you want to track for this company.
              </FormDescription>
              <div className="space-y-3">
                {TRACK_OPTIONS.map((option) => (
                  <FormField
                    key={option.id}
                    control={form.control}
                    name="trackInfo"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={option.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(option.id as any)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...(field.value || []), option.id])
                                  : field.onChange(
                                      field.value?.filter((value: string) => value !== option.id)
                                    );
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="font-normal">
                              {option.label}
                            </FormLabel>
                            <FormDescription className="text-xs">
                              {option.description}
                            </FormDescription>
                          </div>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </div>

            {form.formState.errors.root && (
              <div className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Company"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}