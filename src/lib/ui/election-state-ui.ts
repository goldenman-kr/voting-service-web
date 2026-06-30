import { ElectionState } from "../../guardrails/index.js";
import type { ElectionStateValue } from "../../domain/elections/state-machine";

export type ElectionStateTone = "neutral" | "info" | "success" | "warning" | "danger";

export type ElectionStateUi = Readonly<{
  label: string;
  description: string;
  tone: ElectionStateTone;
  adminCta: string;
  voterCta: string;
  warning?: string;
  hiddenActions: readonly string[];
}>;

export const ELECTION_STATE_UI: Readonly<Record<ElectionStateValue, ElectionStateUi>> =
  Object.freeze({
    [ElectionState.DRAFT]: {
      label: "초안",
      description: "투표 정보를 작성하고 검수 요청 전까지 수정할 수 있습니다.",
      tone: "neutral",
      adminCta: "검수 요청",
      voterCta: "참여 불가",
      hiddenActions: ["투표 참여", "결과 공개"]
    },
    [ElectionState.READY_FOR_REVIEW]: {
      label: "검수 대기",
      description: "승인자가 투표 설정, 문항, 명부, 인증 정책을 확인해야 합니다.",
      tone: "info",
      adminCta: "검수 진행",
      voterCta: "참여 불가",
      hiddenActions: ["투표 참여", "결과 공개"]
    },
    [ElectionState.APPROVED]: {
      label: "승인됨",
      description: "일정 예약과 초대 발송을 준비할 수 있습니다.",
      tone: "success",
      adminCta: "일정 예약",
      voterCta: "참여 불가",
      hiddenActions: ["투표 참여", "결과 공개"]
    },
    [ElectionState.SCHEDULED]: {
      label: "예약됨",
      description: "시작 시간이 되면 자동으로 진행 상태로 전환됩니다.",
      tone: "info",
      adminCta: "공지 확인",
      voterCta: "대기",
      hiddenActions: ["결과 공개"]
    },
    [ElectionState.NOTICE]: {
      label: "사전 공지",
      description: "유권자에게 투표 일정을 안내하는 기간입니다.",
      tone: "info",
      adminCta: "공지 상태 확인",
      voterCta: "대기",
      hiddenActions: ["결과 공개"]
    },
    [ElectionState.OPEN]: {
      label: "진행 중",
      description: "투표자가 제출할 수 있습니다. 운영 작업에는 사유 입력이 필요합니다.",
      tone: "success",
      adminCta: "진행 현황 보기",
      voterCta: "투표 참여",
      warning: "중단, 조기 종료는 사유 입력 후 바로 실행됩니다.",
      hiddenActions: ["결과 확정", "결과 공개"]
    },
    [ElectionState.PAUSED]: {
      label: "일시중단",
      description: "투표 참여가 일시적으로 차단된 상태입니다.",
      tone: "warning",
      adminCta: "재개 검토",
      voterCta: "일시중단 안내",
      warning: "재개 또는 종료 전 장애 영향 검토가 필요합니다.",
      hiddenActions: ["투표 참여", "결과 공개"]
    },
    [ElectionState.CLOSED]: {
      label: "마감",
      description: "제출이 종료되었고 집계를 실행할 수 있습니다.",
      tone: "neutral",
      adminCta: "결과 집계",
      voterCta: "마감 안내",
      hiddenActions: ["투표 참여", "결과 공개"]
    },
    [ElectionState.TALLYING]: {
      label: "집계 중",
      description: "마지막 유효 제출만 집계 대상으로 계산합니다.",
      tone: "info",
      adminCta: "집계 상태 확인",
      voterCta: "대기",
      hiddenActions: ["투표 참여", "결과 공개"]
    },
    [ElectionState.PENDING_CONFIRMATION]: {
      label: "확정 대기",
      description: "집계 결과를 검수하고 공식 결과 버전을 확정해야 합니다.",
      tone: "warning",
      adminCta: "결과 확정",
      voterCta: "대기",
      warning: "확정 이후 공개 전 검수 절차를 완료해야 합니다.",
      hiddenActions: ["투표 참여"]
    },
    [ElectionState.CONFIRMED]: {
      label: "확정됨",
      description: "결과가 공식 버전으로 확정되었고 공개 승인을 기다립니다.",
      tone: "success",
      adminCta: "결과 공개",
      voterCta: "대기",
      warning: "공개 이후 결과 덮어쓰기는 금지됩니다.",
      hiddenActions: ["투표 참여"]
    },
    [ElectionState.PUBLISHED]: {
      label: "공개됨",
      description: "공개 결과는 보존되며 정정은 새 버전과 공지로 처리합니다.",
      tone: "success",
      adminCta: "보고서 준비",
      voterCta: "결과 보기",
      hiddenActions: ["투표 참여", "결과 덮어쓰기"]
    },
    [ElectionState.ARCHIVED]: {
      label: "보관됨",
      description: "운영 종료 후 보관 중인 투표입니다.",
      tone: "neutral",
      adminCta: "보관 기록 보기",
      voterCta: "결과 보기",
      hiddenActions: ["투표 참여", "상태 변경"]
    },
    [ElectionState.INVALIDATED]: {
      label: "무효",
      description: "무효 사유와 승인 기록을 보존합니다.",
      tone: "danger",
      adminCta: "무효 기록 보기",
      voterCta: "무효 안내",
      warning: "기존 공개 결과와 무효 공지는 이력으로 유지됩니다.",
      hiddenActions: ["투표 참여", "결과 덮어쓰기"]
    }
  });

export function getElectionStateUi(state: ElectionStateValue): ElectionStateUi {
  return ELECTION_STATE_UI[state];
}
