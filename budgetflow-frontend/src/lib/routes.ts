export function projectExpensesHref(projectId: string) {
  return `/expenses?projectId=${encodeURIComponent(projectId)}`;
}
