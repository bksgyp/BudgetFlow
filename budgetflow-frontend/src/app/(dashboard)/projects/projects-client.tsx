"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CircleCheck,
  FileSpreadsheet,
  FolderPlus,
  Hash,
  Loader2,
} from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

import {
  PageHeader,
  Panel,
  PriorityStep,
  PriorityStrip,
  ProgressBar,
  SectionToolbar,
  StatusBadge,
} from "@/components/budgetflow-ui";
import { TextInput } from "@/components/form-controls";
import { FormField } from "@/components/form-field";
import { SummaryCard } from "@/components/summary-card";
import {
  DashboardErrorState,
  DashboardLoadingState,
} from "@/components/dashboard-states";
import { Button } from "@/components/ui/button";
import { DEMO_ORGANIZATION_ID } from "@/lib/config/demo";
import type { Project } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  createProjectSchema,
  type CreateProjectInput,
  type CreateProjectValues,
} from "@/lib/forms/project";
import {
  useCreateProject,
  useExpenseSummary,
  useProjects,
} from "@/lib/hooks/use-budgetflow";
import { useSelectedProject } from "@/lib/hooks/use-selected-project";
import { projectExpensesHref } from "@/lib/routes";

const defaultValues: CreateProjectInput = {
  organizationId: DEMO_ORGANIZATION_ID,
  name: "",
  totalBudget: 1_000_000,
  slackChannelName: "",
  templateFileName: "",
};

const PAGE = {
  eyebrow: "Projects",
  title: "사업장 지출·세무 정산 프로젝트",
  lead: "각 프로젝트는 Slack 채널과 1:1로 연결됩니다. 총 예산, 엑셀 양식 상태, 세무 준비 상태를 한 화면에서 확인합니다.",
};

export function ProjectsClient() {
  const { projects, selectedProjectId, setSelectedProjectId, isLoading, isError, refetch } =
    useSelectedProject();

  if (isLoading) {
    return <DashboardLoadingState {...PAGE} />;
  }

  if (isError) {
    return (
      <DashboardErrorState
        eyebrow={PAGE.eyebrow}
        onRetry={refetch}
        title={PAGE.title}
      />
    );
  }

  if (projects.length === 0) {
    return (
      <section className="bf-page-stack">
        <PageHeader
          eyebrow={PAGE.eyebrow}
          lead="아직 연결된 프로젝트가 없습니다. 새 사업/정산 단위를 만들면 지출 수집과 세무 준비가 시작됩니다."
          title={PAGE.title}
        />
        <CreateProjectPanel />
      </section>
    );
  }

  if (!selectedProjectId) {
    return <DashboardLoadingState {...PAGE} />;
  }

  return (
    <ProjectsClientInner
      onSelectProject={setSelectedProjectId}
      projectId={selectedProjectId}
    />
  );
}

