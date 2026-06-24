"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Save, Upload } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  PageHeader,
  Panel,
  ProgressBar,
  SectionToolbar,
  StatusBadge,
} from "@/components/budgetflow-ui";
import { TextArea, TextInput } from "@/components/form-controls";
import { FormField } from "@/components/form-field";
import { SummaryCard } from "@/components/summary-card";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingState,
} from "@/components/dashboard-states";
import { Button } from "@/components/ui/button";
import type {
  BudgetCategory,
  Project,
  TemplateUploadResult,
} from "@/lib/domain";
import {
  budgetCategoryFormSchema,
  parseKeywordsText,
  type BudgetCategoryFormInput,
  type BudgetCategoryFormValues,
} from "@/lib/forms/budget-category";
import { formatCurrency } from "@/lib/formatters";
import {
  useBudgetCategories,
  useConfirmTemplateMapping,
  useCreateBudgetCategory,
  useProject,
  useUploadProjectTemplate,
  useUpdateBudgetCategory,
} from "@/lib/hooks/use-budgetflow";
import { useSelectedProject } from "@/lib/hooks/use-selected-project";

const defaultValues: BudgetCategoryFormInput = {
  budgetLimit: 100_000,
  keywordsText: "",
  name: "",
};

const reviewPolicies = [
  "AI 신뢰도 낮음",
  "예산 초과 가능",
  "영수증 없음",
  "필수 필드 누락",
  "OCR 실패",
] as const;

const settingsTabs = [
  { id: "template", label: "엑셀 양식" },
  { id: "categories", label: "예산 카테고리" },
  { id: "keywords", label: "분류 키워드" },
] as const;

type SettingsTab = (typeof settingsTabs)[number]["id"];

export function SettingsClient() {
  const { selectedProjectId, isLoading, isError, refetch } = useSelectedProject();

  if (selectedProjectId) {
    return <SettingsClientInner projectId={selectedProjectId} />;
  }

  if (isLoading) {
    return (
      <DashboardLoadingState
        eyebrow="Settings"
        lead="엑셀 양식, 컬럼 매핑, 예산 카테고리를 불러오는 중입니다."
        title="엑셀 양식, 컬럼 매핑, 예산 카테고리"
      />
    );
  }

  if (isError) {
    return (
      <DashboardErrorState
        eyebrow="Settings"
        onRetry={refetch}
        title="엑셀 양식, 컬럼 매핑, 예산 카테고리"
      />
    );
  }

  return (
    <DashboardEmptyState
      action={
        <Button asChild>
          <Link href="/projects">프로젝트 만들기</Link>
        </Button>
      }
      eyebrow="Settings"
      lead="설정을 변경하려면 먼저 프로젝트가 필요합니다."
      title="엑셀 양식, 컬럼 매핑, 예산 카테고리"
    >
      선택된 프로젝트가 없습니다. 프로젝트를 만들거나 사이드바에서 프로젝트를
      선택하세요.
    </DashboardEmptyState>
  );
}

