-- AlterTable
ALTER TABLE "users" ADD COLUMN     "push_token" TEXT,
ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "coaching_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "push_sent" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coaching_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coaching_logs_user_id_date_idx" ON "coaching_logs"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "coaching_logs_user_id_type_subtype_date_key" ON "coaching_logs"("user_id", "type", "subtype", "date");

-- AddForeignKey
ALTER TABLE "coaching_logs" ADD CONSTRAINT "coaching_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
