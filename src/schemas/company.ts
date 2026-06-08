import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  description: z.string().optional(),
  stage: z.string().optional(),
  trackInfo: z.array(z.enum(["company_culture", "company_news", "company_wechat", "company_hiring_trends"])).optional(),
  // New columns
  name_en: z.string().optional(),
  register_address: z.string().optional(),
  register_post_code: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  company_size: z.string().optional(),
  establishment_date: z.string().optional(), // yyyy-MM-dd format
  enterprise_type: z.string().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

// Batch import schemas
export const companyColumnSchema = z.enum([
  "name",
  "description",
  "website",
  "industry",
  "size",
  "stage",
  "headquarters",
  // New columns
  "name_en",
  "register_address",
  "register_post_code",
  "province",
  "city",
  "district",
  "company_size",
  "establishment_date",
  "enterprise_type",
]);

export type CompanyColumn = z.infer<typeof companyColumnSchema>;

export const columnMappingSchema = z.object({
  column: companyColumnSchema,
  excelColumn: z.string().min(1, "Excel column is required"),
});

export type ColumnMapping = z.infer<typeof columnMappingSchema>;

export const batchImportCompaniesSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.name.endsWith(".xlsx"), {
      message: "Only .xlsx files are supported",
    })
    .refine((file) => file.size <= 10 * 1024 * 1024, {
      message: "File size must be less than 10MB",
    }),
  columnMappings: z.array(columnMappingSchema)
    .refine((mappings) => mappings.some(m => m.column === "name"), {
      message: "Company Name is a required column",
    }),
  startRow: z.number().int().min(1, "Start row must be at least 1"),
  endRow: z.number().int().optional(),
});

export type BatchImportCompaniesInput = z.infer<typeof batchImportCompaniesSchema>;