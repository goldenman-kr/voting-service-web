import Link from "next/link";
import { notFound } from "next/navigation";

import {
  EditElectionBasicInfoForm,
  EditElectionQuestionsAndOptionsForm
} from "../../../../../../components/admin/admin-election-forms";
import { EmptyState } from "../../../../../../components/ui/empty-state";
import { PageHeader } from "../../../../../../components/ui/page-header";
import { WarningBanner } from "../../../../../../components/ui/warning-banner";
import { ElectionState } from "../../../../../../guardrails/index.js";
import { formatDateTimeLocalKst } from "../../../../../../lib/kst-datetime";
import { electionTypeLabelMap, labelOf } from "../../../../../../lib/ui/election-labels";
import { getCurrentAdminSessionFromCookies } from "../../../../../../server/auth/current-admin";
import { getPrismaClient } from "../../../../../../server/db/prisma";
import { getAdminElectionDetail } from "../../../../../../server/elections/admin-election-view";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

export default async function AdminElectionEditPage({ params }: Params) {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) return null;

  const electionId = (await params).election_id;
  const election = await getAdminElectionDetail(getPrismaClient(), restored.session, electionId);
  if (!election) notFound();

  const isDraft = election.state === ElectionState.DRAFT;
  const hasNotStarted = election.startsAt > new Date();
  const showEditForm = isDraft && hasNotStarted;
  const optionCount = election.questions.reduce((total, question) => total + question.options.length, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="투표 편집"
        title={`${election.title} 편집`}
        description="통합 편집 마법사입니다. 초안 상태의 시작 전 투표에 한해 기본 정보와 문항/선택 항목 문구를 보수적으로 수정합니다."
        status={election.state}
        actions={
          <Link
            href={`/admin/elections/${election.id}`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
          >
            상세 화면으로 돌아가기
          </Link>
        }
      />

      <ol className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm sm:grid-cols-3">
        <li className="rounded-md border border-blue-600 bg-blue-50 px-3 py-2 font-semibold text-blue-900">
          1 기본 정보
        </li>
        <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-600">
          2 문항/선택 항목
        </li>
        <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-600">
          3 선거인 명부/인증 방식
        </li>
      </ol>

      {!showEditForm ? (
        <WarningBanner title="통합 편집 제한">
          이 투표는 이미 검수 또는 진행 단계에 있어 통합 편집을 사용할 수 없습니다. 투표 무결성을 위해
          시작 이후에는 문항, 선택 항목, 선거인 명부 수정이 제한됩니다.
        </WarningBanner>
      ) : (
        <WarningBanner title="이번 단계의 수정 범위">
          기본 정보와 문항/선택 항목 문구를 저장할 수 있습니다. 선택 항목 추가는 append-only로만 제공하며
          선거인 명부는 요약과 기존 명부 관리 화면 링크만 제공합니다.
        </WarningBanner>
      )}

      {showEditForm ? (
        <EditElectionBasicInfoForm
          initial={{
            electionId: election.id,
            title: election.title,
            description: election.description,
            electionType: election.electionType,
            startsAt: formatDateTimeLocalKst(election.startsAt),
            endsAt: formatDateTimeLocalKst(election.endsAt)
          }}
        />
      ) : (
        <EmptyState
          title="편집할 수 없는 상태입니다"
          description="초안 상태이며 시작일시가 지나지 않은 투표만 통합 편집 화면에서 수정할 수 있습니다."
          action={
            <Link
              href={`/admin/elections/${election.id}`}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
            >
              상세 화면으로 돌아가기
            </Link>
          }
        />
      )}

      {showEditForm ? (
        <EditElectionQuestionsAndOptionsForm
          initial={{
            electionId: election.id,
            questions: election.questions
          }}
        />
      ) : (
        <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-950">2 문항/선택 항목</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              현재 상태에서는 직접 수정하지 않습니다. 질문과 선택 항목은 현재 등록된 내용을 요약해 보여줍니다.
            </p>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="font-semibold text-slate-500">문항 수</dt><dd>{election.questionCount}</dd></div>
            <div><dt className="font-semibold text-slate-500">선택 항목 수</dt><dd>{optionCount}</dd></div>
            <div><dt className="font-semibold text-slate-500">투표 유형</dt><dd>{labelOf(electionTypeLabelMap, election.electionType)}</dd></div>
          </dl>
        </section>
      )}

      {showEditForm ? (
        <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-950">3 선거인 명부</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              현재 투표 참여 인증 방식은 고정되어 있습니다. 선거인 명부 연결 상태만 확인하고, 명부 관리는 세부 화면에서 진행합니다.
            </p>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-500">선거인 명부</dt>
              <dd>
                {election.voterRegistry
                  ? `${election.voterRegistry.validRows}/${election.voterRegistry.totalRows}명 확인 가능`
                  : "아직 등록된 선거인 명부가 없습니다."}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">투표 참여 인증 방식</dt>
              <dd>{election.authenticationPolicy?.isEnabled === false ? "비활성" : "이름, 호수, 식별번호, 생년월일 확인"}</dd>
            </div>
          </dl>
          <Link
            href={election.voterRegistry?.managedRegistryId ? `/admin/voter-registries/${election.voterRegistry.managedRegistryId}` : `/admin/elections/${election.id}/voters`}
            className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
          >
            선거인 명부 세부 화면으로 이동
          </Link>
        </section>
      ) : (
        <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-950">3 선거인 명부/인증 방식</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              명부 교체는 아래 읽기 전용 단계에서 현재 연결 상태를 확인한 뒤 별도 세부 화면에서 처리합니다.
            </p>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-500">선거인 명부</dt>
              <dd>
                {election.voterRegistry
                  ? `${election.voterRegistry.validRows}/${election.voterRegistry.totalRows}명 확인 가능`
                  : "아직 등록된 선거인 명부가 없습니다."}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">투표 참여 인증 방식</dt>
              <dd>{election.authenticationPolicy?.isEnabled === false ? "비활성" : "초대 링크 + 선거인 확인"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Link
              href={election.voterRegistry?.managedRegistryId ? `/admin/voter-registries/${election.voterRegistry.managedRegistryId}` : `/admin/elections/${election.id}/voters`}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
            >
              선거인 명부 세부 화면으로 이동
            </Link>
          </div>
        </section>
      )}

      {showEditForm ? (
        <section className="grid gap-4 rounded-md border border-emerald-200 bg-emerald-50 p-5">
          <div>
            <h2 className="text-base font-semibold text-emerald-950">투표 시작 전 최종 확인</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              변경사항이 저장되면 투표를 시작하기 전에 상세 화면에서 제목, 일정, 문항, 선택 항목,
              선거인 명부를 다시 확인해 주세요. 모든 항목이 준비되면 상세 화면에서 바로 투표를 시작할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/elections/${election.id}`}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              상세 화면으로 돌아가기
            </Link>
            <Link
              href={`/admin/elections/${election.id}#pre-start-summary`}
              className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900"
            >
              투표 시작 전 최종 확인
            </Link>
            <Link
              href={election.voterRegistry?.managedRegistryId ? `/admin/voter-registries/${election.voterRegistry.managedRegistryId}` : `/admin/elections/${election.id}/voters`}
              className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900"
            >
              선거인 명부 관리
            </Link>
          </div>
          <p className="text-sm leading-6 text-emerald-900">
            현재 통합 편집 화면은 작성 중 상태의 시작 전 투표에서만 동작합니다. 질문/선택 항목 삭제, 순서 변경,
            사용된 명부 직접 수정, 사진 업로드는 결과 의미와 개인정보 보관 범위에 영향을 주므로 여기서 제공하지 않습니다.
          </p>
        </section>
      ) : null}
    </div>
  );
}
