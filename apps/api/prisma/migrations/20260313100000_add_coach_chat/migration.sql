-- CreateTable
CREATE TABLE "coach_chats" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_chats_coach_id_patient_id_created_at_idx" ON "coach_chats"("coach_id", "patient_id", "created_at");

-- AddForeignKey
ALTER TABLE "coach_chats" ADD CONSTRAINT "coach_chats_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_chats" ADD CONSTRAINT "coach_chats_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
