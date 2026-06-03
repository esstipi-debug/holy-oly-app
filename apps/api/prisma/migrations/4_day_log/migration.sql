-- CreateTable
CREATE TABLE "DayLog" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "fatiga" INTEGER NOT NULL,
    "dolor" INTEGER NOT NULL,
    "estres" INTEGER NOT NULL,
    "humor" INTEGER NOT NULL,
    "motivacion" INTEGER NOT NULL,
    "sueno" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,

    CONSTRAINT "DayLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayLog_athleteId_idx" ON "DayLog"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "DayLog_athleteId_date_key" ON "DayLog"("athleteId", "date");

-- AddForeignKey
ALTER TABLE "DayLog" ADD CONSTRAINT "DayLog_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

