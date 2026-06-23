"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { BrandLink, Panel } from "@/components/budgetflow-ui";
import { TextInput } from "@/components/form-controls";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth/auth-api";
import { loginSchema, type LoginInput, type LoginValues } from "@/lib/forms/login";

const sessionStorageKey = "budgetflow.session";
const defaultValues: LoginInput = {
  email: "admin@budgetflow.dev",
  password: "budgetflow",
};

export function LoginClient() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginInput, undefined, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);

    try {
      const session = await signIn(values);
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
      router.push("/home");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "로그인에 실패했습니다.");
    }
  });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--bf-background)] px-5 py-8">
      <section aria-label="로그인" className="w-full max-w-[420px]">
        <Panel className="w-full p-6 shadow-md sm:p-8">
          <BrandLink className="mb-6" />
          <div className="mb-6">
            <p className="text-xs font-bold uppercase text-[var(--bf-text-muted)]">
              Sign in
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--bf-text-primary)]">
              BudgetFlow 로그인
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--bf-text-secondary)]">
              관리자 계정으로 예산 정산 작업을 계속합니다.
            </p>
          </div>

          <div className="mb-5 rounded-lg border border-[var(--bf-support-info-border)] bg-[var(--bf-support-info-bg)] px-3 py-2.5 text-xs leading-5 text-[var(--bf-support-info-fg)]">
            데모 계정이 입력되어 있습니다. 그대로 <b>로그인</b>하면 가이드
            투어가 시작됩니다.
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <FormField label="이메일" error={form.formState.errors.email?.message}>
              <TextInput autoComplete="email" type="email" {...form.register("email")} />
            </FormField>

            <FormField
              label="비밀번호"
              error={form.formState.errors.password?.message}
            >
              <div className="relative">
                <TextInput
                  autoComplete="current-password"
                  className="pr-12"
                  type={showPassword ? "text" : "password"}
                  {...form.register("password")}
                />
                <button
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  className="absolute inset-y-0 right-0 inline-grid w-11 place-items-center rounded-md text-[var(--bf-text-secondary)] hover:text-[var(--bf-text-primary)] focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-9"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </FormField>

            {error ? (
              <p className="text-sm font-medium text-[var(--bf-support-error-fg)]">
                {error}
              </p>
            ) : null}

            <Button
              className="h-12 w-full"
              disabled={form.formState.isSubmitting}
              type="submit"
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <LogIn data-icon="inline-start" />
              )}
              로그인
            </Button>
          </form>
        </Panel>
      </section>
    </main>
  );
}
