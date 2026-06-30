import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuthenticationMethod, ElectionState } from "../src/guardrails/index.js";
import { StatusBadge } from "../src/components/ui/status-badge";

const projectRoot = process.cwd();

function readUiSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("UI guardrails", () => {
  it("StatusBadge renders approved ElectionState values", () => {
    const states = [
      ElectionState.DRAFT,
      ElectionState.READY_FOR_REVIEW,
      ElectionState.APPROVED,
      ElectionState.SCHEDULED,
      ElectionState.OPEN,
      ElectionState.PAUSED,
      ElectionState.CLOSED,
      ElectionState.TALLYING,
      ElectionState.PENDING_CONFIRMATION,
      ElectionState.CONFIRMED,
      ElectionState.PUBLISHED,
      ElectionState.INVALIDATED
    ];

    for (const state of states) {
      expect(renderToStaticMarkup(createElement(StatusBadge, { status: state }))).toContain("span");
    }
  });

  it("AuthenticationPolicy UI keeps invite_link_with_identifier as the default and paid methods disabled", () => {
    const formSource = readUiSource("src/components/admin/admin-election-forms.tsx");
    const newElectionSource = readUiSource("src/app/admin/(protected)/elections/new/page.tsx");
    const actionSource = readUiSource("src/server/elections/admin-actions.ts");

    expect(formSource).toContain("AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER");
    expect(formSource).toContain("MVP에서 사용 가능");
    expect(formSource).toContain("기본 비활성 - 상용화/유료/후속 확장 옵션");
    expect(formSource).not.toContain("font-mono");
    expect(newElectionSource).toContain("새 투표 만들기");
    expect(newElectionSource).not.toContain("AuthenticationPolicy");
    expect(newElectionSource).not.toContain("invite_link_with_identifier");
    expect(actionSource).toContain("getDefaultAuthenticationMethod");
    expect(actionSource).toContain("현재 MVP에서 사용할 수 없는 인증 방식입니다.");
  });

  it("admin election creation wizard exposes friendly three-step UX without future features enabled", () => {
    const formSource = readUiSource("src/components/admin/admin-election-forms.tsx");
    const actionSource = readUiSource("src/server/elections/admin-actions.ts");

    expect(formSource).toContain("1 기본 정보");
    expect(formSource).toContain("2 문항/선택지");
    expect(formSource).toContain("3 선거인 명부");
    expect(formSource).toContain("isStepOneComplete");
    expect(formSource).toContain("isStepTwoComplete");
    expect(formSource).toContain("선택 항목은 최소 2개");
    expect(formSource).toContain("사진 업로드는 후속 기능입니다");
    expect(formSource).toContain("기존 명부 불러오기와 새 공통 명부 만들기는 후속 Phase 기능입니다");
    expect(formSource).toContain("투표 참여 인증 방식");
    expect(formSource).not.toContain("Ballot ID");
    expect(formSource).not.toContain("Vote ID");
    expect(formSource).not.toContain("AnonymousBallotGroup ID");
    expect(formSource).not.toContain("session token");
    expect(actionSource).toContain("createElectionWizardAction");
    expect(actionSource).toContain("createElectionDraft");
    expect(actionSource).toContain("createQuestion");
    expect(actionSource).toContain("createOption");
    expect(actionSource).toContain("importEligibleVoters");
  });

  it("admin election detail uses friendly sections and draft-only edit entry", () => {
    const detailSource = readUiSource("src/app/admin/(protected)/elections/[election_id]/page.tsx");
    const authPolicyPage = readUiSource("src/app/admin/(protected)/elections/[election_id]/auth-policy/page.tsx");

    expect(detailSource).toContain("투표 기본 정보");
    expect(detailSource).toContain("투표 참여 인증 방식");
    expect(detailSource).toContain("문항과 선택 항목");
    expect(detailSource).toContain("선거인 명부");
    expect(detailSource).toContain("운영 상태");
    expect(detailSource).toContain("검수 요청 전 확인할 항목");
    expect(detailSource).toContain("준비됨");
    expect(detailSource).toContain("확인 필요");
    expect(detailSource).toContain("검수 요청 가능");
    expect(detailSource).toContain("확인하기");
    expect(detailSource).toContain("편집하기");
    expect(detailSource).toContain("canUseExistingDraftEditPages");
    expect(detailSource).toContain("election.state === ElectionState.DRAFT");
    expect(detailSource).toContain("초대 링크 + 선거인 확인");
    expect(detailSource).toContain("관리자 화면에는 초대 링크 원문");
    expect(detailSource).toContain("현재 상태에서는 문항, 선택 항목, 선거인 명부를 수정할 수 없습니다");
    expect(detailSource).toContain("검수 요청을 보내면 투표 설정을 확정하는 단계로 이동합니다");
    expect(detailSource).toContain("다시 작성 단계로 되돌리는 절차가 필요할 수 있습니다");
    expect(detailSource).not.toContain("AuthenticationPolicy");
    expect(detailSource).not.toContain("VoterRegistry");
    expect(detailSource).not.toContain("AnonymousBallotGroup");
    expect(detailSource).not.toContain("invite token");
    expect(detailSource).not.toContain("hash");

    expect(authPolicyPage).toContain("투표 참여 인증 방식 설정");
    expect(authPolicyPage).not.toContain("AuthenticationPolicy 설정");
  });

  it("admin draft edit route exposes Draft-only conservative question and option editing", () => {
    const editPage = readUiSource("src/app/admin/(protected)/elections/[election_id]/edit/page.tsx");
    const formSource = readUiSource("src/components/admin/admin-election-forms.tsx");
    const actionSource = readUiSource("src/server/elections/admin-actions.ts");
    const editQuestionFormSource = formSource.slice(
      formSource.indexOf("export function EditElectionQuestionsAndOptionsForm"),
      formSource.indexOf("export function CreateElectionForm")
    );
    const editSetupPolicyFormSource = formSource.slice(
      formSource.indexOf("export function EditElectionSetupPolicyForm"),
      formSource.indexOf("export function VoterRegistryImportForm")
    );

    expect(editPage).toContain("투표 편집");
    expect(editPage).toContain("election.state === ElectionState.DRAFT");
    expect(editPage).toContain("showEditForm = isDraft && hasNotStarted");
    expect(editPage).toContain("!showEditForm");
    expect(editPage).toContain("통합 편집 제한");
    expect(editPage).toContain("문항/선택 항목 문구를 보수적으로 수정합니다");
    expect(editPage).toContain("EditElectionQuestionsAndOptionsForm");
    expect(editPage).toContain("EditElectionSetupPolicyForm");
    expect(editPage).toContain("명부 전체 교체와 공통 명부 선택은 후속 단계");
    expect(formSource).toContain("EditElectionBasicInfoForm");
    expect(formSource).toContain("updateElectionBasicInfoAction");
    expect(formSource).toContain("기본 정보 저장");
    expect(formSource).toContain("EditElectionQuestionsAndOptionsForm");
    expect(editQuestionFormSource).toContain("질문 제목");
    expect(editQuestionFormSource).toContain("질문 설명");
    expect(editQuestionFormSource).toContain("기존 선택 항목");
    expect(editQuestionFormSource).toContain("새 선택 항목 추가");
    expect(editQuestionFormSource).toContain("append-only");
    expect(editQuestionFormSource).toContain("질문 삭제, 선택 항목 삭제, 순서 변경은 제공하지 않습니다");
    expect(editQuestionFormSource).toContain("삭제와 순서 변경은 결과 의미에 영향을 줄 수 있어");
    expect(editQuestionFormSource).not.toContain("removeOption");
    expect(editQuestionFormSource).not.toContain("drag");
    expect(editQuestionFormSource).not.toContain("displayOrder");
    expect(formSource).toContain("투표 제목");
    expect(formSource).toContain("시작일시");
    expect(formSource).toContain("종료일시");
    expect(actionSource).toContain("updateElectionBasicInfoAction");
    expect(actionSource).toContain("updateElectionDraft");
    expect(actionSource).toContain("updateElectionQuestionsAndOptionsAction");
    expect(actionSource).toContain("updateQuestion");
    expect(actionSource).toContain("updateOption");
    expect(actionSource).toContain("createOption");
    expect(actionSource).toContain("detail.state !== ElectionState.DRAFT");
    expect(actionSource).toContain("detail.startsAt <= new Date()");
    expect(actionSource).toContain("선택 항목은 최소 2개 이상 유지해야 합니다.");
    expect(actionSource).toContain("문항/선택 항목이 저장되었습니다.");
    expect(actionSource).toContain("기본 정보가 저장되었습니다.");
    expect(actionSource).toContain("투표를 시작하기 전에 상세 화면에서 제목, 일정, 문항, 선택 항목, 선거인 명부를 다시 확인해 주세요.");
    expect(editPage).toContain("검수 요청 전 최종 확인");
    expect(editPage).toContain("상세 화면으로 돌아가기");
    expect(editPage).toContain("문항 관리");
    expect(editPage).toContain("선거인 명부 관리");
    expect(editPage).toContain("인증 방식 설정");
    expect(editPage).toContain("#pre-review-summary");
    expect(editSetupPolicyFormSource).toContain("투표 참여 인증 방식");
    expect(formSource).toContain("초대 링크 + 유권자 식별자 확인");
    expect(editSetupPolicyFormSource).toContain("후속 제공 예정입니다");
    expect(editSetupPolicyFormSource).toContain("공급자 연동과 보안 정책이 준비되기 전에는 저장할 수 없습니다");
    expect(editSetupPolicyFormSource).toContain("선거인 명부");
    expect(editSetupPolicyFormSource).toContain("명부 전체 교체, 기존 선거인 삭제/비활성화, 공통 명부 선택을 제공하지 않습니다");
    expect(editSetupPolicyFormSource).toContain("/voters");
    expect(editSetupPolicyFormSource).not.toContain("font-mono");
    expect(editSetupPolicyFormSource).not.toContain("invite_link_with_identifier");
    expect(editSetupPolicyFormSource).not.toContain("sms_code");
    expect(editSetupPolicyFormSource).not.toContain("legal_strong_auth");
    expect(actionSource).toContain("updateElectionAuthPolicyFromWizardAction");
    expect(actionSource).toContain("configureAuthenticationPolicy");
    expect(actionSource).toContain("wizardEnabledAuthMethods");
    expect(actionSource).toContain("초안 상태의 투표만 투표 참여 인증 방식을 수정할 수 있습니다.");
    expect(actionSource).toContain("시작일시가 지난 투표는 투표 참여 인증 방식을 수정할 수 없습니다.");
    expect(actionSource).toContain("현재 MVP에서 사용할 수 없는 인증 방식입니다.");
    expect(actionSource).not.toContain("deleteQuestion");
    expect(actionSource).not.toContain("deleteOption");
    expect(editPage).not.toContain("Ballot ID");
    expect(editPage).not.toContain("Vote ID");
    expect(editPage).not.toContain("AnonymousBallotGroup ID");
    expect(editPage).not.toContain("token");
    expect(editPage).not.toContain("hash");
  });

  it("voter completion screen does not render selected choices", () => {
    const source = readUiSource("src/app/voter/complete/page.tsx");

    expect(source).toContain("getCurrentVoterCompletionStatus");
    expect(source).toContain("확인 정보");
    expect(source).not.toContain("후보 A");
    expect(source).not.toContain("후보 B");
    expect(source).not.toContain("내가 선택한 항목");
    expect(source).not.toContain("optionIds");
    expect(source).not.toContain("answers");
  });

  it("UI source avoids direct rendering of sensitive internal labels", () => {
    const sources = [
      "src/app/admin/(protected)/page.tsx",
      "src/app/admin/(protected)/elections/page.tsx",
      "src/app/admin/(protected)/elections/[election_id]/page.tsx",
      "src/app/admin/(protected)/elections/[election_id]/edit/page.tsx",
      "src/app/admin/(protected)/elections/[election_id]/results/page.tsx",
      "src/app/admin/login/page.tsx",
      "src/components/admin/admin-election-forms.tsx",
      "src/components/admin/admin-election-table.tsx",
      "src/components/admin/admin-login-form.tsx",
      "src/components/admin/admin-operation-forms.tsx",
      "src/components/admin/step-up-panel.tsx",
      "src/app/voter/invite/page.tsx",
      "src/app/voter/identify/page.tsx",
      "src/app/voter/election/page.tsx",
      "src/app/voter/ballot/page.tsx",
      "src/app/voter/complete/page.tsx",
      "src/app/voter/results/page.tsx",
      "src/app/voter/review/page.tsx",
      "src/components/voter/voter-auth-forms.tsx",
      "src/components/voter/voter-ballot-flow.tsx",
      "src/components/ui/anonymous-voting-notice.tsx"
    ].map(readUiSource);
    const combined = sources.join("\n");

    const forbiddenLabels = [
      "Ballot ID",
      "Vote ID",
      "AnonymousBallotGroup ID",
      "ballotGroupTokenHash",
      "invite token",
      "voter session",
      "session token",
      "User-Agent",
      "VotingCredential ID",
      "EligibleVoter ID"
    ];

    for (const label of forbiddenLabels) {
      expect(combined).not.toContain(label);
    }
  });

  it("voter UI uses body-based endpoints and keeps code auth out of the MVP path", () => {
    const inviteSource = readUiSource("src/components/voter/voter-auth-forms.tsx");
    const ballotSource = readUiSource("src/components/voter/voter-ballot-flow.tsx");

    expect(inviteSource).toContain("/api/v1/voter/invitations/verify");
    expect(inviteSource).toContain("/api/v1/voter/identifier/verify");
    expect(inviteSource).not.toContain("/invitations/${");
    expect(inviteSource).toContain("인증코드는 MVP 기본 흐름에서 사용하지 않습니다.");
    expect(ballotSource).toContain("/api/v1/voter/ballots");
    expect(ballotSource).toContain("/api/v1/voter/ballots/revote");
  });

  it("admin operation UI exposes only guarded status/result actions", () => {
    const source = readUiSource("src/components/admin/admin-operation-forms.tsx");
    const detailPage = readUiSource("src/app/admin/(protected)/elections/[election_id]/page.tsx");
    const resultsPage = readUiSource("src/app/admin/(protected)/elections/[election_id]/results/page.tsx");

    expect(source).toContain("approve");
    expect(source).toContain("open");
    expect(source).toContain("pause");
    expect(source).toContain("resume");
    expect(source).toContain("close");
    expect(source).toContain("tally");
    expect(source).toContain("confirm");
    expect(source).toContain("publish");
    expect(source).toContain("request_correction");
    expect(source).toContain("invalidate");
    expect(source).toContain("prepare_invitations");
    expect(source).toContain("send_invitations");
    expect(source).toContain("resend_invitations");
    expect(detailPage).toContain("ElectionStateCtaPanel");
    expect(resultsPage).toContain("ResultOperationPanel");
    expect(resultsPage).toContain("ReportExportSkeleton");
  });
});
