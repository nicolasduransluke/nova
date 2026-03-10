-- AlterTable
ALTER TABLE "coaching_logs" ADD COLUMN     "disliked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trigger_data" JSONB;

-- AlterTable
ALTER TABLE "patient_profiles_ai" ADD COLUMN     "style_instructions" TEXT NOT NULL DEFAULT '';
