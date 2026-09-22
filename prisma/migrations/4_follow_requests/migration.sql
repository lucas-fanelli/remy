-- Follow requests for private accounts.
--
-- Purely additive: one new, empty table. The release that is live when this is applied keeps
-- working, and rolling the code back leaves these rows inert. A row here is a PENDING request
-- and grants nothing: accepting it deletes the row and inserts into "follows" in one
-- transaction. Nothing that reads "follows" — counts, lists, access checks — can see it.
--
-- Generated with prisma migrate diff between the schemas before and after.

-- CreateTable
CREATE TABLE "follow_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_requests_targetId_createdAt_idx" ON "follow_requests"("targetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "follow_requests_requesterId_targetId_key" ON "follow_requests"("requesterId", "targetId");

-- AddForeignKey
ALTER TABLE "follow_requests" ADD CONSTRAINT "follow_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_requests" ADD CONSTRAINT "follow_requests_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

