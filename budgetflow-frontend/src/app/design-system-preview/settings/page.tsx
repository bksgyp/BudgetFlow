import { Save } from "lucide-react";

import {
  PreviewShell,
  SettingsFormPreview,
  SummaryGrid,
  TrustStrip,
} from "../_components";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Settings Preview | BudgetFlow",
};

export default function PreviewSettingsPage() {
  return (
    <PreviewShell
      active="설정"
      actions={
        <Button>
          <Save data-icon="inline-start" />
          설정 저장
        </Button>
      }
      eyebrow="Settings"
      title="엑셀 양식, 컬럼 매핑, 예산 카테고리"
    >
      <TrustStrip />
      <SummaryGrid />
      <SettingsFormPreview />
    </PreviewShell>
  );
}
