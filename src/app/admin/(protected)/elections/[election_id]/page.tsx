import Link from "next/link";
import { notFound } from "next/navigation";

import { MetricCard } from "../../../../../components/admin/admin-cards";
import { RequestReviewForm } from "../../../../../components/admin/admin-election-forms";
import { ElectionStateCtaPanel } from "../../../../../components/admin/admin-operation-forms";
import { StepUpPanel } from "../../../../../components/admin/step-up-panel";
import { AnonymousVotingNotice } from "../../../../../components/ui/anonymous-voting-notice";
import { PageHeader } from "../../../../../components/ui/page-header";
import { WarningBanner } from "../../../../../components/ui/warning-banner";
import { ElectionAction, canPerformElectionAction } from "../../../../../domain/elections/actions";
import type { ElectionStateValue } from "../../../../../domain/elections/state-machine";
import { PolicyDecision } from "../../../../../domain/policy-decision";
import { AuthenticationMethod, ElectionState } from "../../../../../guardrails/index.js";
import {
  authMethodLabelMap,
  electionTypeLabelMap,
  labelOf,
  questionTypeLabelMap,
  resultStatusLabelMap
} from "../../../../../lib/ui/election-labels";
import { getCurrentAdminSessionFromCookies } from "../../../../../server/auth/current-admin";
import { getPrismaClient } from "../../../../../server/db/prisma";
import { getAdminElectionDetail } from "../../../../../server/elections/admin-election-view";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}

function isDraftEditPolicyAllowed(state: ElectionStateValue): boolean {
  return [
    ElectionAction.EDIT_ELECTION_INFO,
    ElectionAction.EDIT_QUESTIONS,
    ElectionAction.EDIT_OPTIONS,
    ElectionAction.EDIT_VOTER_REGISTRY
  ].every((action) => canPerformElectionAction(state, action) !== PolicyDecision.DENIED);
}

function ReadinessBadge({ ready }: { ready: boolean }) {
  return (
    <span
      className={[
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      ].join(" ")}
    >
      {ready ? "준비됨" : "확인 필요"}
    </span>
  );
}