function CreateProjectPanel() {
  const createProjectMutation = useCreateProject();
  const form = useForm<CreateProjectInput, undefined, CreateProjectValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await createProjectMutation.mutateAsync(values);
    form.reset(defaultValues);
  });

  return (
    <Panel className="bf-panel-pad" data-tour="create-project">
      <h2 className="bf-panel-title">프로젝트 생성</h2>
      <p className="bf-helper mt-1">
        새 사업/정산 단위명과 Slack 채널을 연결하면 지출 입력이 자동으로 수집됩니다.
      </p>

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <input type="hidden" {...form.register("organizationId")} />
        <FormField label="프로젝트명" error={form.formState.errors.name?.message}>
          <TextInput
            placeholder="예: 2026년 2분기 운영비"
            {...form.register("name")}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Slack 채널"
            error={form.formState.errors.slackChannelName?.message}
          >
            <TextInput
              placeholder="#finance-ops"
              {...form.register("slackChannelName")}
            />
          </FormField>
          <FormField
            label="총 예산"
            error={form.formState.errors.totalBudget?.message}
          >
            <TextInput
              inputMode="numeric"
              step="10000"
              type="number"
              {...form.register("totalBudget")}
            />
          </FormField>
        </div>
        <FormField
          label="엑셀 양식 파일명"
          error={form.formState.errors.templateFileName?.message}
        >
          <TextInput
            placeholder="법인운영비_지출내역서.xlsx"
            {...form.register("templateFileName")}
          />
        </FormField>

        {createProjectMutation.isError ? (
          <p className="text-sm font-medium text-[var(--bf-support-error-fg)]">
            프로젝트 생성에 실패했습니다.
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={createProjectMutation.isPending}>
            {createProjectMutation.isPending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <FolderPlus data-icon="inline-start" />
            )}
            프로젝트 생성
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function ProjectsClientInner({
  onSelectProject,
  projectId,
}: {
  onSelectProject: (projectId: string) => void;
  projectId: string;
}) {
  const projectsQuery = useProjects();
  const summaryQuery = useExpenseSummary(projectId);

  const stats = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    const activeProjects = projects.filter(
      (project) => project.status === "active",
    );
    const confirmedTemplates = projects.filter(
      (project) => project.templateMappingStatus === "confirmed",
    );

    return {
      activeCount: activeProjects.length,
      confirmedTemplates: confirmedTemplates.length,
      totalBudget: activeProjects.reduce(
        (total, project) => total + project.totalBudget,
        0,
      ),
      totalProjects: projects.length,
    };
  }, [projectsQuery.data]);

  return (
    <section className="bf-page-stack">
      <PageHeader
        actions={
          <Button asChild>
            <Link
              href={projectExpensesHref(projectId)}
              onClick={() => onSelectProject(projectId)}
            >
              검토가 필요한 지출 열기
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        }
        eyebrow="Projects"
        lead="각 프로젝트는 Slack 채널과 1:1로 연결됩니다. 총 예산, 엑셀 양식 상태, 세무 준비 상태를 한 화면에서 확인합니다."
        title="사업장 지출·세무 정산 프로젝트"
      />

      <PriorityStrip aria-label="오늘 먼저 볼 프로젝트">
        <PriorityStep
          status="우선 처리"
          title="증빙 누락 지출 확인"
          tone="review"
        >
          {summaryQuery.data?.missingEvidenceCount ?? 0}건의 증빙 없음 항목은
          엑셀 생성 전 보완 요청 또는 반려를 먼저 결정합니다.
        </PriorityStep>
        <PriorityStep
          status="대기"
          title="검토 필요 항목 정리"
          tone="processing"
        >
          {summaryQuery.data?.needsReviewCount ?? 0}건의 낮은 신뢰도 또는 예산
          초과 가능 항목을 검토 패널에서 확인합니다.
        </PriorityStep>
        <PriorityStep
          status="안정"
          title="양식 확정 프로젝트 유지"
          tone="approved"
        >
          매핑 확정 프로젝트는 승인 항목만 모아 제출용 엑셀 파일을 생성할 수
          있습니다.
        </PriorityStep>
      </PriorityStrip>

      <div className="bf-card-grid" aria-label="프로젝트 요약">
        <SummaryCard
          label="활성 프로젝트"
          note="정산 마감 전 프로젝트 기준"
          status={`${stats.totalProjects}개 전체`}
          value={`${stats.activeCount}`}
        />
        <SummaryCard
          label="총 예산"
          note="현재 활성 사업 예산 합계"
          status="KRW"
          value={formatCurrency(stats.totalBudget)}
        />
        <SummaryCard
          label="검토 필요"
          note="증빙 없음 또는 AI 신뢰도 낮음"
          status={`${summaryQuery.data?.needsReviewCount ?? 0}건`}
          tone="warning"
          value={`${summaryQuery.data?.needsReviewCount ?? 0}`}
        />
        <SummaryCard
          label="엑셀 양식"
          note="업로드와 컬럼 매핑 확정 완료 기준"
          status={`${stats.confirmedTemplates}/${stats.totalProjects || 1}`}
          tone="success"
          value={`${Math.round(
            (stats.confirmedTemplates / Math.max(stats.totalProjects, 1)) * 100,
          )}%`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CreateProjectPanel />

        <Panel className="bf-panel-pad">
          <h2 className="bf-panel-title">운영 체크</h2>
          <div className="mt-5 space-y-5">
            {(projectsQuery.data ?? []).slice(0, 3).map((project) => {
              const usage =
                project.status === "closed"
                  ? 100
                  : project.totalBudget > 1_000_000
                    ? 68
                    : 42;
              return (
                <div className="space-y-2" key={project.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <strong className="truncate font-semibold text-[var(--bf-text-primary)]">
                      {project.name}
                    </strong>
                    <span className="bf-money">
                      {formatCurrency(project.totalBudget)}
                    </span>
                  </div>
                  <ProgressBar
                    tone={
                      project.status === "closed"
                        ? "approved"
                        : usage > 75
                          ? "review"
                          : "processing"
                    }
                    value={usage}
                  />
                </div>
              );
            })}
            {projectsQuery.isLoading ? (
              <p className="bf-helper">
                프로젝트 운영 상태를 불러오는 중입니다.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel className="bf-panel-pad">
        <SectionToolbar
          actions={
            <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--bf-text-secondary)]">
              <span className="bf-pulse" />
              Slack 채널 매핑 기준
            </span>
          }
        >
          <h2 className="bf-panel-title">프로젝트 목록</h2>
        </SectionToolbar>

        <div
          className="mt-4 divide-y divide-[var(--bf-border-subtle)]"
          data-tour="projects-list"
        >
          {projectsQuery.isLoading ? (
            <p className="py-5 text-sm text-[var(--bf-text-secondary)]">
              프로젝트를 불러오는 중입니다.
            </p>
          ) : null}

          <div className="hidden grid-cols-[minmax(0,1fr)_180px_120px_120px_96px] gap-3 rounded-md bg-[var(--bf-layer-02)] px-3 py-2 text-xs font-semibold text-[var(--bf-text-secondary)] md:grid">
            <span>프로젝트</span>
            <span>예산 사용 흐름</span>
            <span>양식</span>
            <span>상태</span>
            <span className="text-right">작업</span>
          </div>

          {projectsQuery.data?.map((project) => (
            <ProjectRow
              key={project.id}
              onSelectProject={onSelectProject}
              project={project}
            />
          ))}
        </div>
      </Panel>
    </section>
  );
}

function ProjectRow({
  onSelectProject,
  project,
}: {
  onSelectProject: (projectId: string) => void;
  project: Project;
}) {
  const router = useRouter();
  const isConfirmed = project.templateMappingStatus === "confirmed";
  const usage =
    project.status === "closed"
      ? 100
      : project.totalBudget > 1_000_000
        ? 68
        : 42;
  const expensesHref = projectExpensesHref(project.id);

  const openProjectExpenses = () => {
    onSelectProject(project.id);
    router.push(expensesHref);
  };

  return (
    <article
      aria-label={`${project.name} 지출 화면 열기`}
      className="grid cursor-pointer gap-3 px-3 py-4 outline-none transition-colors hover:bg-[var(--bf-layer-hover)] focus-visible:bg-[var(--bf-layer-hover)] focus-visible:ring-3 focus-visible:ring-ring/50 md:grid-cols-[minmax(0,1fr)_180px_120px_120px_96px] md:items-center"
      onClick={openProjectExpenses}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProjectExpenses();
        }
      }}
      role="link"
      tabIndex={0}
    >
      <div className="min-w-0">
        <strong className="block truncate text-sm font-semibold text-[var(--bf-text-primary)]">
          {project.name}
        </strong>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--bf-text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <Hash className="size-3.5" />
            {project.slackChannelName}
          </span>
          <span>{formatDate(project.createdAt)} 생성</span>
        </p>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-2 text-xs">
          <span className="text-[var(--bf-text-secondary)]">예산</span>
          <span className="bf-money">
            {formatCurrency(project.totalBudget)}
          </span>
        </div>
        <ProgressBar
          tone={
            project.status === "closed"
              ? "approved"
              : usage > 75
                ? "review"
                : "processing"
          }
          value={usage}
        />
      </div>
      <StatusBadge tone={isConfirmed ? "approved" : "processing"}>
        <FileSpreadsheet className="mr-1 size-3" />
        {isConfirmed ? "양식 확정" : "매핑 추천"}
      </StatusBadge>
      <StatusBadge tone={project.status === "active" ? "approved" : "rejected"}>
        {project.status === "active" ? "진행 중" : "마감"}
      </StatusBadge>
      <Button
        asChild
        size="sm"
        variant={project.status === "active" ? "default" : "outline"}
      >
        <Link
          href={isConfirmed ? expensesHref : "/settings"}
          onClick={(event) => {
            event.stopPropagation();
            onSelectProject(project.id);
          }}
        >
          {isConfirmed ? (
            <CircleCheck data-icon="inline-start" />
          ) : (
            <FileSpreadsheet data-icon="inline-start" />
          )}
          {isConfirmed ? "검토 시작" : "매핑 확정"}
        </Link>
      </Button>
    </article>
  );
}
