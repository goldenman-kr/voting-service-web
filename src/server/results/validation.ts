import { z } from "zod";

export const reasonRequiredSchema = z.object({
  reason: z.string().trim().min(1)
});

export const optionalReasonSchema = z.object({
  reason: z.string().trim().optional()
});

export const publishResultInputSchema = reasonRequiredSchema.extend({
  notice: z.string().trim().optional()
});

export const correctionRequestInputSchema = reasonRequiredSchema.extend({
  notice: z.string().trim().optional()
});

export const approveCorrectionInputSchema = reasonRequiredSchema.extend({
  notice: z.string().trim().optional()
});

export const invalidateElectionInputSchema = reasonRequiredSchema.extend({
  notice: z.string().trim().optional()
});

export const reportExportRequestInputSchema = z.object({
  purpose: z.string().trim().min(1),
  format: z.string().trim().min(1).default("pdf"),
  scope: z.record(z.string(), z.unknown()).optional()
});

export type ReportExportRequestInput = z.infer<typeof reportExportRequestInputSchema>;
