import { cookies } from "next/headers";

import type { ElectionStateValue } from "../../domain/elections/state-machine";
import { parseEnv } from "../../lib/env";
import { VOTER_SESSION_COOKIE_POLICY } from "../auth/voter-session";
import { BALLOT_GROUP_COOKIE_POLICY } from "../ballots/ballot-group-token";
import {
  getVoterCompletionStatus,
  getVoterElectionInfo,
  type VoterRequestContext
} from "../ballots/ballot-service";
import { createPrismaBallotRepository } from "../ballots/prisma-repository";
import { getPrismaClient } from "../db/prisma";
import { normalizeApiError } from "../http/errors";
import { createPrismaResultRepository } from "../results/prisma-repository";
import { getPublicElectionResult } from "../results/result-service";

export type VoterQuestionOptionView = Readonly<{
  id: string;
  label: string;
  description?: string | null;
  display_order: number;
}>;

export type VoterQuestionView = Readonly<{
  id: string;
  title: string;
  description?: string | null;
  question_type: "single_choice" | "multiple_choice" | "yes_no" | "free_text";
  required: boolean;
  min_select?: number | null;
  max_select?: number | null;
  display_order: number;
  options: readonly VoterQuestionOptionView[];
}>;

export type VoterElectionInfoView = Readonly<{
  election_id: string;
  title: string;
  description?: string | null;
  state: ElectionStateValue;
  state_message: string;
  voting_mode: "anonymous" | "named";
  anonymous_notice?: string;
  starts_at: string;
  ends_at: string;
  questions: readonly VoterQuestionView[];
}>;

export type VoterCompletionStatusView = Readonly<{
  completed: boolean;
  last_submitted_at?: string;
  submission_count?: number;
  receipt_preview?: string;
}>;

export type VoterResultView = Readonly<{
  result_version: {
    version_no: number;
    version_type: string;
    status: string;
    published_at?: string;
    notice?: string | null;
  };
  result: {
    status: string;
    privacy_risk_level?: string;
    can_publish_counts?: boolean;
    required_action?: string;
    items: readonly {
      display_label?: string | null;
      masked?: boolean;
      vote_count?: number;
    }[];
  };
}>;

export type VoterDataResult<T> = Readonly<{
  data?: T;
  error?: string;
}>;

async function voterRequestContext(): Promise<VoterRequestContext> {
  const env = parseEnv();
  const cookieStore = await cookies();
  return {
    voterSessionHandle: cookieStore.get(VOTER_SESSION_COOKIE_POLICY.name)?.value,
    ballotGroupToken: cookieStore.get(BALLOT_GROUP_COOKIE_POLICY.name)?.value,
    hmacKey: env.HMAC_KEY
  };
}

export async function getCurrentVoterElectionInfo(): Promise<VoterDataResult<VoterElectionInfoView>> {
  try {
    const data = await getVoterElectionInfo(
      createPrismaBallotRepository(getPrismaClient()),
      await voterRequestContext()
    );
    return { data: data as VoterElectionInfoView };
  } catch (error) {
    return { error: normalizeApiError(error).userMessage };
  }
}

export async function getCurrentVoterCompletionStatus(): Promise<VoterDataResult<VoterCompletionStatusView>> {
  try {
    const data = await getVoterCompletionStatus(
      createPrismaBallotRepository(getPrismaClient()),
      await voterRequestContext()
    );
    return { data: data as VoterCompletionStatusView };
  } catch (error) {
    return { error: normalizeApiError(error).userMessage };
  }
}

export async function getCurrentVoterResult(): Promise<VoterDataResult<VoterResultView>> {
  try {
    const election = await getCurrentVoterElectionInfo();
    if (!election.data) {
      return { error: election.error ?? "투표 정보를 확인할 수 없습니다." };
    }
    const data = await getPublicElectionResult(election.data.election_id, {
      repository: createPrismaResultRepository(getPrismaClient())
    });
    return { data: data as VoterResultView };
  } catch (error) {
    return { error: normalizeApiError(error).userMessage };
  }
}
