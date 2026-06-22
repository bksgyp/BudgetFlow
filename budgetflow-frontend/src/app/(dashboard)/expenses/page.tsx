import { Suspense } from "react";

import { ExpensesClient } from "./expenses-client";

export default function ExpensesPage() {
  return (
    <Suspense fallback={null}>
      <ExpensesClient />
    </Suspense>
  );
}
