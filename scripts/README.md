# Scripts Directory

This directory contains utility scripts for the WhyJob project.

## Database Test Script

The `test-db.ts` script tests the connection to the Neon PostgreSQL database using Prisma Client.

### Usage

```bash
# Run the database test
npm run test:db

# Or run directly with tsx
npx tsx scripts/test-db.ts
```

### What it does

1. **Loads environment variables** from `.env` file
2. **Checks DATABASE_URL** is set
3. **Connects to database** using Prisma Client
4. **Runs a test query** to verify connection
5. **Lists all tables** in the database
6. **Tests each Prisma model** to ensure they work correctly
7. **Provides troubleshooting tips** if connection fails

### Environment Variables

The script requires the following environment variables in your `.env` file:

```env
# Database Connection
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
```

### Troubleshooting

If the script fails, check:

1. **Database URL**: Make sure your `DATABASE_URL` in `.env` is correct
2. **Network connectivity**: Ensure you can reach the Neon database host
3. **Database status**: Check if the Neon database is running
4. **Prisma schema**: Run `npx prisma generate` if Prisma Client is not up to date
5. **Migrations**: Run `npx prisma migrate dev` if database schema is not applied

### Common Error Codes

- **P1001**: Can't reach database server
  - Check network connection
  - Verify DATABASE_URL hostname
  - Ensure database is running

- **P1017**: Database server closed the connection
  - Check connection pool settings
  - Verify database credentials

- **P2021**: Table does not exist
  - Run `npx prisma migrate dev` to apply migrations
  - Check if migrations have been applied to database

### Adding New Scripts

To add a new script:

1. Create a new `.ts` file in this directory
2. Use `dotenv.config()` to load environment variables
3. Add a script to `package.json` if needed
4. Update this README with usage instructions