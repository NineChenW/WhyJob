import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

describe("Database Seed Script", () => {
  beforeAll(async () => {
    // Ensure we're using a test database
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Tests must be run against a test database. Check your DATABASE_URL environment variable."
      );
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should run the seed script without errors", async () => {
    const { stdout, stderr } = await execAsync("npx prisma db seed");

    // Check that seed completed successfully
    expect(stderr).toBe("");
    expect(stdout).toContain("🌱 Starting database seed...");
    expect(stdout).toContain("🎉 Database seed completed successfully!");
    expect(stdout).toContain("✅ All validation checks passed!");
  }, 30000); // 30 second timeout for seed

  it("should insert the correct number of records", async () => {
    // Count all records
    const userCount = await prisma.user.count();
    const profileCount = await prisma.profile.count();
    const companyCount = await prisma.company.count();
    const jobCount = await prisma.jobDescription.count();
    const resumeCount = await prisma.resume.count();
    const resumeVersionCount = await prisma.resumeVersion.count();
    const interviewCount = await prisma.interview.count();
    const contentCount = await prisma.content.count();

    // Verify counts match expected values
    expect(userCount).toBe(1);
    expect(profileCount).toBe(1);
    expect(companyCount).toBe(5);
    expect(jobCount).toBe(4);
    expect(resumeCount).toBe(2);
    expect(resumeVersionCount).toBe(1);
    expect(interviewCount).toBe(2);
    expect(contentCount).toBe(26); // 7 profile + 6 company + 6 job + 7 interview
  });

  it("should maintain relational integrity", async () => {
    const user = await prisma.user.findFirst({
      include: {
        profile: true,
        companies: true,
        jobDescriptions: true,
        resumes: true,
        interviews: true,
      },
    });

    expect(user).toBeDefined();
    expect(user?.profile).toBeDefined();
    expect(user?.companies).toHaveLength(5);
    expect(user?.jobDescriptions).toHaveLength(4);
    expect(user?.resumes).toHaveLength(2);
    expect(user?.interviews).toHaveLength(2);

    // Check that content entries are properly linked
    const profileContent = await prisma.content.findMany({
      where: { sourceType: "profile", sourceId: user?.profile?.id },
    });
    expect(profileContent).toHaveLength(7);

    const companyContent = await prisma.content.findMany({
      where: { sourceType: "company" },
    });
    expect(companyContent).toHaveLength(6);

    const jobContent = await prisma.content.findMany({
      where: { sourceType: "job" },
    });
    expect(jobContent).toHaveLength(6);

    const interviewContent = await prisma.content.findMany({
      where: { sourceType: "interview" },
    });
    expect(interviewContent).toHaveLength(7);
  });

  it("should have correct data for sample records", async () => {
    const stripeCompany = await prisma.company.findFirst({
      where: { name: "Stripe" },
    });
    expect(stripeCompany).toBeDefined();
    expect(stripeCompany?.industry).toBe("FinTech");
    expect(stripeCompany?.stage).toBe("Public");
    expect(stripeCompany?.website).toBe("https://stripe.com");

    const seniorEngineerJob = await prisma.jobDescription.findFirst({
      where: { title: { contains: "Senior Full-Stack Engineer" } },
    });
    expect(seniorEngineerJob).toBeDefined();
    expect(seniorEngineerJob?.companyId).toBe(stripeCompany?.id);
    expect(seniorEngineerJob?.content).toContain("Stripe Dashboard");
  });
});