export default async function AdminElectionDetailPage({ params }: Params) {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) return null;
  const election = await getAdminElectionDetail(getPrismaClient(), restored.session, (await params).election_id);
  if (!election) notFound();
  const canRequestReview = election.state === ElectionState.DRAFT;
  const canUseExistingDraftEditPages = election.state === ElectionState.DRAFT && isDraftEditPolicyAllowed(election.state);
  const editPolicyAllowed = isDraftEditPolicyAllowed(election.state);
  const optionCount = election.questions.reduce((count, question) => count + question.options.length, 0);
  const authMethod = election.authenticationPolicy?.method ?? AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER;
  const registrySummary = election.voterRegistry
    ? `${election.voterRegistry.validRows}/${election.voterRegistry.totalRows}명 확인 가능`
    : "아직 등록된 선거인 명부가 없습니다.";
  const invitationStatus =
    election.invitationSummary.total > 0
      ? `${election.invitationSummary.total}건 준비, ${election.invitationSummary.sent}건 발송`
      : "아직 준비된 초대가 없습니다.";
  const resultStatus = election.resultSummary.latestResultStatus
    ? labelOf(resultStatusLabelMap, election.resultSummary.latestResultStatus)
    : election.resultSummary.publishedVersionCount > 0
      ? "공개됨"
      : "아직 결과 없음";
  const nonFreeTextQuestions = election.questions.filter((question) => question.questionType !== "free_text");
  const readinessItems = [
    {
      label: "기본 정보",
      ready: Boolean(election.title.trim()),
      help: "투표 제목과 설명을 유권자가 이해할 수 있게 확인합니다.",
      href: `/admin/elections/${election.id}/edit`
    },
    {
      label: "시작/종료 일정",
      ready: election.startsAt instanceof Date && election.endsAt instanceof Date && election.endsAt > election.startsAt,
      help: "시작일시와 종료일시가 올바른 순서인지 확인합니다.",
      href: `/admin/elections/${election.id}/edit`
    },
    {
      label: "문항",
      ready: election.questions.length > 0,
      help: "유권자가 답할 문항이 1개 이상 필요합니다.",
      href: `/admin/elections/${election.id}/edit`
    },
    {
      label: "선택 항목",
      ready: nonFreeTextQuestions.length === 0 || nonFreeTextQuestions.every((question) => question.options.length >= 2),
      help: "선택형 문항은 최소 2개의 선택 항목이 필요합니다.",
      href: `/admin/elections/${election.id}/edit`
    },
    {
      label: "선거인 명부",
      ready: Boolean(election.voterRegistry && election.voterRegistry.validRows > 0),
      help: "투표 대상 선거인이 1명 이상 등록되어야 합니다.",
      href: `/admin/elections/${election.id}/voters`
    },
    {
      label: "투표 참여 인증 방식",
      ready: Boolean(election.authenticationPolicy && election.authenticationPolicy.isEnabled !== false),
      help: "유권자가 투표에 참여할 인증 방식이 활성화되어야 합니다.",
      href: `/admin/elections/${election.id}/edit`
    }
  ];
  const isReadyForReview = readinessItems.every((item) => item.ready);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="투표 상세"
        title={election.title}
        description={election.description ?? undefined}
        status={election.state}
        actions={
          <>
            {canUseExistingDraftEditPages ? (
              <Link
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
                href={`/admin/elections/${election.id}/edit`}
              >
                편집하기
              </Link>
            ) : null}
            <Link
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
              href={`/admin/elections/${election.id}/results`}
            >
              결과 관리
            </Link>
          </>
        }
      />
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="문항 수" value={election.questionCount} hint="유권자가 답해야 할 질문입니다." />
        <MetricCard label="선택 항목 수" value={optionCount} hint="전체 문항에 등록된 선택 항목입니다." />
        <MetricCard label="선거인 수" value={election.eligibleVoterCount} hint="명부에 등록된 투표 대상자입니다." />
        <MetricCard label="초대 상태" value={election.invitationSummary.total > 0 ? "준비됨" : "미준비"} hint={invitationStatus} />
      </section>

      {canUseExistingDraftEditPages ? (
        <WarningBanner title="시작 전 수정 가능">
          투표가 시작되기 전에는 기본 정보, 문항, 선택 항목, 선거인 명부를 확인하고 수정할 수 있습니다. 투표가 시작되면 유권자 보호와 투표 무결성을 위해 수정이 제한됩니다.
        </WarningBanner>
      ) : (
        <WarningBanner title="수정 제한">
          {editPolicyAllowed
            ? "현재 상태에는 사유 기반 수정 정책이 있지만, 통합 편집 마법사는 다음 단계에서 제공합니다. 승인 이후 설정 변경은 운영 절차를 먼저 확인해 주세요."
            : "현재 상태에서는 문항, 선택 항목, 선거인 명부를 수정할 수 없습니다. 진행 중이거나 완료된 투표는 중단, 종료, 결과 절차를 사용합니다."}
        </WarningBanner>
      )}

      {canRequestReview ? (
        <section id="pre-review-summary" className="grid gap-4 rounded-md border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">검수 요청 전 확인할 항목</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                이 요약은 관리자가 빠르게 점검하기 위한 안내입니다. 실제 검수 요청 가능 여부는 서버 검증이
                최종 판단합니다.
              </p>
            </div>
            <span className={[
              "rounded-md px-3 py-1 text-sm font-semibold",
              isReadyForReview ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            ].join(" ")}>
              {isReadyForReview ? "검수 요청 가능" : "확인 필요 항목 있음"}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {readinessItems.map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-950">{item.label}</h3>
                    <ReadinessBadge ready={item.ready} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.help}</p>
                </div>
                {!item.ready ? (
                  <Link className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800" href={item.href}>
                    확인하기
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
          {isReadyForReview ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-900">
              모든 기본 항목이 준비되었습니다. 아래 검수 요청 영역에서 최종 확인 후 검수 요청을 진행할 수 있습니다.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">투표 기본 정보</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="font-semibold text-slate-500">투표 유형</dt><dd>{labelOf(electionTypeLabelMap, election.electionType)}</dd></div>
          <div><dt className="font-semibold text-slate-500">투표 방식</dt><dd>{election.votingMode === "anonymous" ? "익명 투표" : "기명 투표"}</dd></div>
          <div><dt className="font-semibold text-slate-500">시작일시</dt><dd>{formatDateTime(election.startsAt)}</dd></div>
          <div><dt className="font-semibold text-slate-500">종료일시</dt><dd>{formatDateTime(election.endsAt)}</dd></div>
          <div className="md:col-span-2">
            <dt className="font-semibold text-slate-500">설명</dt>
            <dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-700">{election.description || "등록된 설명이 없습니다."}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">투표 참여 인증 방식</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="font-semibold text-slate-500">현재 방식</dt><dd>{labelOf(authMethodLabelMap, authMethod)}</dd></div>
          <div><dt className="font-semibold text-slate-500">인증 상태</dt><dd>{election.authenticationPolicy?.isEnabled === false ? "비활성" : "활성"}</dd></div>
        </dl>
        <p className="text-sm leading-6 text-slate-600">
          기본 방식은 선거인 명부 확인을 거쳐 참여 자격을 확인하는 흐름입니다. 관리자 화면에는 인증용 내부 값이 표시되지 않습니다.
        </p>
      </section>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">문항과 선택 항목</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              유권자에게 표시될 질문과 선택 항목입니다. 사진 첨부는 아직 제공하지 않습니다.
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            선택 항목 {optionCount}개
          </span>
        </div>
        {election.questions.length > 0 ? (
          <div className="grid gap-4">
            {election.questions.map((question, questionIndex) => (
              <section key={question.id} className="rounded-md border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-950">문항 {questionIndex + 1}. {question.title}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {labelOf(questionTypeLabelMap, question.questionType)}
                  </span>
                </div>
                {question.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{question.description}</p>
                ) : null}
                <div className="mt-4 grid gap-2">
                  {question.options.length > 0 ? question.options.map((option, optionIndex) => (
                    <div key={option.id} className="rounded-md bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">선택 항목 {optionIndex + 1}. {option.label}</p>
                      {option.description ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{option.description}</p>
                      ) : (
                        <p className="mt-1 text-sm text-slate-500">등록된 자세한 설명이 없습니다.</p>
                      )}
                    </div>
                  )) : (
                    <p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">아직 선택 항목이 없습니다.</p>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">아직 등록된 문항이 없습니다.</p>
        )}
      </section>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">선거인 명부</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="font-semibold text-slate-500">등록 상태</dt><dd>{registrySummary}</dd></div>
          <div><dt className="font-semibold text-slate-500">수정 제한</dt><dd>{canUseExistingDraftEditPages ? "시작 전 수정 가능" : "현재 상태에서는 수정 제한"}</dd></div>
        </dl>
        <p className="text-sm leading-6 text-slate-600">
          선거인 개인 식별 정보 원문은 상세 화면에 표시하지 않습니다. 명부 확인은 건수와 검증 상태 중심으로만 제공합니다.
        </p>
      </section>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">운영 상태</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="font-semibold text-slate-500">초대 준비/발송</dt><dd>{invitationStatus}</dd></div>
          <div><dt className="font-semibold text-slate-500">결과 상태</dt><dd>{resultStatus}</dd></div>
          <div><dt className="font-semibold text-slate-500">다음에 할 일</dt><dd>{canRequestReview ? "설정을 확인한 뒤 검수 요청을 보낼 수 있습니다." : "아래 상태별 작업 영역에서 가능한 작업만 실행할 수 있습니다."}</dd></div>
          <div><dt className="font-semibold text-slate-500">공개 결과</dt><dd>{election.resultSummary.publishedVersionCount > 0 ? `${election.resultSummary.publishedVersionCount}건 공개 기록 있음` : "아직 공개 기록 없음"}</dd></div>
        </dl>
      </section>

      {canUseExistingDraftEditPages ? (
        <section id="draft-edit-flow" className="grid gap-4 rounded-md border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-base font-semibold">편집하기</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              통합 편집 마법사에서 기본 정보, 문항/선택 항목, 투표 참여 인증 방식을 정리할 수 있습니다.
              선거인 명부 추가 등록은 세부 명부 관리 화면에서 진행합니다.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Link className="rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white" href={`/admin/elections/${election.id}/edit`}>
              통합 편집 마법사
            </Link>
            <Link className="rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800" href={`/admin/elections/${election.id}/questions`}>
              문항/선택 항목 편집
            </Link>
            <Link className="rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800" href={`/admin/elections/${election.id}/voters`}>
              선거인 명부 편집
            </Link>
            <Link className="rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800" href={`/admin/elections/${election.id}/auth-policy`}>
              투표 참여 인증 방식 편집
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-950">검수 요청</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            검수 요청을 보내면 투표 설정을 확정하는 단계로 이동합니다. 검수 이후에는 설정을 수정하려면
            다시 작성 단계로 되돌리는 절차가 필요할 수 있습니다.
          </p>
        </div>
        <RequestReviewForm electionId={election.id} disabled={!canRequestReview} />
      </section>
      {!canRequestReview ? (
        <WarningBanner title="검수 요청 제한">초안 상태에서만 검수 요청을 보낼 수 있습니다.</WarningBanner>
      ) : null}
      <StepUpPanel
        permissionCodes={["election.approve", "election.schedule", "election.open", "election.pause", "election.resume", "election.close", "invitation.send", "invitation.resend"]}
        purpose="투표 상태 전환"
      />
      <ElectionStateCtaPanel electionId={election.id} state={election.state} />
      <AnonymousVotingNotice audience="admin" />
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">설정 바로가기</h2>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" href={`/admin/elections/${election.id}/questions`}>
            문항/선택 항목
          </Link>
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" href={`/admin/elections/${election.id}/voters`}>
            선거인 명부
          </Link>
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" href={`/admin/elections/${election.id}/auth-policy`}>
            투표 참여 인증 방식
          </Link>
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" href={`/admin/elections/${election.id}/results`}>
            결과
          </Link>
        </div>
      </section>
    </div>
  );
}
