"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { AlertCircleIcon, ArrowRightIcon, MailIcon, SparklesIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AuthPanelProps = {
  initialMessage?: string | null;
  initialMessageType?: "info" | "error";
};

const LAST_AUTH_EMAIL_KEY = "webai:last-auth-email";

type AuthFeedbackState = {
  message: string;
  type: "info" | "error";
  code?: string | null;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "发送登录链接失败，请稍后再试。";
}

function parseAuthFeedbackFromLocation(): AuthFeedbackState | null {
  const queryParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const auth = queryParams.get("auth");
  const errorCode = hashParams.get("error_code") ?? queryParams.get("error_code");
  const errorDescription =
    hashParams.get("error_description") ?? queryParams.get("error_description");

  if (process.env.NODE_ENV !== "production") {
    console.log("auth callback", {
      href: window.location.href,
      search: window.location.search,
      hash: window.location.hash,
      auth,
      errorCode,
      errorDescription,
    });
  }

  if (errorCode === "otp_expired") {
    return {
      message: "登录链接已过期或已失效，请重新发送登录邮件后尽快打开。",
      type: "error",
      code: errorCode,
    };
  }

  if (auth === "error" || errorCode || errorDescription) {
    return {
      message:
        errorDescription?.trim() || "登录确认失败，请检查邮件链接或重新发送。",
      type: "error",
      code: errorCode,
    };
  }

  if (auth === "success") {
    return {
      message: "登录成功，正在进入你的会话工作区。",
      type: "info",
      code: null,
    };
  }

  return null;
}

export function AuthPanel({
  initialMessage = null,
  initialMessageType = "info",
}: AuthPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(initialMessage);
  const [feedbackType, setFeedbackType] = useState<"info" | "error">(initialMessageType);
  const [feedbackCode, setFeedbackCode] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(LAST_AUTH_EMAIL_KEY);

    if (savedEmail) {
      setEmail(savedEmail);
    }

    const locationFeedback = parseAuthFeedbackFromLocation();

    if (locationFeedback) {
      setFeedback(locationFeedback.message);
      setFeedbackType(locationFeedback.type);
      setFeedbackCode(locationFeedback.code ?? null);

      if (locationFeedback.code === "otp_expired") {
        window.setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 0);
      }
    }
  }, []);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();

    if (!email.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    setFeedbackCode(null);

    try {
      window.localStorage.setItem(LAST_AUTH_EMAIL_KEY, email.trim());

      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "发送登录链接失败。");
      }

      setFeedback(payload?.message ?? "登录链接已发送，请去邮箱确认。");
      setFeedbackType("info");
    } catch (error) {
      setFeedback(getErrorMessage(error));
      setFeedbackType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6"
      initial={false}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(133,188,255,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(200,226,255,0.32),transparent_30%)]" />
      <section className="relative w-full max-w-[31rem] rounded-[26px] border border-border/65 bg-white/86 p-6 shadow-[0_24px_72px_rgba(62,96,154,0.1)] backdrop-blur-xl sm:p-8">
        <div className="mx-auto w-full max-w-[27rem]">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[0.72rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            <SparklesIcon className="size-3.5" />
            WebAI
          </div>

          <div className="mt-5 space-y-3">
            <h1 className="max-w-[14ch] text-4xl font-semibold tracking-[0.01em] text-foreground sm:text-[3.0rem]">
              登录
            </h1>
            <p className="max-w-[42ch] text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
              输入你的邮箱
            </p>
          </div>

          <form className="mt-8 space-y-3" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <div className="relative">
                <MailIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  type="email"
                  value={email}
                  placeholder="邮箱地址"
                  autoFocus
                  className="h-11 border-border/70 bg-background/88 pl-10 text-sm shadow-none"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </label>

            <Button
              className="h-12 w-full rounded-2xl bg-primary text-primary-foreground shadow-[0_18px_36px_rgba(72,115,195,0.24)] hover:bg-primary/92"
              type="submit"
              disabled={isSubmitting}
            >
              <ArrowRightIcon data-icon="inline-end" />
              {isSubmitting
                ? "发送中..."
                : feedbackCode === "otp_expired"
                  ? "重新发送"
                  : "发送链接"}
            </Button>
          </form>

          {feedback ? (
            <Alert
              variant={feedbackType === "error" ? "destructive" : "default"}
              className={cn(
                "mt-5 rounded-2xl border bg-white/72 shadow-none",
                feedbackType === "error"
                  ? "border-red-200/80 bg-red-50/80 text-red-700"
                  : "border-blue-100/80 bg-blue-50/72 text-foreground",
              )}
              role="status"
            >
              <AlertCircleIcon className="size-4" />
              <AlertTitle>{feedbackType === "error" ? "登录提醒" : "邮件已发送"}</AlertTitle>
              <AlertDescription>{feedback}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </section>
    </motion.main>
  );
}
