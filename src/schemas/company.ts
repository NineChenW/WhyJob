import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  description: z.string().optional(),
  stage: z.string().optional(),
  trackInfo: z.array(z.enum(["company_culture", "company_news", "company_wechat", "company_hiring_trends"])).optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;