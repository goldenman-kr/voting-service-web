import { AuthenticationMethod, ElectionState } from "../../guardrails/index.js";
import type { ElectionStateValue } from "../../domain/elections/state-machine";

export type DemoElection = Readonly<{
  id: string;
  title: string;
  description: string;
  state: ElectionStateValue;
  votingMode: "anonymous" | "named";
  startsAt: string;
  endsAt: string;
  eligibleCount: number;
  participatedCount: number;
  questions: readonly Readonly<{
    title: string;
    type: string;
    options: readonly string[];
  }>[];
}>;

export const demoElections: readonly DemoElection[] = Object.freeze([
  {
    id: "demo-election",
    title: "2026 운영위원 대표 선출",
    description: "폐쇄형 유권자 명부 기반 익명투표 예시입니다.",
    state: ElectionState.OPEN,
    votingMode: "anonymous",
    startsAt: "2026-06-28 09:00",
    endsAt: "2026-06-28 18:00",
    eligibleCount: 120,
    participatedCount: 64,
    questions: [
      {
        title: "대표 후보를 선택해 주세요.",
        type: "single_choice",
        options: ["후보 A", "후보 B", "기권"]
      }
    ]
  },
  {
    id: "review-election",
    title: "정관 개정 찬반",
    description: "검수 대기 중인 중요 안건 투표입니다.",
    state: ElectionState.READY_FOR_REVIEW,
    votingMode: "anonymous",
    startsAt: "2026-07-01 10:00",
    endsAt: "2026-07-01 17:00",
    eligibleCount: 52,
    participatedCount: 0,
    questions: [
      {
        title: "정관 개정안에 찬성하십니까?",
        type: "yes_no",
        options: ["찬성", "반대", "기권"]
      }
    ]
  },
  {
    id: "result-election",
    title: "감사 선임 결과",
    description: "확정 대기 중인 결과 검수 예시입니다.",
    state: ElectionState.PENDING_CONFIRMATION,
    votingMode: "anonymous",
    startsAt: "2026-06-20 09:00",
    endsAt: "2026-06-20 18:00",
    eligibleCount: 34,
    participatedCount: 31,
    questions: [
      {
        title: "감사 후보를 선택해 주세요.",
        type: "single_choice",
        options: ["후보 C", "후보 D", "기권"]
      }
    ]
  }
]);

export const authenticationMethods = Object.freeze([
  {
    method: AuthenticationMethod.INVITE_LINK_ONLY,
    label: "초대 링크만 사용",
    enabled: false,
    cost: "비용 없음",
    availability: "조직별 선택 가능",
    description: "링크 접근만으로 투표자 흐름을 시작합니다."
  },
  {
    method: AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER,
    label: "선거인 명부 확인",
    enabled: true,
    cost: "비용 없음",
    availability: "MVP 기본값",
    description: "호수번호, 이름, 식별번호, 생년월일로 유권자를 확인합니다."
  },
  {
    method: AuthenticationMethod.EMAIL_CODE,
    label: "1회성 이메일 코드",
    enabled: false,
    cost: "운영 비용 가능",
    availability: "후속 옵션",
    description: "코드 방식이 활성화된 투표에서만 재발송, 만료, 잠금 설정을 표시합니다."
  },
  {
    method: AuthenticationMethod.SMS_CODE,
    label: "1회성 SMS 코드",
    enabled: false,
    cost: "상용화/유료 옵션",
    availability: "기본 비활성",
    description: "MVP에서는 외부 발송 provider를 활성화하지 않습니다."
  },
  {
    method: AuthenticationMethod.KAKAO_MESSAGE,
    label: "카카오/문자 인증",
    enabled: false,
    cost: "상용화/유료 옵션",
    availability: "기본 비활성",
    description: "향후 보안 강화 모드에서 검토합니다."
  },
  {
    method: AuthenticationMethod.EXTERNAL_IDENTITY,
    label: "외부 본인확인",
    enabled: false,
    cost: "상용화/유료 옵션",
    availability: "기본 비활성",
    description: "MVP 범위 밖의 강한 인증입니다."
  },
  {
    method: AuthenticationMethod.SSO,
    label: "SSO",
    enabled: false,
    cost: "상용화/유료 옵션",
    availability: "기본 비활성",
    description: "조직 계정 연동은 후속 확장입니다."
  },
  {
    method: AuthenticationMethod.LEGAL_STRONG_AUTH,
    label: "법적 효력 모드용 강한 인증",
    enabled: false,
    cost: "별도 설계 필요",
    availability: "MVP 제외",
    description: "본인확인, 전자서명, 증빙 보관이 필요한 별도 모드입니다."
  }
]);

export function getDemoElection(electionId: string): DemoElection {
  return demoElections.find((election) => election.id === electionId) ?? demoElections[0];
}
