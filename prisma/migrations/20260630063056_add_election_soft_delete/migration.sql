-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "deletion_reason" TEXT;

-- CreateIndex
CREATE INDEX "elections_organization_id_deleted_at_idx" ON "elections"("organization_id", "deleted_at");
