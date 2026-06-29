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
    expect(newElectionSource).toContain("invite_link_with_identifier");
    expect(actionSource).toContain("getDefaultAuthenticationMethod");
    expect(actionSource).toContain("현재 MVP에서 사용할 수 없는 인증 방식입니다.");
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
