Fetch Utilities (src/lib/fetch/)

1. config-tester.ts - Test Config Before Saving

// Test a config with a real HTTP request
const result = await testFetchConfig(config, { timeout: 10000 });

// Result includes:
{
success: true,
url: 'https://careers.tesla.com/api/jobs',
method: 'GET',
statusCode: 200,
responseTime: 234,
data: { ... }, // Parsed JSON or HTML
isJson: true,
itemCount: 50
}

// Also tests pagination
const pagination = await testPagination(config, { maxPages: 3 }); 2. config-fetcher.ts - Server-Side Fetching

// Fetch data with a saved config
const result = await fetchWithConfig(config);

// For paginated endpoints
const results = await fetchWithConfigPaginated(config, { maxPages: 10 });

// Fetch multiple configs for a company
const companyData = await fetchCompanyData(configs); 3. POST /api/explorer/configs/test - Test API

# Test a config before saving

curl -X POST /api/explorer/configs/test \
 -d '{"config": {"url": "https://.../jobs", "parseWith": "json"}, "fullTest": true}' 4. Tests (config-tester.test.ts, config-fetcher.test.ts)
All 6 tests passing
Usage Flow

Agent generates FetchConfig
↓
Admin sees config preview
↓
[Test Config] → Makes real HTTP request → Shows success/data or error
↓
[Approve & Save] → Config saved to DB for server-side fetching
↓
Scheduled job uses FetchConfig to fetch data automatically
