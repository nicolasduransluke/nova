-- CreateTable
CREATE TABLE "coaching_plans" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "week_start" TIMESTAMP(3) NOT NULL,
    "week_end" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "goals" JSONB NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "coach_notes" TEXT NOT NULL DEFAULT '',
    "results" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coaching_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_profiles_ai" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "behavioral_data" JSONB NOT NULL DEFAULT '{}',
    "coach_insights" JSONB NOT NULL DEFAULT '[]',
    "coach_learnings" JSONB NOT NULL DEFAULT '{}',
    "last_analyzed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_profiles_ai_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coaching_plans_patient_id_status_idx" ON "coaching_plans"("patient_id", "status");

-- CreateIndex
CREATE INDEX "coaching_plans_coach_id_idx" ON "coaching_plans"("coach_id");

-- CreateIndex
CREATE UNIQUE INDEX "coaching_plans_patient_id_version_key" ON "coaching_plans"("patient_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "patient_profiles_ai_patient_id_key" ON "patient_profiles_ai"("patient_id");

-- AddForeignKey
ALTER TABLE "coaching_plans" ADD CONSTRAINT "coaching_plans_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_plans" ADD CONSTRAINT "coaching_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_profiles_ai" ADD CONSTRAINT "patient_profiles_ai_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
