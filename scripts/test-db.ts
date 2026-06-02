#!/usr/bin/env tsx

/**
 * Database connection test script
 *
 * This script tests the connection to the Neon PostgreSQL database
 * using Prisma Client.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...\n');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('Please make sure your .env file contains DATABASE_URL');
    process.exit(1);
  }

  const maskedUrl = process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@');
  console.log(`📊 Using DATABASE_URL: ${maskedUrl}`);

  // Configure Neon WebSocket for serverless
  neonConfig.webSocketConstructor = ws;

  // Create adapter with connection string
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL,
  });

  // Create Prisma Client with Neon adapter
  const prisma = new PrismaClient({
    adapter,
    log: ['info', 'warn', 'error'],
  });

  try {
    console.log('\n🔄 Connecting to database...');

    // Test connection with a simple query
    await prisma.$executeRaw`SELECT 1`;
    console.log('✅ Database connection successful!');

    // Test each Prisma model to ensure they work correctly
    console.log('\n🧪 Testing Prisma models...');

    // Test User model
    try {
      const userCount = await prisma.user.count();
      console.log(`✅ User model: ${userCount} records`);
    } catch (error: any) {
      const errorMsg = error.message.split('\n')[0];
      console.log(`⚠️  User model: ${errorMsg}`);
    }

    // Test Company model
    try {
      const companyCount = await prisma.company.count();
      console.log(`✅ Company model: ${companyCount} records`);
    } catch (error: any) {
      const errorMsg = error.message.split('\n')[0];
      console.log(`⚠️  Company model: ${errorMsg}`);
    }

    // Test JobDescription model
    try {
      const jobCount = await prisma.jobDescription.count();
      console.log(`✅ JobDescription model: ${jobCount} records`);
    } catch (error: any) {
      const errorMsg = error.message.split('\n')[0];
      console.log(`⚠️  JobDescription model: ${errorMsg}`);
    }

    // Test Content model
    try {
      const contentCount = await prisma.content.count();
      console.log(`✅ Content model: ${contentCount} records`);
    } catch (error: any) {
      const errorMsg = error.message.split('\n')[0];
      console.log(`⚠️  Content model: ${errorMsg}`);
    }

    // Test Profile model
    try {
      const profileCount = await prisma.profile.count();
      console.log(`✅ Profile model: ${profileCount} records`);
    } catch (error: any) {
      const errorMsg = error.message.split('\n')[0];
      console.log(`⚠️  Profile model: ${errorMsg}`);
    }

    // Test Resume model
    try {
      const resumeCount = await prisma.resume.count();
      console.log(`✅ Resume model: ${resumeCount} records`);
    } catch (error: any) {
      const errorMsg = error.message.split('\n')[0];
      console.log(`⚠️  Resume model: ${errorMsg}`);
    }

    // Test Interview model
    try {
      const interviewCount = await prisma.interview.count();
      console.log(`✅ Interview model: ${interviewCount} records`);
    } catch (error: any) {
      const errorMsg = error.message.split('\n')[0];
      console.log(`⚠️  Interview model: ${errorMsg}`);
    }

    console.log('\n🎉 Database test completed successfully!');

  } catch (error: any) {
    console.error('\n❌ Database connection failed:', error.message);

    // Provide helpful error messages
    if (error.code === 'P1001') {
      console.log('\n💡 Troubleshooting tips:');
      console.log('1. Check if your DATABASE_URL is correct');
      console.log('2. Make sure the Neon database is running');
      console.log('3. Verify your network connection');
      console.log('4. Check if the database hostname is reachable');
    } else if (error.code === 'P1017') {
      console.log('\n💡 Troubleshooting tips:');
      console.log('1. Database server has closed the connection');
      console.log('2. Check if your connection pool settings are correct');
    } else if (error.code === 'P2021') {
      console.log('\n💡 Troubleshooting tips:');
      console.log('1. Table does not exist in database');
      console.log('2. Run `npx prisma migrate dev` to apply migrations');
      console.log('3. Check if migrations have been applied to database');
    }

    process.exit(1);
  } finally {
    // Close Prisma Client connection
    await prisma.$disconnect();
    console.log('\n🔌 Prisma Client disconnected');
  }
}

// Run the test
testDatabaseConnection().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});