function SettingsClientInner({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("template");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const projectQuery = useProject(projectId);
  const categoriesQuery = useBudgetCategories(projectId);
  const createCategory = useCreateBudgetCategory(projectId);
  const updateCategory = useUpdateBudgetCategory(projectId);
  const selectedCategory = useMemo(
    () =>
      categoriesQuery.data?.find(
        (category) => category.id === selectedCategoryId,
      ) ?? null,
    [categoriesQuery.data, selectedCategoryId],
  );
  const form = useForm<
    BudgetCategoryFormInput,
    undefined,
    BudgetCategoryFormValues
  >({
    resolver: zodResolver(budgetCategoryFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!selectedCategory) {
      form.reset(defaultValues);
      return;
    }

    form.reset({
      budgetLimit: selectedCategory.budgetLimit,
      keywordsText: selectedCategory.keywords.join(", "),
      name: selectedCategory.name,
    });
  }, [form, selectedCategory]);

  const isMutating = createCategory.isPending || updateCategory.isPending;
  const totals = useMemo(
    () =>
      categoriesQuery.data?.reduce(
        (accumulator, category) => ({
          approvedAmount: accumulator.approvedAmount + category.approvedAmount,
          budgetLimit: accumulator.budgetLimit + category.budgetLimit,
        }),
        { approvedAmount: 0, budgetLimit: 0 },
      ) ?? { approvedAmount: 0, budgetLimit: 0 },
    [categoriesQuery.data],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    const keywords = parseKeywordsText(values.keywordsText);

    if (selectedCategory) {
      await updateCategory.mutateAsync({
        budgetLimit: values.budgetLimit,
        categoryId: selectedCategory.id,
        keywords,
        name: values.name,
      });
    } else {
      await createCategory.mutateAsync({
        budgetLimit: values.budgetLimit,
        keywords,
        name: values.name,
        projectId,
      });
    }

    setSelectedCategoryId(null);
    form.reset(defaultValues);
  });

  return (
    <section className="bf-page-stack">
      <PageHeader
        eyebrow="Settings"
        lead="양식 업로드·컬럼 매핑·예산 카테고리를 한 곳에서 관리합니다."
        title="엑셀 양식, 컬럼 매핑, 예산 카테고리"
      />

      <Panel className="p-1">
        <div
          className="grid gap-1 sm:grid-cols-3"
          role="tablist"
          aria-label="설정 범주"
        >
          {settingsTabs.map((tab, index) => (
            <button
              aria-controls={`settings-panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              className={
                activeTab === tab.id
                  ? "h-10 rounded-lg bg-[var(--bf-text-primary)] px-3 text-sm font-semibold text-white shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50"
                  : "h-10 rounded-lg px-3 text-sm font-semibold text-[var(--bf-text-secondary)] hover:bg-[var(--bf-layer-hover)] hover:text-[var(--bf-text-primary)] focus-visible:ring-3 focus-visible:ring-ring/50"
              }
              id={`settings-tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => {
                const last = settingsTabs.length - 1;
                let next = index;
                if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
                else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = last;
                else return;
                event.preventDefault();
                const nextTab = settingsTabs[next];
                setActiveTab(nextTab.id);
                document.getElementById(`settings-tab-${nextTab.id}`)?.focus();
              }}
              role="tab"
              tabIndex={activeTab === tab.id ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div
          aria-labelledby={`settings-tab-${activeTab}`}
          className="space-y-4"
          id={`settings-panel-${activeTab}`}
          role="tabpanel"
          tabIndex={0}
        >
          {activeTab === "template" ? (
            <TemplateUploadPanel
              project={projectQuery.data ?? null}
              projectId={projectId}
            />
          ) : null}

          {activeTab === "categories" ? (
            <>
              <Panel className="bf-panel-pad">
                <SectionToolbar>
                  <div>
                    <h2 className="bf-panel-title">
                      예산 카테고리와 한도
                    </h2>
                    <p className="bf-helper mt-1">
                      카테고리 한도와 키워드는 AI 분류 기준으로 백엔드에
                      전달됩니다.
                    </p>
                  </div>
                </SectionToolbar>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <SummaryCard
                    label="카테고리 예산"
                    value={formatCurrency(totals.budgetLimit)}
                  />
                  <SummaryCard
                    label="승인 사용액"
                    tone="success"
                    value={formatCurrency(totals.approvedAmount)}
                  />
                </div>

                <div className="mt-4 divide-y divide-[var(--bf-border-subtle)]">
                  {categoriesQuery.isLoading ? (
                    <p className="py-5 text-sm text-[var(--bf-text-secondary)]">
                      카테고리를 불러오는 중입니다.
                    </p>
                  ) : null}

                  {categoriesQuery.data?.map((category) => (
                    <CategoryRow
                      category={category}
                      isSelected={category.id === selectedCategoryId}
                      key={category.id}
                      onEdit={() => setSelectedCategoryId(category.id)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel className="bf-panel-pad">
                <SectionToolbar
                  actions={
                    <Button
                      onClick={() => setSelectedCategoryId(null)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Plus data-icon="inline-start" />새 항목
                    </Button>
                  }
                >
                  <h2 className="bf-panel-title">
                    {selectedCategory ? "카테고리 수정" : "카테고리 추가"}
                  </h2>
                  <p className="bf-helper mt-1">
                    쉼표로 분류 키워드를 입력합니다.
                  </p>
                </SectionToolbar>

                <form className="mt-5 space-y-4" onSubmit={onSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="카테고리명"
                      error={form.formState.errors.name?.message}
                    >
                      <TextInput
                        placeholder="예: 여비교통비"
                        {...form.register("name")}
                      />
                    </FormField>
                    <FormField
                      label="예산 한도"
                      error={form.formState.errors.budgetLimit?.message}
                    >
                      <TextInput
                        inputMode="numeric"
                        step="10000"
                        type="number"
                        {...form.register("budgetLimit")}
                      />
                    </FormField>
                  </div>
                  <FormField
                    label="분류 키워드"
                    error={form.formState.errors.keywordsText?.message}
                  >
                    <TextArea
                      placeholder="예: 택시, 주유, 출장, KTX"
                      {...form.register("keywordsText")}
                    />
                  </FormField>
                  <div className="flex justify-end">
                    <Button disabled={isMutating} type="submit">
                      {isMutating ? (
                        <Loader2
                          className="animate-spin"
                          data-icon="inline-start"
                        />
                      ) : selectedCategory ? (
                        <Save data-icon="inline-start" />
                      ) : (
                        <Plus data-icon="inline-start" />
                      )}
                      {selectedCategory ? "수정 저장" : "추가"}
                    </Button>
                  </div>
                </form>
              </Panel>
            </>
          ) : null}

          {activeTab === "keywords" ? (
            <Panel className="bf-panel-pad">
              <SectionToolbar>
                <div>
                  <h2 className="bf-panel-title">
                    분류 키워드
                  </h2>
                  <p className="bf-helper mt-1">
                    예산 카테고리별 키워드는 Slack 입력을 자동 분류하는
                    기준입니다.
                  </p>
                </div>
              </SectionToolbar>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(categoriesQuery.data ?? []).map((category) => (
                  <div
                    className="rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] px-3 py-3"
                    key={category.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm font-semibold text-[var(--bf-text-primary)]">
                        {category.name}
                      </strong>
                      <StatusBadge
                        tone={
                          category.remainingAmount < 0 ? "missing" : "approved"
                        }
                      >
                        {category.remainingAmount < 0 ? "초과" : "사용 가능"}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--bf-text-secondary)]">
                      {category.keywords.join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Panel className="bf-panel-pad">
            <h2 className="bf-panel-title">검토 필요 정책</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {reviewPolicies.map((policy) => (
                <StatusBadge
                  key={policy}
                  tone={policy === "영수증 없음" ? "missing" : "review"}
                >
                  {policy}
                </StatusBadge>
              ))}
            </div>
          </Panel>

          <Panel className="bf-panel-pad">
            <h2 className="bf-panel-title">
              엑셀 생성 전 확인
            </h2>
            <div className="mt-4 space-y-3">
              {[
                "카테고리별 한도와 승인 사용액을 확인합니다.",
                "추천 컬럼은 관리자가 확정한 뒤 사용합니다.",
                "검토 필요 항목은 생성 파일에서 제외된다는 경고를 확인합니다.",
              ].map((item) => (
                <p
                  className="rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] px-3 py-2 text-sm leading-6 text-[var(--bf-text-secondary)]"
                  key={item}
                >
                  {item}
                </p>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
    </section>
  );
}

function TemplateUploadPanel({
  project,
  projectId,
}: {
  project: Project | null;
  projectId: string;
}) {
  const [fileName, setFileName] = useState("");
  const [uploadResult, setUploadResult] = useState<TemplateUploadResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const uploadTemplate = useUploadProjectTemplate(projectId);
  const confirmMapping = useConfirmTemplateMapping(projectId);
  const isPending = uploadTemplate.isPending || confirmMapping.isPending;

  const visibleMappings = uploadResult?.mappings ?? [
    {
      confirmed: true,
      confidence: 0.95,
      sourceColumn: "거래일자",
      targetField: "transactionDate" as const,
    },
    {
      confirmed: true,
      confidence: 0.91,
      sourceColumn: "거래처",
      targetField: "vendorName" as const,
    },
    {
      confirmed: false,
      confidence: 0.84,
      sourceColumn: "공급가액",
      targetField: "supplyAmount" as const,
    },
    {
      confirmed: false,
      confidence: 0.8,
      sourceColumn: "부가세",
      targetField: "vatAmount" as const,
    },
  ];

  const onUpload = async () => {
    setError(null);

    if (!fileName) {
      setError("업로드할 엑셀 파일을 선택하세요.");
      return;
    }

    try {
      const result = await uploadTemplate.mutateAsync({
        fileName,
        projectId,
      });
      setUploadResult(result);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "양식 업로드에 실패했습니다.",
      );
    }
  };

  const onConfirmMapping = async () => {
    if (!uploadResult) {
      return;
    }

    const result = await confirmMapping.mutateAsync({
      mappings: uploadResult.mappings,
      projectId,
    });
    setUploadResult(result);
  };

  const mappingStatus =
    uploadResult?.mappingStatus ?? project?.templateMappingStatus;

  return (
    <Panel className="bf-panel-pad" id="template-upload">
      <SectionToolbar
        actions={
          <div className="flex flex-col gap-2 sm:min-w-80">
            <label className="flex h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] px-3 text-sm hover:bg-[var(--bf-layer-hover)] sm:h-10">
              <span className="truncate text-[var(--bf-text-secondary)]">
                {fileName || "엑셀 파일을 선택하세요"}
              </span>
              <span className="shrink-0 rounded-md bg-[var(--bf-layer-selected)] px-2 py-1 text-xs font-semibold text-[var(--bf-primary-active)]">
                파일 선택
              </span>
              <input
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={(event) =>
                  setFileName(event.target.files?.[0]?.name ?? "")
                }
                type="file"
              />
            </label>
            <Button
              className="w-full"
              disabled={isPending}
              onClick={() => void onUpload()}
              type="button"
            >
              {uploadTemplate.isPending ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Upload data-icon="inline-start" />
              )}
              업로드 및 매핑 추천
            </Button>
          </div>
        }
      >
        <h2 className="bf-panel-title">엑셀 양식 업로드</h2>
        <p className="bf-helper mt-1">
          {project?.templateFileName ?? "양식 파일 미등록"} ·{" "}
          {templateMappingStatusLabel(mappingStatus)}
        </p>
        <p className="mt-3 rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] px-3 py-2 text-sm leading-6 text-[var(--bf-text-secondary)]">
          양식 파일과 컬럼 매핑이 모두 확정되어야 제출용 엑셀 생성 버튼이
          명확하게 활성화됩니다.
        </p>
      </SectionToolbar>

      {error ? (
        <p className="mt-3 text-sm font-medium text-[var(--bf-support-error-fg)]">{error}</p>
      ) : null}

      <div className="mt-5">
        <SectionToolbar
          actions={
            <Button
              disabled={
                isPending ||
                !uploadResult ||
                uploadResult.mappingStatus === "confirmed"
              }
              onClick={() => void onConfirmMapping()}
              type="button"
            >
              {confirmMapping.isPending ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              추천 매핑 확정
            </Button>
          }
        >
          <h3 className="bf-section-title">LLM 컬럼 매핑 추천</h3>
          <p className="bf-helper mt-1">
            추천값은 관리자 확정 전까지 제출용 엑셀 생성에 사용하지 않습니다.
          </p>
        </SectionToolbar>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {visibleMappings.map((mapping) => (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] px-3 py-2 text-sm"
              key={`${mapping.sourceColumn}-${mapping.targetField}`}
            >
              <span className="min-w-0">
                <span className="block truncate">
                  {mapping.sourceColumn} →{" "}
                  {templateFieldLabel[mapping.targetField]}
                </span>
                <span className="mt-1 block text-xs text-[var(--bf-text-secondary)]">
                  추천 신뢰도 {Math.round(mapping.confidence * 100)}%
                </span>
              </span>
              <StatusBadge tone={mapping.confirmed ? "approved" : "processing"}>
                {mapping.confirmed ? "확정됨" : "추천됨"}
              </StatusBadge>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function CategoryRow({
  category,
  isSelected,
  onEdit,
}: {
  category: BudgetCategory;
  isSelected: boolean;
  onEdit: () => void;
}) {
  const usageWidth = Math.min(100, Math.max(0, category.usageRate));
  const isOverBudget = category.remainingAmount < 0;
  const tone = isOverBudget
    ? "missing"
    : usageWidth >= 80
      ? "review"
      : "approved";

  return (
    <article className={isSelected ? "rounded-lg bg-[var(--bf-layer-hover)] px-3 py-4" : "py-4"}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="bf-section-title">{category.name}</h3>
            <StatusBadge tone={tone}>
              {isOverBudget ? "초과" : usageWidth >= 80 ? "주의" : "정상"}
            </StatusBadge>
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--bf-text-secondary)]">
            {category.keywords.join(", ")}
          </p>
        </div>
        <Button onClick={onEdit} size="sm" variant="outline">
          <Pencil data-icon="inline-start" />
          수정
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span className="font-semibold text-[var(--bf-text-primary)]">
            {formatCurrency(category.approvedAmount)} /{" "}
            {formatCurrency(category.budgetLimit)}
          </span>
          <span
            className={
              isOverBudget ? "font-semibold text-[var(--bf-support-error-fg)]" : "font-semibold"
            }
          >
            잔액 {formatCurrency(category.remainingAmount)}
          </span>
        </div>
        <ProgressBar
          tone={
            tone === "missing"
              ? "missing"
              : tone === "review"
                ? "review"
                : "approved"
          }
          value={usageWidth}
        />
      </div>
    </article>
  );
}

function templateMappingStatusLabel(
  status:
    | Project["templateMappingStatus"]
    | TemplateUploadResult["mappingStatus"]
    | undefined,
) {
  if (status === "confirmed") {
    return "매핑 확정됨";
  }

  if (status === "suggested") {
    return "매핑 추천됨";
  }

  return "매핑 없음";
}

const templateFieldLabel = {
  transactionDate: "거래일자",
  vendorName: "거래처명",
  businessNumber: "사업자등록번호",
  accountTitle: "계정과목",
  summary: "적요",
  supplyAmount: "공급가액",
  vatAmount: "부가세액",
  totalAmount: "합계금액",
  evidenceType: "증빙구분",
  paymentMethod: "결제수단",
} as const;
