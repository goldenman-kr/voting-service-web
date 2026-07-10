import { z } from "zod";

import { AuthenticationMethod } from "../../guardrails/index.js";
import { coerceDateInputAsKst } from "../../lib/kst-datetime";

const dateInput = z.preprocess(coerceDateInputAsKst, z.coerce.date());

const electionDraftBaseSchema = z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).optional(),
    electionType: z.enum([
      "representative_election",
      "yes_no_agenda",
      "multiple_choice_agenda",
      "opinion_collection"
    ]),
    votingMode: z.enum(["anonymous", "named"]).default("anonymous"),
    noticeStartsAt: dateInput.optional(),
    startsAt: dateInput,
    endsAt: dateInput,
    timezone: z.string().trim().min(1).default("Asia/Seoul")
  });

export const electionDraftInputSchema = electionDraftBaseSchema
  .refine((input) => input.endsAt > input.startsAt, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"]
  });

export const electionDraftUpdateInputSchema = electionDraftBaseSchema
  .partial()
  .extend({
    reason: z.string().trim().max(1000).optional()
  })
  .refine(
    (input) =>
      input.startsAt === undefined ||
      input.endsAt === undefined ||
      input.endsAt > input.startsAt,
    {
      message: "endsAt must be after startsAt",
      path: ["endsAt"]
    }
  );

const questionBaseSchema = z.object({
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(3000).optional(),
    questionType: z.enum(["single_choice", "multiple_choice", "yes_no", "free_text"]),
    required: z.boolean().default(true),
    minSelect: z.number().int().min(0).optional(),
    maxSelect: z.number().int().min(1).optional(),
    displayOrder: z.number().int().min(0)
  });

export const questionInputSchema = questionBaseSchema
  .refine(
    (input) =>
      input.minSelect === undefined ||
      input.maxSelect === undefined ||
      input.minSelect <= input.maxSelect,
    {
      message: "minSelect must be less than or equal to maxSelect",
      path: ["minSelect"]
    }
  );

export const questionUpdateInputSchema = questionBaseSchema
  .partial()
  .extend({
    reason: z.string().trim().max(1000).optional()
  })
  .refine(
    (input) =>
      input.minSelect === undefined ||
      input.maxSelect === undefined ||
      input.minSelect <= input.maxSelect,
    {
      message: "minSelect must be less than or equal to maxSelect",
      path: ["minSelect"]
    }
  );

export const optionInputSchema = z.object({
  label: z.string().trim().min(1).max(500),
  description: z.string().trim().max(3000).optional(),
  displayOrder: z.number().int().min(0)
});

export const optionUpdateInputSchema = optionInputSchema.partial().extend({
  reason: z.string().trim().max(1000).optional()
});

export const authenticationPolicyInputSchema = z.object({
  method: z.enum(Object.values(AuthenticationMethod) as [string, ...string[]]).default(
    AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER
  ),
  isEnabled: z.boolean().default(true),
  provider: z.string().trim().max(100).optional(),
  identifierFields: z.array(z.string().trim().min(1)).optional(),
  codeChannel: z.string().trim().max(50).optional(),
  codeTtlMinutes: z.number().int().min(1).max(60).optional(),
  maxCodeResends: z.number().int().min(0).max(10).optional(),
  reason: z.string().trim().max(1000).optional()
});

export const eligibleVoterImportRowSchema = z.object({
  householdNumber: z.string().trim().regex(/^\d+$/).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  identifierLast4: z.string().trim().regex(/^\d{4}$/).optional(),
  birthDate6: z.string().trim().regex(/^\d{6}$/).optional(),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().min(5).max(40).optional(),
  externalIdentifier: z.string().trim().min(1).max(200).optional()
}).refine(
  (row) =>
    Boolean(row.externalIdentifier) ||
    Boolean(row.householdNumber && row.name && row.identifierLast4 && row.birthDate6),
  {
    message: "voter registry row requires canonical fields",
    path: ["householdNumber"]
  }
);

export const voterRegistryImportInputSchema = z.object({
  sourceType: z.string().trim().min(1).max(100).default("manual"),
  fileName: z.string().trim().max(255).optional(),
  fileHash: z.string().trim().max(256).optional(),
  rows: z.array(eligibleVoterImportRowSchema).min(1).max(5000),
  reason: z.string().trim().max(1000).optional()
});

export const reviewRequestInputSchema = z.object({
  reason: z.string().trim().min(1).max(1000)
});

export const electionTransitionInputSchema = z.object({
  reason: z.string().trim().max(1000).optional()
});

export const invitationPrepareInputSchema = z.object({
  reason: z.string().trim().max(1000).optional()
});

export const invitationSendInputSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
  channel: z.enum(["app", "email", "sms", "kakao"]).default("email")
});

export const invitationResendInputSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
  eligibleVoterId: z.string().uuid().optional(),
  channel: z.enum(["app", "email", "sms", "kakao"]).default("email")
});

export type ElectionDraftInput = z.infer<typeof electionDraftInputSchema>;
export type ElectionDraftUpdateInput = z.infer<typeof electionDraftUpdateInputSchema>;
export type QuestionInput = z.infer<typeof questionInputSchema>;
export type QuestionUpdateInput = z.infer<typeof questionUpdateInputSchema>;
export type OptionInput = z.infer<typeof optionInputSchema>;
export type OptionUpdateInput = z.infer<typeof optionUpdateInputSchema>;
export type AuthenticationPolicyInput = z.infer<typeof authenticationPolicyInputSchema>;
export type EligibleVoterImportRow = z.infer<typeof eligibleVoterImportRowSchema>;
export type VoterRegistryImportInput = z.infer<typeof voterRegistryImportInputSchema>;
export type ReviewRequestInput = z.infer<typeof reviewRequestInputSchema>;
export type ElectionTransitionInput = z.infer<typeof electionTransitionInputSchema>;
export type InvitationPrepareInput = z.infer<typeof invitationPrepareInputSchema>;
export type InvitationSendInput = z.infer<typeof invitationSendInputSchema>;
export type InvitationResendInput = z.infer<typeof invitationResendInputSchema>;
