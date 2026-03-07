-- AlterTable: Add role to users
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'patient';

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateTable: coach_patients
CREATE TABLE "coach_patients" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable: coach_invitations
CREATE TABLE "coach_invitations" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "patient_email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coach_patients_coach_id_patient_id_key" ON "coach_patients"("coach_id", "patient_id");
CREATE INDEX "coach_patients_coach_id_status_idx" ON "coach_patients"("coach_id", "status");
CREATE INDEX "coach_patients_patient_id_idx" ON "coach_patients"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "coach_invitations_token_key" ON "coach_invitations"("token");
CREATE INDEX "coach_invitations_patient_email_status_idx" ON "coach_invitations"("patient_email", "status");
CREATE INDEX "coach_invitations_coach_id_idx" ON "coach_invitations"("coach_id");
CREATE INDEX "coach_invitations_token_idx" ON "coach_invitations"("token");

-- AddForeignKey
ALTER TABLE "coach_patients" ADD CONSTRAINT "coach_patients_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_patients" ADD CONSTRAINT "coach_patients_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coach_invitations" ADD CONSTRAINT "coach_invitations_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
