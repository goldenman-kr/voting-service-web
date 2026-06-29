-- CreateEnum
CREATE TYPE "ElectionState" AS ENUM ('draft', 'ready_for_review', 'approved', 'scheduled', 'notice', 'open', 'paused', 'closed', 'tallying', 'pending_confirmation', 'confirmed', 'published', 'archived', 'invalidated');

-- CreateEnum
CREATE TYPE "ElectionType" AS ENUM ('representative_election', 'yes_no_agenda', 'multiple_choice_agenda', 'opinion_collection');

-- CreateEnum
CREATE TYPE "VotingMode" AS ENUM ('anonymous', 'named');

-- CreateEnum
CREATE TYPE "AuthenticationMethod" AS ENUM ('invite_link_only', 'invite_link_with_identifier', 'email_code', 'sms_code', 'kakao_message', 'external_identity', 'sso', 'legal_strong_auth');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('active', 'locked', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "AuthStatus" AS ENUM ('not_started', 'identifier_verified', 'code_pending', 'authenticated', 'failed');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'sent', 'failed', 'opened', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "AnonymousVotingPassStatus" AS ENUM ('issued', 'used', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "BallotSubmissionStatus" AS ENUM ('received', 'failed', 'uncertain');

-- CreateEnum
CREATE TYPE "BallotAcceptanceStatus" AS ENUM ('accepted', 'rejected_late', 'rejected_invalid', 'superseded');

-- CreateEnum
CREATE TYPE "VoteAnswerType" AS ENUM ('option', 'free_text', 'abstain');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('single_choice', 'multiple_choice', 'yes_no', 'free_text');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('active', 'disabled', 'archived');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('draft', 'tallied', 'discarded');

-- CreateEnum
CREATE TYPE "ResultVersionStatus" AS ENUM ('confirmed', 'published', 'superseded');

-- CreateEnum
CREATE TYPE "ResultVersionType" AS ENUM ('initial', 'correction', 'withdrawal', 'invalidation_notice');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('result_summary', 'question_detail', 'participation', 'audit_summary', 'admin_activity', 'dispute', 'invalidation_correction');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('requested', 'approved', 'rejected', 'ready', 'downloaded', 'expired', 'failed');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('election_created', 'election_updated', 'election_review_requested', 'election_approved', 'election_rejected', 'election_opened', 'election_paused', 'election_resumed', 'election_closed', 'election_archived', 'election_invalidated', 'authentication_policy_updated', 'voter_registry_imported', 'voter_registry_confirmed', 'invitation_sent', 'invitation_resend_requested', 'role_changed', 'permission_changed', 'result_tally_started', 'result_tallied', 'result_confirmed', 'result_published', 'correction_requested', 'correction_approved', 'report_export_requested', 'report_export_downloaded', 'log_viewed', 'log_export_requested', 'log_export_downloaded', 'deletion_requested', 'deletion_approved', 'deletion_completed', 'db_access_requested', 'db_access_approved');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('login_success', 'login_failed', 'mfa_success', 'mfa_failed', 'step_up_success', 'step_up_failed', 'permission_denied', 'suspicious_access', 'account_locked');

-- CreateEnum
CREATE TYPE "CredentialEventType" AS ENUM ('invite_token_verified', 'invite_token_failed', 'invite_opened', 'identifier_check_success', 'identifier_check_failed', 'code_sent', 'code_resent', 'code_verified', 'code_failed', 'external_auth_success', 'external_auth_failed', 'sso_auth_success', 'sso_auth_failed', 'locked', 'unlocked');

-- CreateEnum
CREATE TYPE "SubmissionEventType" AS ENUM ('submission_started', 'submission_accepted', 'submission_failed', 'submission_uncertain', 'late_rejected', 'superseded');

-- CreateEnum
CREATE TYPE "PermissionRiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'invited', 'locked', 'disabled');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('system', 'organization', 'election');

-- CreateEnum
CREATE TYPE "RegistryStatus" AS ENUM ('draft', 'imported', 'validated', 'confirmed', 'locked');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('uploaded', 'validating', 'validated', 'failed');

-- CreateEnum
CREATE TYPE "ValidationErrorType" AS ENUM ('missing_required', 'duplicate', 'invalid_format', 'conflict');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('submitted', 'under_review', 'accepted', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('requested', 'approved', 'rejected', 'applied');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'mitigated', 'resolved');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('requested', 'approved', 'rejected', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'sent', 'failed', 'suppressed');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('app', 'email', 'sms', 'kakao');

-- CreateEnum
CREATE TYPE "DbAccessType" AS ENUM ('read', 'export', 'maintenance', 'restore');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'active',
    "default_timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "settings" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID,
    "email_hash" TEXT NOT NULL,
    "email_encrypted" TEXT,
    "name_encrypted" TEXT,
    "password_hash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "mfa_required" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_mfa_methods" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "method_type" TEXT NOT NULL,
    "secret_encrypted" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_mfa_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "RoleScope" NOT NULL,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "risk_level" "PermissionRiskLevel" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted_by" UUID,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "election_id" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "election_type" "ElectionType" NOT NULL,
    "voting_mode" "VotingMode" NOT NULL DEFAULT 'anonymous',
    "state" "ElectionState" NOT NULL DEFAULT 'draft',
    "notice_starts_at" TIMESTAMPTZ(6),
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_policies" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "allow_revote" BOOLEAN NOT NULL DEFAULT true,
    "publish_counts" BOOLEAN NOT NULL DEFAULT false,
    "result_audience" TEXT NOT NULL DEFAULT 'voters',
    "require_result_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "small_election_min_voters" INTEGER NOT NULL DEFAULT 10,
    "small_option_min_votes" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "election_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authentication_policies" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "method" "AuthenticationMethod" NOT NULL DEFAULT 'invite_link_with_identifier',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_paid_method" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "security_level" TEXT NOT NULL DEFAULT 'standard',
    "identifier_fields" JSONB,
    "code_channel" TEXT,
    "code_ttl_minutes" INTEGER,
    "max_code_resends" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "authentication_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_authentication_methods" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "method" "AuthenticationMethod" NOT NULL,
    "is_allowed" BOOLEAN NOT NULL DEFAULT true,
    "is_paid_method" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "enabled_at" TIMESTAMPTZ(6),
    "disabled_at" TIMESTAMPTZ(6),

    CONSTRAINT "organization_authentication_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_state_histories" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "from_state" "ElectionState",
    "to_state" "ElectionState" NOT NULL,
    "requested_by" UUID,
    "approved_by" UUID,
    "reason" TEXT,
    "change_type" TEXT NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_state_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_change_histories" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "changed_area" TEXT NOT NULL,
    "before_summary" JSONB,
    "after_summary" JSONB,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_change_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "question_type" "QuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "min_select" INTEGER,
    "max_select" INTEGER,
    "display_order" INTEGER NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voter_registries" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "status" "RegistryStatus" NOT NULL DEFAULT 'draft',
    "source_type" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "voter_registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voter_registry_imports" (
    "id" UUID NOT NULL,
    "voter_registry_id" UUID NOT NULL,
    "import_status" "ImportStatus" NOT NULL DEFAULT 'uploaded',
    "file_name" TEXT,
    "file_hash" TEXT,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voter_registry_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voter_registry_validation_errors" (
    "id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "row_number" INTEGER,
    "field_name" TEXT,
    "error_type" "ValidationErrorType" NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voter_registry_validation_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligible_voters" (
    "id" UUID NOT NULL,
    "voter_registry_id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "name_encrypted" TEXT,
    "email_encrypted" TEXT,
    "phone_encrypted" TEXT,
    "external_identifier_encrypted" TEXT,
    "external_identifier_hmac" TEXT NOT NULL,
    "search_hmac" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eligible_voters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "eligible_voter_id" UUID NOT NULL,
    "invite_token_hash" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'email',
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMPTZ(6),
    "last_sent_at" TIMESTAMPTZ(6),
    "send_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voting_credentials" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "eligible_voter_id" UUID NOT NULL,
    "credential_status" "CredentialStatus" NOT NULL DEFAULT 'active',
    "auth_status" "AuthStatus" NOT NULL DEFAULT 'not_started',
    "identifier_failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "authenticated_at" TIMESTAMPTZ(6),
    "has_voted" BOOLEAN NOT NULL DEFAULT false,
    "last_vote_confirmed_at" TIMESTAMPTZ(6),
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "voting_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voter_sessions" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "eligible_voter_id" UUID NOT NULL,
    "voting_credential_id" UUID NOT NULL,
    "opaque_handle_hash" TEXT NOT NULL,
    "authentication_method" "AuthenticationMethod" NOT NULL,
    "authenticated" BOOLEAN NOT NULL DEFAULT false,
    "identifier_verified_at" TIMESTAMPTZ(6),
    "step" "AuthStatus" NOT NULL DEFAULT 'not_started',
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "metadata_summary" JSONB,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "voter_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_events" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "voting_credential_id" UUID NOT NULL,
    "event_type" "CredentialEventType" NOT NULL,
    "method" "AuthenticationMethod" NOT NULL,
    "channel" "NotificationChannel",
    "provider" TEXT,
    "success" BOOLEAN,
    "failure_reason_code" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "credential_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anonymous_voting_passes" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "voting_credential_id" UUID NOT NULL,
    "pass_status" "AnonymousVotingPassStatus" NOT NULL DEFAULT 'issued',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "usage_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "anonymous_voting_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anonymous_ballot_groups" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "ballot_group_token_hash" TEXT NOT NULL,
    "current_ballot_id" UUID,
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "last_submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anonymous_ballot_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ballots" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "anonymous_ballot_group_id" UUID,
    "submission_status" "BallotSubmissionStatus" NOT NULL,
    "acceptance_status" "BallotAcceptanceStatus" NOT NULL,
    "server_received_at" TIMESTAMPTZ(6) NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "superseded_at" TIMESTAMPTZ(6),
    "receipt_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ballots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" UUID NOT NULL,
    "ballot_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "answer_type" "VoteAnswerType" NOT NULL,
    "free_text_encrypted" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_options" (
    "vote_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,

    CONSTRAINT "vote_options_pkey" PRIMARY KEY ("vote_id","option_id")
);

-- CreateTable
CREATE TABLE "submission_events" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "ballot_id" UUID,
    "event_type" "SubmissionEventType" NOT NULL,
    "server_received_at" TIMESTAMPTZ(6),
    "acceptance_status" "BallotAcceptanceStatus",
    "reason_code" TEXT,
    "ip_masked" TEXT,
    "ip_hash" TEXT,
    "user_agent_summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'draft',
    "tallied_at" TIMESTAMPTZ(6),
    "tallied_by" UUID,
    "source_rule" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_items" (
    "id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "option_id" UUID,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "masked" BOOLEAN NOT NULL DEFAULT false,
    "display_label" TEXT,

    CONSTRAINT "result_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_versions" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "version_type" "ResultVersionType" NOT NULL,
    "status" "ResultVersionStatus" NOT NULL DEFAULT 'confirmed',
    "confirmed_by" UUID,
    "published_at" TIMESTAMPTZ(6),
    "notice" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "result_version_id" UUID NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "format" TEXT NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'requested',
    "generated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_exports" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "approved_by" UUID,
    "status" "ExportStatus" NOT NULL DEFAULT 'requested',
    "purpose" TEXT NOT NULL,
    "export_format" TEXT NOT NULL,
    "scope_summary" JSONB,
    "file_hash" TEXT,
    "watermark_id" TEXT,
    "download_url_hash" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "downloaded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "submitted_by" UUID,
    "handled_by" UUID,
    "status" "DisputeStatus" NOT NULL DEFAULT 'submitted',
    "reason" TEXT NOT NULL,
    "resolution" TEXT,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_requests" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "result_version_id" UUID NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'requested',
    "reason" TEXT NOT NULL,
    "requested_by" UUID NOT NULL,
    "approved_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(6),

    CONSTRAINT "correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invalidation_records" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "result_version_id" UUID,
    "reason" TEXT NOT NULL,
    "requested_by" UUID NOT NULL,
    "approved_by" UUID,
    "notice" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(6),

    CONSTRAINT "invalidation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_incidents" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "incident_type" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "impact_summary" TEXT,
    "resolution" TEXT,
    "created_by" UUID,

    CONSTRAINT "operation_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID,
    "actor_user_id" UUID,
    "event_type" "AuditEventType" NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID,
    "risk_level" "PermissionRiskLevel",
    "reason" TEXT,
    "before_summary" JSONB,
    "after_summary" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "integrity_hash" TEXT,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_type" TEXT NOT NULL,
    "actor_id" UUID,
    "event_type" "SecurityEventType" NOT NULL,
    "risk_level" "PermissionRiskLevel" NOT NULL,
    "ip_masked" TEXT,
    "ip_hash" TEXT,
    "user_agent_summary" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "db_access_events" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "approval_id" UUID,
    "access_type" "DbAccessType" NOT NULL,
    "target_area" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "row_count_summary" INTEGER,
    "post_review_status" TEXT,

    CONSTRAINT "db_access_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "data_category" TEXT NOT NULL,
    "retention_days" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "election_id" UUID,
    "requested_by" UUID NOT NULL,
    "approved_by" UUID,
    "data_category" TEXT NOT NULL,
    "status" "DeletionStatus" NOT NULL DEFAULT 'requested',
    "reason" TEXT,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(6),

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "setting_type" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "election_id" UUID,
    "recipient_type" TEXT NOT NULL,
    "recipient_ref_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "delivery_type" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "provider" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "failure_reason_code" TEXT,

    CONSTRAINT "delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organizations_tenant_id_status_idx" ON "organizations"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_tenant_id_name_key" ON "organizations"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "users_organization_id_status_idx" ON "users"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_hash_key" ON "users"("tenant_id", "email_hash");

-- CreateIndex
CREATE INDEX "user_mfa_methods_user_id_status_idx" ON "user_mfa_methods"("user_id", "status");

-- CreateIndex
CREATE INDEX "roles_scope_idx" ON "roles"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_code_key" ON "roles"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_election_id_key" ON "user_roles"("user_id", "role_id", "election_id");

-- CreateIndex
CREATE INDEX "elections_organization_id_state_idx" ON "elections"("organization_id", "state");

-- CreateIndex
CREATE INDEX "elections_starts_at_ends_at_idx" ON "elections"("starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "election_policies_election_id_key" ON "election_policies"("election_id");

-- CreateIndex
CREATE UNIQUE INDEX "authentication_policies_election_id_key" ON "authentication_policies"("election_id");

-- CreateIndex
CREATE INDEX "authentication_policies_method_idx" ON "authentication_policies"("method");

-- CreateIndex
CREATE UNIQUE INDEX "organization_authentication_methods_organization_id_method__key" ON "organization_authentication_methods"("organization_id", "method", "provider");

-- CreateIndex
CREATE INDEX "election_state_histories_election_id_changed_at_idx" ON "election_state_histories"("election_id", "changed_at");

-- CreateIndex
CREATE INDEX "election_state_histories_to_state_idx" ON "election_state_histories"("to_state");

-- CreateIndex
CREATE INDEX "election_change_histories_election_id_changed_at_idx" ON "election_change_histories"("election_id", "changed_at");

-- CreateIndex
CREATE INDEX "questions_election_id_idx" ON "questions"("election_id");

-- CreateIndex
CREATE UNIQUE INDEX "questions_election_id_display_order_key" ON "questions"("election_id", "display_order");

-- CreateIndex
CREATE INDEX "options_question_id_idx" ON "options"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "options_question_id_display_order_key" ON "options"("question_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "voter_registries_election_id_key" ON "voter_registries"("election_id");

-- CreateIndex
CREATE INDEX "voter_registry_imports_voter_registry_id_import_status_idx" ON "voter_registry_imports"("voter_registry_id", "import_status");

-- CreateIndex
CREATE INDEX "voter_registry_validation_errors_import_id_error_type_idx" ON "voter_registry_validation_errors"("import_id", "error_type");

-- CreateIndex
CREATE INDEX "eligible_voters_voter_registry_id_status_idx" ON "eligible_voters"("voter_registry_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "eligible_voters_election_id_external_identifier_hmac_key" ON "eligible_voters"("election_id", "external_identifier_hmac");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_invite_token_hash_key" ON "invitations"("invite_token_hash");

-- CreateIndex
CREATE INDEX "invitations_election_id_status_idx" ON "invitations"("election_id", "status");

-- CreateIndex
CREATE INDEX "invitations_eligible_voter_id_idx" ON "invitations"("eligible_voter_id");

-- CreateIndex
CREATE INDEX "voting_credentials_election_id_auth_status_idx" ON "voting_credentials"("election_id", "auth_status");

-- CreateIndex
CREATE INDEX "voting_credentials_locked_until_idx" ON "voting_credentials"("locked_until");

-- CreateIndex
CREATE UNIQUE INDEX "voting_credentials_election_id_eligible_voter_id_key" ON "voting_credentials"("election_id", "eligible_voter_id");

-- CreateIndex
CREATE UNIQUE INDEX "voter_sessions_opaque_handle_hash_key" ON "voter_sessions"("opaque_handle_hash");

-- CreateIndex
CREATE INDEX "voter_sessions_expires_at_idx" ON "voter_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "voter_sessions_election_id_idx" ON "voter_sessions"("election_id");

-- CreateIndex
CREATE INDEX "voter_sessions_eligible_voter_id_expires_at_idx" ON "voter_sessions"("eligible_voter_id", "expires_at");

-- CreateIndex
CREATE INDEX "voter_sessions_voting_credential_id_revoked_at_expires_at_idx" ON "voter_sessions"("voting_credential_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "credential_events_voting_credential_id_occurred_at_idx" ON "credential_events"("voting_credential_id", "occurred_at");

-- CreateIndex
CREATE INDEX "credential_events_election_id_event_type_idx" ON "credential_events"("election_id", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "anonymous_voting_passes_voting_credential_id_key" ON "anonymous_voting_passes"("voting_credential_id");

-- CreateIndex
CREATE INDEX "anonymous_voting_passes_election_id_pass_status_idx" ON "anonymous_voting_passes"("election_id", "pass_status");

-- CreateIndex
CREATE UNIQUE INDEX "anonymous_voting_passes_election_id_voting_credential_id_key" ON "anonymous_voting_passes"("election_id", "voting_credential_id");

-- CreateIndex
CREATE INDEX "anonymous_ballot_groups_election_id_current_ballot_id_idx" ON "anonymous_ballot_groups"("election_id", "current_ballot_id");

-- CreateIndex
CREATE UNIQUE INDEX "anonymous_ballot_groups_election_id_ballot_group_token_hash_key" ON "anonymous_ballot_groups"("election_id", "ballot_group_token_hash");

-- CreateIndex
CREATE INDEX "ballots_election_id_is_current_acceptance_status_server_rec_idx" ON "ballots"("election_id", "is_current", "acceptance_status", "server_received_at");

-- CreateIndex
CREATE INDEX "ballots_anonymous_ballot_group_id_server_received_at_idx" ON "ballots"("anonymous_ballot_group_id", "server_received_at");

-- CreateIndex
CREATE INDEX "ballots_anonymous_ballot_group_id_is_current_idx" ON "ballots"("anonymous_ballot_group_id", "is_current");

-- CreateIndex
-- Enforce at most one current ballot per anonymous ballot group.
CREATE UNIQUE INDEX "unique_current_ballot_per_group" ON "ballots"("anonymous_ballot_group_id") WHERE "is_current" = true;

-- CreateIndex
CREATE INDEX "votes_question_id_idx" ON "votes"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_ballot_id_question_id_key" ON "votes"("ballot_id", "question_id");

-- CreateIndex
CREATE INDEX "vote_options_option_id_idx" ON "vote_options"("option_id");

-- CreateIndex
CREATE INDEX "submission_events_election_id_created_at_idx" ON "submission_events"("election_id", "created_at");

-- CreateIndex
CREATE INDEX "submission_events_ballot_id_idx" ON "submission_events"("ballot_id");

-- CreateIndex
CREATE INDEX "results_election_id_status_idx" ON "results"("election_id", "status");

-- CreateIndex
CREATE INDEX "result_items_result_id_question_id_idx" ON "result_items"("result_id", "question_id");

-- CreateIndex
CREATE INDEX "result_items_option_id_idx" ON "result_items"("option_id");

-- CreateIndex
CREATE INDEX "result_versions_election_id_status_idx" ON "result_versions"("election_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "result_versions_election_id_version_no_key" ON "result_versions"("election_id", "version_no");

-- CreateIndex
CREATE INDEX "reports_election_id_report_type_idx" ON "reports"("election_id", "report_type");

-- CreateIndex
CREATE INDEX "report_exports_report_id_status_idx" ON "report_exports"("report_id", "status");

-- CreateIndex
CREATE INDEX "disputes_election_id_status_idx" ON "disputes"("election_id", "status");

-- CreateIndex
CREATE INDEX "correction_requests_election_id_status_idx" ON "correction_requests"("election_id", "status");

-- CreateIndex
CREATE INDEX "invalidation_records_election_id_idx" ON "invalidation_records"("election_id");

-- CreateIndex
CREATE INDEX "operation_incidents_election_id_status_idx" ON "operation_incidents"("election_id", "status");

-- CreateIndex
CREATE INDEX "operation_incidents_severity_idx" ON "operation_incidents"("severity");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_occurred_at_idx" ON "audit_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_event_type_idx" ON "audit_events"("event_type");

-- CreateIndex
CREATE INDEX "audit_events_target_type_target_id_idx" ON "audit_events"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "security_events_tenant_id_occurred_at_idx" ON "security_events"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "security_events_event_type_risk_level_idx" ON "security_events"("event_type", "risk_level");

-- CreateIndex
CREATE INDEX "db_access_events_actor_user_id_started_at_idx" ON "db_access_events"("actor_user_id", "started_at");

-- CreateIndex
CREATE INDEX "db_access_events_target_area_idx" ON "db_access_events"("target_area");

-- CreateIndex
CREATE UNIQUE INDEX "retention_policies_organization_id_data_category_key" ON "retention_policies"("organization_id", "data_category");

-- CreateIndex
CREATE INDEX "deletion_requests_organization_id_status_idx" ON "deletion_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "deletion_requests_election_id_idx" ON "deletion_requests"("election_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_organization_id_channel_setting_type_key" ON "notification_settings"("organization_id", "channel", "setting_type");

-- CreateIndex
CREATE INDEX "delivery_events_election_id_delivery_type_idx" ON "delivery_events"("election_id", "delivery_type");

-- CreateIndex
CREATE INDEX "delivery_events_status_sent_at_idx" ON "delivery_events"("status", "sent_at");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mfa_methods" ADD CONSTRAINT "user_mfa_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_policies" ADD CONSTRAINT "election_policies_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authentication_policies" ADD CONSTRAINT "authentication_policies_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_authentication_methods" ADD CONSTRAINT "organization_authentication_methods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_state_histories" ADD CONSTRAINT "election_state_histories_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_state_histories" ADD CONSTRAINT "election_state_histories_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_state_histories" ADD CONSTRAINT "election_state_histories_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_change_histories" ADD CONSTRAINT "election_change_histories_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_change_histories" ADD CONSTRAINT "election_change_histories_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options" ADD CONSTRAINT "options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_registries" ADD CONSTRAINT "voter_registries_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_registry_imports" ADD CONSTRAINT "voter_registry_imports_voter_registry_id_fkey" FOREIGN KEY ("voter_registry_id") REFERENCES "voter_registries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_registry_validation_errors" ADD CONSTRAINT "voter_registry_validation_errors_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "voter_registry_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligible_voters" ADD CONSTRAINT "eligible_voters_voter_registry_id_fkey" FOREIGN KEY ("voter_registry_id") REFERENCES "voter_registries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligible_voters" ADD CONSTRAINT "eligible_voters_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_eligible_voter_id_fkey" FOREIGN KEY ("eligible_voter_id") REFERENCES "eligible_voters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voting_credentials" ADD CONSTRAINT "voting_credentials_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voting_credentials" ADD CONSTRAINT "voting_credentials_eligible_voter_id_fkey" FOREIGN KEY ("eligible_voter_id") REFERENCES "eligible_voters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_sessions" ADD CONSTRAINT "voter_sessions_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_sessions" ADD CONSTRAINT "voter_sessions_eligible_voter_id_fkey" FOREIGN KEY ("eligible_voter_id") REFERENCES "eligible_voters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_sessions" ADD CONSTRAINT "voter_sessions_voting_credential_id_fkey" FOREIGN KEY ("voting_credential_id") REFERENCES "voting_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_voting_credential_id_fkey" FOREIGN KEY ("voting_credential_id") REFERENCES "voting_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anonymous_voting_passes" ADD CONSTRAINT "anonymous_voting_passes_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anonymous_voting_passes" ADD CONSTRAINT "anonymous_voting_passes_voting_credential_id_fkey" FOREIGN KEY ("voting_credential_id") REFERENCES "voting_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anonymous_ballot_groups" ADD CONSTRAINT "anonymous_ballot_groups_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anonymous_ballot_groups" ADD CONSTRAINT "anonymous_ballot_groups_current_ballot_id_fkey" FOREIGN KEY ("current_ballot_id") REFERENCES "ballots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_anonymous_ballot_group_id_fkey" FOREIGN KEY ("anonymous_ballot_group_id") REFERENCES "anonymous_ballot_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_ballot_id_fkey" FOREIGN KEY ("ballot_id") REFERENCES "ballots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_options" ADD CONSTRAINT "vote_options_vote_id_fkey" FOREIGN KEY ("vote_id") REFERENCES "votes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_options" ADD CONSTRAINT "vote_options_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_ballot_id_fkey" FOREIGN KEY ("ballot_id") REFERENCES "ballots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_tallied_by_fkey" FOREIGN KEY ("tallied_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_items" ADD CONSTRAINT "result_items_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_items" ADD CONSTRAINT "result_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_items" ADD CONSTRAINT "result_items_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_versions" ADD CONSTRAINT "result_versions_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_versions" ADD CONSTRAINT "result_versions_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_versions" ADD CONSTRAINT "result_versions_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_result_version_id_fkey" FOREIGN KEY ("result_version_id") REFERENCES "result_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_result_version_id_fkey" FOREIGN KEY ("result_version_id") REFERENCES "result_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invalidation_records" ADD CONSTRAINT "invalidation_records_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invalidation_records" ADD CONSTRAINT "invalidation_records_result_version_id_fkey" FOREIGN KEY ("result_version_id") REFERENCES "result_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invalidation_records" ADD CONSTRAINT "invalidation_records_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invalidation_records" ADD CONSTRAINT "invalidation_records_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_incidents" ADD CONSTRAINT "operation_incidents_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_incidents" ADD CONSTRAINT "operation_incidents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "db_access_events" ADD CONSTRAINT "db_access_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
