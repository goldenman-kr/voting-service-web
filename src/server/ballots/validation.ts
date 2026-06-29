import { z } from "zod";

export const ballotQuestionAnswerSchema = z.object({
  questionId: z.string().uuid(),
  optionIds: z.array(z.string().uuid()).default([]),
  freeText: z.string().trim().max(5000).optional(),
  abstain: z.boolean().default(false)
});

export const submitBallotInputSchema = z.object({
  answers: z.array(ballotQuestionAnswerSchema).min(1).max(200)
});

export type BallotQuestionAnswerInput = z.infer<typeof ballotQuestionAnswerSchema>;
export type SubmitBallotInput = z.infer<typeof submitBallotInputSchema>;
