import Link from "next/link";
import { notFound } from "next/navigation";

import { MetricCard } from "../../../../../components/admin/admin-cards";
import { DeletePreStartElectionForm } from "../../../../../components/admin/delete-election-form";
import { ElectionStateCtaPanel } from "../../../../../components/admin/admin-operation-forms";
import { StateHistoryTable, type StateHistoryTableRow } from "../../../../../components/admin/state-history-table";
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

const electionStateHistoryLabels: Record<string, string> = {
  cancelled: "투표 취소(무효)",
  opened: "투표 시작",
  paused: "투표 일시중단",
  resumed: "투표 재개",
  closed: "투표 종료"
};

const electionStateHistoryChangeTypes = Object.keys(electionStateHistoryLabels);

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
  const prisma = getPrismaClient();
  const election = await getAdminElectionDetail(prisma, restored.session, (await params).election_id);
  if (!election) notFound();
  const stateHistories = await prisma.electionStateHistory.findMany({
    where: {
      electionId: election.id,
      election: { organizationId: restored.session.organizationId, deletedAt: null },
      changeType: { in: electionStateHistoryChangeTypes }
    },
    orderBy: { changedAt: "asc" },
    select: { changeType: true, changedAt: true }
  });
  const stateHistoryRows: StateHistoryTableRow[] = stateHistories.map((history) => ({
    label: electionStateHistoryLabels[history.changeType] ?? history.changeType,
    changedAt: history.changedAt
  }));
  const preStartStates = new Set<ElectionStateValue>([
    ElectionState.DRAFT,
    ElectionState.READY_FOR_REVIEW,
    ElectionState.APPROVED,
    ElectionState.SCHEDULED,
    ElectionState.NOTICE
  ]);
  const currentTime = new Date();
  const canDelete = preStartStates.has(election.state) && election.startsAt > currentTime;
  const canCancel = preStartStates.has(election.state) && election.startsAt <= currentTime;
  const canUseExistingDraftEditPages = election.state === ElectionState.DRAFT && isDraftEditPolicyAllowed(election.state);
  const editPolicyAllowed = isDraftEditPolicyAllowed(election.state);
  const optionCount = election.questions.reduce((count, question) => count + question.options.length, 0);
  const authMethod = election.authenticationPolicy?.method ?? AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER;
  const registrySummary = election.voterRegistry
    ? `${election.voterRegistry.validRows}/${election.voterRegistry.totalRows}명 확인 가능`
    : "아직 등록된 선거인 명부가 없습니다.";
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
      href: election.voterRegistry?.managedRegistryId
        ? `/admin/voter-registries/${election.voterRegistry.managedRegistryId}`
        : `/admin/elections/${election.id}/voters`
    }
  ];
  const isReadyToStart = readinessItems.every((item) => item.ready);

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
                className="ui-primary-button"
                href={`/admin/elections/${election.id}/edit`}
              >
                편집하기
              </Link>
            ) : null}
            <Link
              className="ui-secondary-button"
              href={`/admin/elections/${election.id}/results`}
            >
              결과 관리
            </Link>
            {canDelete ? (
              <DeletePreStartElectionForm electionId={election.id} title={election.title} />
            ) : null}
          </>
        }
      />
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="문항 수" value={election.questionCount} hint="유권자가 답해야 할 질문입니다." />
        <MetricCard label="선택 항목 수" value={optionCount} hint="전체 문항에 등록된 선택 항목입니다." />
        <MetricCard label="선거인 수" value={election.eligibleVoterCount} hint="명부에 등록된 투표 대상자입니다." />
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

      {preStartStates.has(election.state) ? (
        <section id="pre-start-summary" className="ui-card grid gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink">투표 시작 전 확인할 항목</h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                이 요약은 관리자가 바로 투표를 시작하기 전에 확인할 항목입니다. 시작 버튼을 누르면 시작일시가 현재 시각으로 갱신되고 투표가 진행 상태로 전환됩니다.
              </p>
            </div>
            <span className={[
              "rounded-md px-3 py-1 text-sm font-semibold",
              isReadyToStart ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            ].join(" ")}>
              {isReadyToStart ? "시작 가능" : "확인 필요 항목 있음"}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {readinessItems.map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-ink">{item.label}</h3>
                    <ReadinessBadge ready={item.ready} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">{item.help}</p>
                </div>
                {!item.ready ? (
                  <Link className="ui-secondary-button min-h-[38px] shrink-0 px-3 py-2 text-xs" href={item.href}>
                    확인하기
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
          {isReadyToStart ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-900">
              모든 기본 항목이 준비되었습니다. 아래 운영 CTA에서 바로 투표를 시작할 수 있습니다.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="ui-card grid gap-3 p-5">
        <h2 className="text-base font-bold text-ink">투표 기본 정보</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="font-bold text-ink-faint">투표 유형</dt><dd>{labelOf(electionTypeLabelMap, election.electionType)}</dd></div>
          <div><dt className="font-bold text-ink-faint">투표 방식</dt><dd>{election.votingMode === "anonymous" ? "익명 투표" : "기명 투표"}</dd></div>
          <div><dt className="font-bold text-ink-faint">시작일시</dt><dd>{formatDateTime(election.startsAt)}</dd></div>
          <div><dt className="font-bold text-ink-faint">종료일시</dt><dd>{formatDateTime(election.endsAt)}</dd></div>
          <div className="md:col-span-2">
            <dt className="font-bold text-ink-faint">설명</dt>
            <dd className="mt-1 whitespace-pre-wrap leading-6 text-ink-body">{election.description || "등록된 설명이 없습니다."}</dd>
          </div>
        </dl>
      </section>

      <section className="ui-card grid gap-3 p-5">
        <h2 className="text-base font-bold text-ink">투표 참여 인증 방식</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="font-semibold text-slate-500">현재 방식</dt><dd>{labelOf(authMethodLabelMap, authMethod)}</dd></div>
          <div><dt className="font-semibold text-slate-500">인증 상태</dt><dd>{election.authenticationPolicy?.isEnabled === false ? "비활성" : "활성"}</dd></div>
        </dl>
        <p className="text-sm leading-6 text-ink-muted">
          기본 방식은 선거인 명부 확인을 거쳐 참여 자격을 확인하는 흐름입니다. 관리자 화면에는 인증용 내부 값이 표시되지 않습니다.
        </p>
      </section>

      <section className="ui-card grid gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">문항과 선택 항목</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              유권자에게 표시될 질문과 선택 항목입니다. 사진 첨부는 아직 제공하지 않습니다.
            </p>
          </div>
          <span className="rounded-lg bg-brand-50 px-3 py-1 text-sm font-bold text-brand-600">
            선택 항목 {optionCount}개
          </span>
        </div>
        {election.questions.length > 0 ? (
          <div className="grid gap-4">
            {election.questions.map((question, questionIndex) => (
              <section key={question.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-ink">문항 {questionIndex + 1}. {question.title}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {labelOf(questionTypeLabelMap, question.questionType)}
                  </span>
                </div>
                {question.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{question.description}</p>
                ) : null}
                <div className="mt-4 grid gap-2">
                  {question.options.length > 0 ? question.options.map((option, optionIndex) => (
                    <div key={option.id} className="rounded-xl bg-surface px-4 py-3">
                      <p className="text-sm font-bold text-ink">선택 항목 {optionIndex + 1}. {option.label}</p>
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

      <section className="ui-card grid gap-3 p-5">
        <h2 className="text-base font-bold text-ink">선거인 명부</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="font-semibold text-slate-500">등록 상태</dt><dd>{registrySummary}</dd></div>
          <div><dt className="font-semibold text-slate-500">수정 제한</dt><dd>{canUseExistingDraftEditPages ? "시작 전 수정 가능" : "현재 상태에서는 수정 제한"}</dd></div>
        </dl>
        <p className="text-sm leading-6 text-slate-600">
          선거인 개인 식별 정보 원문은 상세 화면에 표시하지 않습니다. 명부 확인은 건수와 검증 상태 중심으로만 제공합니다.
        </p>
      </section>

      <section className="ui-card grid gap-3 p-5">
        <h2 className="text-base font-bold text-ink">운영 상태</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="font-semibold text-slate-500">결과 상태</dt><dd>{resultStatus}</dd></div>
          <div><dt className="font-semibold text-slate-500">다음에 할 일</dt><dd>{preStartStates.has(election.state) ? "설정을 확인한 뒤 바로 투표를 시작할 수 있습니다." : "아래 상태별 작업 영역에서 가능한 작업만 실행할 수 있습니다."}</dd></div>
          <div><dt className="font-semibold text-slate-500">공개 결과</dt><dd>{election.resultSummary.publishedVersionCount > 0 ? `${election.resultSummary.publishedVersionCount}건 공개 기록 있음` : "아직 공개 기록 없음"}</dd></div>
        </dl>
      </section>

      {canUseExistingDraftEditPages ? (
        <section id="draft-edit-flow" className="ui-card grid gap-4 p-5">
          <div>
            <h2 className="text-base font-semibold">편집하기</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              통합 편집 마법사에서 기본 정보와 문항/선택 항목을 정리할 수 있습니다.
              선거인 명부 추가 등록은 연결된 독립 명부 관리 화면에서 진행합니다.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link className="rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white" href={`/admin/elections/${election.id}/edit`}>
              통합 편집 마법사
            </Link>
            <Link
              className="rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800"
              href={election.voterRegistry?.managedRegistryId ? `/admin/voter-registries/${election.voterRegistry.managedRegistryId}` : `/admin/elections/${election.id}/voters`}
            >
              선거인 명부 편집
            </Link>
          </div>
        </section>
      ) : null}

      <ElectionStateCtaPanel electionId={election.id} state={election.state} canCancel={canCancel} />
      <StateHistoryTable
        title="투표 상태 변경 이력"
        rows={stateHistoryRows}
        emptyMessage="표시할 투표 상태 변경 이력이 없습니다."
      />
      <AnonymousVotingNotice audience="admin" />
      <section className="ui-card grid gap-3 p-5">
        <h2 className="text-base font-bold text-ink">설정 바로가기</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
            href={election.voterRegistry?.managedRegistryId ? `/admin/voter-registries/${election.voterRegistry.managedRegistryId}` : `/admin/elections/${election.id}/voters`}
          >
            선거인 명부
          </Link>
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" href={`/admin/elections/${election.id}/results`}>
            결과
          </Link>
        </div>
      </section>
    </div>
  );
}
