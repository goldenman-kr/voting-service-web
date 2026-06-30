import { z } from "zod";

export const reasonRequiredSchema = z.object({
  reason: z.string().trim().min(1)
});

export const optionalReasonSchema = z.object({
  reason: z.string().trim().optional()
});

export const publishResultInputSchema = optionalReasonSchema.extend({
  notice: z.string().trim().optional()
});

export const correctionRequestInputSchema = optionalReasonSchema.extend({
  notice: z.string().trim().optional()
});

export const approveCorrectionInputSchema = optionalReasonSchema.extend({
  notice: z.string().trim().optional()
});

export const invalidateElectionInputSchema = optionalReasonSchema.extend({
  notice: z.string().trim().optional()
});

export const reportExportRequestInputSchema = z.object({
  purpose: z.string().trim().min(1),
  format: z.string().trim().min(1).default("pdf"),
  scope: z.record(z.string(), z.unknown()).optional()
});

export type ReportExportRequestInput = z.infer<typeof reportExportRequestInputSchema>;
