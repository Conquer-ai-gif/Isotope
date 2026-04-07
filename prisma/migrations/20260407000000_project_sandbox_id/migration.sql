-- Add persistent sandbox ID to Project
-- Sandboxes are now reused across all generations for a project (sandboxManager.ts)
ALTER TABLE "Project" ADD COLUMN "sandboxId" TEXT;
