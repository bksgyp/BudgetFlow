import { Suspense } from "react";

import { ExpensesClient } from "../expenses-client";
import { mockProjects } from "@/lib/api/mock-data";

export function generateStaticParams() {
  return mockProjects.map((project) => ({
    projectId: project.id,
  }));
}

export default async function ProjectExpensesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <Suspense fallback={null}>
      <ExpensesClient projectId={projectId} />
    </Suspense>
  );
}
