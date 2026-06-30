import { expect, test, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";

import { cleanupE2eData } from "./cleanup";
import {
  createE2ePrisma,
  ensureKnownInviteTokenForElection,
  findElectionByTitle,
  prepareE2eFixture,
  type E2eFixture
} from "./setup";

const FORBIDDEN_LABELS = [
  "Ballot ID",
  "Vote ID",
  "AnonymousBallotGroup ID",
  "ballotGroupToken",
  "ballotGroupTokenHash",
  "invite token",
  "voter session",
  "session token",
  "VotingCredential ID",
  "EligibleVoter ID",
  "VoterSession ID",
  "User-Agent"
] as const;

let prisma: PrismaClient;
let fixture: E2eFixture;

function datetimeLocal(value: Date): string {
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

async function expectNoForbiddenText(page: Page, extraForbidden: readonly string[] = []) {
  const body = page.locator("body");
  for (const forbidden of [...FORBIDDEN_LABELS, ...extraForbidden]) {
    await expect(body).not.toContainText(forbidden);
  }
}

async function loginAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("이메일").fill(fixture.adminEmail);
  await page.getByLabel("비밀번호").fill(fixture.adminPassword);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
}

async function completeStepUp(page: Page) {
  const panel = page.locator("section").filter({ hasText: "위험 작업 추가 인증" }).first();
  await expect(panel).toBeVisible();
  await panel.getByLabel("비밀번호 재확인").fill(fixture.adminPassword);
  await panel.getByRole("button", { name: "추가 인증" }).click();
  await expect(panel).toContainText("추가 인증이 완료되었습니다.");
}

async function submitOperation(page: Page, buttonName: string, reason?: string) {
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: buttonName }) }).first();
  await expect(form).toBeVisible();
  const reasonInput = form.getByLabel("사유");
  if ((await reasonInput.count()) > 0) {
    await reasonInput.fill(reason ?? "E2E smoke 운영 사유");
  }
  await form.getByRole("button", { name: buttonName }).click();
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

async function expectElectionState(electionId: string, state: string) {
  await expect
    .poll(async () => {
      const election = await prisma.election.findUnique({
        where: { id: electionId },
        select: { state: true }
      });
      return election?.state;
    })
    .toBe(state);
}

async function submitResultOperation(page: Page, buttonName: string, notice?: string) {
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: buttonName }) }).first();
  await expect(form).toBeVisible();
  const noticeInput = form.getByLabel("공지 문구");
  if (notice && (await noticeInput.count()) > 0) {
    await noticeInput.fill(notice);
  }
  await form.getByRole("button", { name: buttonName }).click();
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

async function createElection(page: Page): Promise<string> {
  const startsAt = datetimeLocal(new Date(Date.now() - 60 * 60 * 1000));
  const endsAt = datetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));

  await page.goto("/admin/elections/new");
  await page.getByLabel("투표 제목").fill(fixture.electionTitle);
  await page.getByLabel("설명").fill("Playwright MVP smoke test election");
  await page.getByLabel("투표 유형").selectOption("representative_election");
  await page.getByLabel("시작일시").fill(startsAt);
  await page.getByLabel("종료일시").fill(endsAt);
  await page.getByRole("button", { name: "초안 생성" }).click();
  await expect(page).toHaveURL(/\/admin\/elections\/[0-9a-f-]+$/);
  const electionId = page.url().split("/").at(-1);
  if (!electionId) {
    throw new Error("Election id was not present after draft creation");
  }
  await expect(page.getByRole("heading", { name: fixture.electionTitle })).toBeVisible();
  return electionId;
}

test.beforeAll(async () => {
  prisma = createE2ePrisma();
  await cleanupE2eData(prisma);
  fixture = await prepareE2eFixture(prisma);
});

test.afterAll(async () => {
  if (prisma && fixture) {
    try {
      await cleanupE2eData(prisma, {
        runId: fixture.runId,
        tenantId: fixture.tenantId
      });
    } catch (error) {
      console.warn("E2E cleanup failed", error);
    }
  }
  await prisma?.$disconnect();
});

