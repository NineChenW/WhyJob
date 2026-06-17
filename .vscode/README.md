launch.json - 8 run configurations:

Configuration	Description
Debug Next.js	Start dev server with debugger
Debug Next.js (Turbo)	Turbopack dev server with debugger
Debug: Attach to Node	Attach to existing Node process on port 9229
Debug Prisma Studio	Open Prisma Studio
Run Vitest Tests	Run unit tests in watch mode
Run Vitest with Coverage	Run tests with coverage report
Debug Server Actions	Debug Next.js with break on start
Debug Explorer Agent Graph	Debug the LangGraph explorer agent directly
settings.json - Editor settings for TypeScript, Prettier, ESLint, Tailwind

tasks.json - Common npm tasks (build, dev, lint, test, prisma:*)

Usage:

Press F5 to start debugging
Or Cmd+Shift+P → "Debug: Select and Start Debugging"
Use the "Debug Full Stack" compound to run Next.js + Node attach together
The configs reference ${env:GROQ_API_KEY} so your API key will be picked up from environment if set.