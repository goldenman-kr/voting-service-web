-- AlterTable
ALTER TABLE "voter_registries" ADD COLUMN     "managed_registry_id" UUID;

-- CreateTable
CREATE TABLE "managed_voter_registries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RegistryStatus" NOT NULL DEFAULT 'validated',
    "source_type" TEXT NOT NULL DEFAULT 'manual',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "managed_voter_registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managed_voters" (
    "id" UUID NOT NULL,
    "managed_registry_id" UUID NOT NULL,
    "name_encrypted" TEXT,
    "phone_encrypted" TEXT,
    "external_identifier_encrypted" TEXT,
    "external_identifier_hmac" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "managed_voters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "managed_voter_registries_organization_id_status_idx" ON "managed_voter_registries"("organization_id", "status");

-- CreateIndex
CREATE INDEX "managed_voter_registries_updated_at_idx" ON "managed_voter_registries"("updated_at");

-- CreateIndex
CREATE INDEX "managed_voters_managed_registry_id_status_idx" ON "managed_voters"("managed_registry_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "managed_voters_managed_registry_id_external_identifier_hmac_key" ON "managed_voters"("managed_registry_id", "external_identifier_hmac");

-- CreateIndex
CREATE INDEX "voter_registries_managed_registry_id_idx" ON "voter_registries"("managed_registry_id");

-- AddForeignKey
ALTER TABLE "voter_registries" ADD CONSTRAINT "voter_registries_managed_registry_id_fkey" FOREIGN KEY ("managed_registry_id") REFERENCES "managed_voter_registries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managed_voter_registries" ADD CONSTRAINT "managed_voter_registries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managed_voters" ADD CONSTRAINT "managed_voters_managed_registry_id_fkey" FOREIGN KEY ("managed_registry_id") REFERENCES "managed_voter_registries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
