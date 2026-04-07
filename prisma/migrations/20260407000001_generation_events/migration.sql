-- Add GenerationEvent table for real-time SSE streaming
-- Each row is one event emitted by the Inngest code-agent function.
-- The SSE endpoint polls this table and streams events to the browser.

CREATE TABLE "GenerationEvent" (
    "seq"       SERIAL NOT NULL,
    "messageId" TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "taskId"    TEXT,
    "data"      JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationEvent_pkey" PRIMARY KEY ("seq")
);

CREATE INDEX "GenerationEvent_messageId_idx" ON "GenerationEvent"("messageId");