test("admin and voter MVP smoke flow preserves anonymity guardrails", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginAdmin(adminPage);

  const electionId = await createElection(adminPage);
  await expectNoForbiddenText(adminPage);

  await adminPage.goto(`/admin/elections/${electionId}/questions`);
  await adminPage.getByLabel("문항 제목").fill("대표를 선택해 주세요");
  await adminPage.getByLabel("선택지").fill("후보 A\n후보 B");
  await adminPage.getByRole("button", { name: "단일 선택 문항 추가" }).click();
  await expect(adminPage.getByRole("status")).toContainText("문항을 추가했습니다.");

  await adminPage.goto(`/admin/elections/${electionId}/auth-policy`);
  await expect(adminPage.getByText("invite_link_with_identifier")).toBeVisible();
  await expect(adminPage.locator('input[value="email_code"]')).toBeDisabled();
  await expect(adminPage.getByText("기본 비활성 - 상용화/유료/후속 확장 옵션").first()).toBeVisible();

  await adminPage.goto(`/admin/elections/${electionId}/voters`);
  await adminPage
    .getByLabel("명부 입력")
    .fill(`테스트 유권자,${fixture.voterIdentifier},voter-${fixture.runId}@example.test`);
  await adminPage.getByRole("button", { name: "명부 등록/검증" }).click();
  await expect(adminPage.getByRole("status")).toContainText("명부 1건을 등록했습니다.");

  await adminPage.goto(`/admin/elections/${electionId}`);
  await adminPage.getByLabel("검수 요청 사유").fill("E2E 검수 요청");
  await adminPage.getByRole("button", { name: "검수 요청" }).click();
  await expect(adminPage.getByRole("status")).toContainText("검수 요청을 보냈습니다.");
  await adminPage.reload();
  await expect(adminPage.getByText("ReadyForReview").or(adminPage.getByText("검수 대기")).first()).toBeVisible();

  await completeStepUp(adminPage);
  await submitOperation(adminPage, "검수 승인", "E2E 승인");
  await expectElectionState(electionId, "approved");
  await adminPage.reload();
  await expect(adminPage.getByText("Approved").or(adminPage.getByText("승인됨")).first()).toBeVisible();

  await submitOperation(adminPage, "초대 준비", "E2E 초대 준비");
  await submitOperation(adminPage, "예약 상태 전환");
  await expectElectionState(electionId, "scheduled");
  await adminPage.reload();
  await expect(adminPage.getByText("Scheduled").or(adminPage.getByText("예약됨")).first()).toBeVisible();

  await submitOperation(adminPage, "초대 발송", "E2E 초대 발송");
  await submitOperation(adminPage, "투표 시작", "E2E 투표 시작");
  await expectElectionState(electionId, "open");
  await adminPage.reload();
  await expect(adminPage.getByText("Open").or(adminPage.getByText("진행 중")).first()).toBeVisible();
  await expectNoForbiddenText(adminPage, [fixture.inviteToken]);

  await ensureKnownInviteTokenForElection({
    prisma,
    electionId,
    voterIdentifier: fixture.voterIdentifier,
    inviteToken: fixture.inviteToken
  });

  const voterContext = await browser.newContext();
  const voterPage = await voterContext.newPage();
  await voterPage.goto(`/voter/invite?token=${encodeURIComponent(fixture.inviteToken)}`);
  await expect(voterPage).toHaveURL(/\/voter\/identify$/);
  expect(voterPage.url()).not.toContain(fixture.inviteToken);
  await expectNoForbiddenText(voterPage, [fixture.inviteToken]);

  await voterPage.getByLabel("회원번호/사번/학번").fill(fixture.voterIdentifier);
  await voterPage.getByRole("button", { name: "확인" }).click();
  await expect(voterPage).toHaveURL(/\/voter\/election$/);
  await expect(voterPage.getByRole("heading", { name: fixture.electionTitle })).toBeVisible();
  await expect(voterPage.getByText("인증코드가 필요한 투표가 아닙니다")).toHaveCount(0);
  await expectNoForbiddenText(voterPage);

  await voterPage.goto("/voter/results");
  await expect(voterPage.getByRole("heading", { name: "아직 결과를 볼 수 없습니다" })).toBeVisible();

  await voterPage.goto("/voter/ballot");
  await voterPage.getByLabel("후보 A").check();
  await voterPage.getByRole("button", { name: "제출 전 확인" }).click();
  await expect(voterPage).toHaveURL(/\/voter\/review$/);
  await expect(voterPage.getByText("후보 A")).toBeVisible();
  await voterPage.getByRole("button", { name: "제출", exact: true }).click();
  await expect(voterPage).toHaveURL(/\/voter\/complete$/);
  await expect(voterPage.getByText("참여 완료")).toBeVisible();
  await expect(voterPage.getByText("후보 A")).toHaveCount(0);
  await expect(voterPage.getByText("후보 B")).toHaveCount(0);
  await expectNoForbiddenText(voterPage);

  await voterPage.getByRole("link", { name: "마감 전 다시 투표" }).click();
  await expect(voterPage).toHaveURL(/\/voter\/ballot$/);
  await voterPage.getByLabel("후보 B").check();
  await voterPage.getByRole("button", { name: "제출 전 확인" }).click();
  await expect(voterPage.getByText("후보 B")).toBeVisible();
  await voterPage.getByRole("button", { name: "다시 제출" }).click();
  await expect(voterPage).toHaveURL(/\/voter\/complete$/);
  await expect(voterPage.getByText("참여 완료")).toBeVisible();
  await expect(voterPage.getByText("후보 A")).toHaveCount(0);
  await expect(voterPage.getByText("후보 B")).toHaveCount(0);

  await adminPage.goto(`/admin/elections/${electionId}`);
  await submitOperation(adminPage, "종료", "E2E 투표 종료");
  await expectElectionState(electionId, "closed");
  await adminPage.reload();
  await expect(adminPage.getByText("Closed").or(adminPage.getByText("마감")).first()).toBeVisible();

  await adminPage.goto(`/admin/elections/${electionId}/results`);
  await submitOperation(adminPage, "결과 집계");
  await expectElectionState(electionId, "pending_confirmation");
  await adminPage.reload();
  await expect(adminPage.getByText("PendingConfirmation").or(adminPage.getByText("확정 대기")).first()).toBeVisible();
  await submitResultOperation(adminPage, "결과 확정");
  await expectElectionState(electionId, "confirmed");
  await adminPage.reload();
  await expect(adminPage.getByText("Confirmed").or(adminPage.getByText("확정됨")).first()).toBeVisible();
  await submitResultOperation(adminPage, "결과 공개", "E2E 결과 공개 공지");
  await expectElectionState(electionId, "published");
  await adminPage.reload();
  await expect(adminPage.getByText("Published").or(adminPage.getByText("공개됨")).first()).toBeVisible();
  await expectNoForbiddenText(adminPage, [fixture.inviteToken]);

  await voterPage.goto("/voter/results");
  await expect(voterPage.getByRole("heading", { name: "공개된 결과" })).toBeVisible();
  await expect(voterPage.getByText(/표/).first()).toBeVisible();
  await expectNoForbiddenText(voterPage, [fixture.inviteToken]);

  await findElectionByTitle(prisma, fixture.electionTitle);
  await voterContext.close();
  await adminContext.close();
});
