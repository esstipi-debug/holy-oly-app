-- CreateTable: captura de leads de la landing (waitlist). Standalone, sin FKs → orden de
-- aplicación irrelevante (no altera tablas previas). Ver memoria: orden lexicográfico de migs.
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "athletes" INTEGER NOT NULL,
    "country" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
