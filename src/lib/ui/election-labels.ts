import { AuthenticationMethod } from "../../guardrails/index.js";

export const electionTypeLabels = [
  { value: "representative_election", label: "대표자 선출" },
  { value: "yes_no_agenda", label: "찬반 안건 투표" },
  { value: "multiple_choice_agenda", label: "복수 선택 안건 투표" },
  { value: "opinion_collection", label: "의견 수렴" }
] as const;

export const electionTypeLabelMap: Record<string, string> = Object.fromEntries(
  electionTypeLabels.map((type) => [type.value, type.label])
);

export const authMethodLabelMap: Record<string, string> = {
  [AuthenticationMethod.INVITE_LINK_ONLY]: "초대 기반 접근",
  [AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER]: "선거인 명부 확인",
  [AuthenticationMethod.EMAIL_CODE]: "이메일 인증코드",
  [AuthenticationMethod.SMS_CODE]: "문자 인증코드",
  [AuthenticationMethod.KAKAO_MESSAGE]: "카카오 알림 인증",
  [AuthenticationMethod.EXTERNAL_IDENTITY]: "외부 본인확인",
  [AuthenticationMethod.SSO]: "통합 로그인",
  [AuthenticationMethod.LEGAL_STRONG_AUTH]: "강화 본인확인"
};

export const questionTypeLabelMap: Record<string, string> = {
  single_choice: "하나만 선택",
  multiple_choice: "여러 개 선택",
  yes_no: "찬반 선택",
  free_text: "서술형"
};

export const resultStatusLabelMap: Record<string, string> = {
  draft: "집계 준비 중",
  tallied: "집계 완료",
  discarded: "폐기됨"
};

export const registryStatusLabelMap: Record<string, string> = {
  draft: "작성 중",
  imported: "불러옴",
  validated: "검증됨",
  confirmed: "확정됨",
  locked: "잠김"
};

export function labelOf(labels: Record<string, string>, value: string | null | undefined, fallback = "미설정"): string {
  if (!value) return fallback;
  return labels[value] ?? fallback;
}
