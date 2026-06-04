-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "sexo" TEXT NOT NULL DEFAULT 'M';

-- AlterTable
ALTER TABLE "PrescribedExercise" DROP COLUMN "rpe";

-- AlterTable
ALTER TABLE "SessionActual" DROP COLUMN "actualRpe";

