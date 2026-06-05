// Types mirroring the Prisma schema defined in project-overview.md
// These will be replaced by Prisma-generated types once the schema is implemented

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  password: string | null;
  isPro: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Profile {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Content {
  id: string;
  sourceType: string;
  sourceId: string;
  contentType: string;
  content: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  website: string | null;
  industry: string | null;
  size: string | null;
  stage: string | null;
  headquarters: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobDescription {
  id: string;
  userId: string;
  companyId: string | null;
  title: string;
  url: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Resume {
  id: string;
  userId: string;
  jobDescriptionId: string | null;
  name: string;
  isPrimary: boolean;
  fitScore: number | null;
  fitAnalysis: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResumeVersion {
  id: string;
  resumeId: string;
  content: string;
  changeNotes: string | null;
  fitScore: number | null;
  createdAt: Date;
}

export interface Interview {
  id: string;
  userId: string;
  jobDescriptionId: string | null;
  type: string;
  status: string;
  overallScore: number | null;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}