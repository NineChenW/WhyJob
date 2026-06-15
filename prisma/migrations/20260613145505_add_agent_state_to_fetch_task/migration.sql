-- AlterTable
ALTER TABLE "FetchTask" ADD COLUMN     "currentAction" TEXT,
ADD COLUMN     "currentTarget" TEXT,
ADD COLUMN     "discoveries" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "pagesVisited" TEXT[] DEFAULT ARRAY[]::TEXT[];
