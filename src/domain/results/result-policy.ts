import { ElectionState } from "../../guardrails/index.js";
import type { ElectionStateValue } from "../elections/state-machine";

export type PublishedResultOperation = "overwrite" | "correction" | "invalidation" | "report";

export function canPublishResultVersion(electionState: ElectionStateValue): boolean {
  return electionState === ElectionState.CONFIRMED;
}

export function canOverwritePublishedResult(): false {
  return false;
}

export function requiresCorrectionRequestForPublishedChange(
  electionState: ElectionStateValue
): boolean {
  return electionState === ElectionState.PUBLISHED;
}

export function requiresInvalidationRecord(electionState: ElectionStateValue): boolean {
  return electionState === ElectionState.PUBLISHED || electionState === ElectionState.INVALIDATED;
}

export function assertPublishedResultNotOverwritten(
  operation: PublishedResultOperation
): void {
  if (operation === "overwrite") {
    throw new Error("Published results must not be overwritten; create a correction or invalidation record.");
  }
}

export function reportMustReferenceResultVersion(resultVersionId: string | null | undefined): boolean {
  return typeof resultVersionId === "string" && resultVersionId.length > 0;
}
