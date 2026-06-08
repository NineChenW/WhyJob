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
      name_en: "",
      register_address: "",
      register_post_code: "",
      province: "",
      city: "",
      district: "",
      company_size: "",
      establishment_date: "",
      enterprise_type: "",
    },
  });

  async function onSubmit(data: CreateCompanyInput) {
    setIsSubmitting(true);
    try {
      const result = await createCompany(data);
      if (result.success) {
        setOpen(false);
        form.reset();
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
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Company</DialogTitle>
          <DialogDescription>
            Enter the company details and select what information you want to track.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable form area */}
        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-4">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Basic Information</h3>

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
                          className="resize-none min-h-[60px]"
                          {...field}
                        />
                      </FormControl>
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
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
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
              </div>

              {/* Company Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Company Details</h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name_en"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>English Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Company name in English" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="enterprise_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Enterprise Type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., LLC, Corporation" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Province / City / District */}
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Province</FormLabel>
                        <FormControl>
                          <Input placeholder="Province" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="district"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>District</FormLabel>
                        <FormControl>
                          <Input placeholder="District" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Register Address and Post Code */}
                <FormField
                  control={form.control}
                  name="register_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Register Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Registered company address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="register_post_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Register Post Code</FormLabel>
                        <FormControl>
                          <Input placeholder="Postal code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="company_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Size</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 100-500 employees" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Establishment Date */}
                <FormField
                  control={form.control}
                  name="establishment_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Establishment Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormDescription>Format: yyyy-MM-dd (e.g., 1995-01-06)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Information to Track */}
              <div className="space-y-4">
                <div>
                  <FormLabel>Information to Track</FormLabel>
                  <FormDescription>
                    Select the types of information you want to track for this company.
                  </FormDescription>
                </div>
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
            </form>
          </Form>
        </div>

        {/* Fixed footer */}
        <DialogFooter className="flex-shrink-0 pt-4 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            onClick={form.handleSubmit(onSubmit)}
          >
            {isSubmitting ? "Creating..." : "Create Company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}