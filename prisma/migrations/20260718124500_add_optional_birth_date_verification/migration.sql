ALTER TABLE "managed_voter_registries"
ADD COLUMN "use_birth_date_for_verification" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "voter_registries"
ADD COLUMN "use_birth_date_for_verification" BOOLEAN NOT NULL DEFAULT true;
