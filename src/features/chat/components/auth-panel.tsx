"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  GitBranchIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  MailIcon,
  SparklesIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AuthPanelProps = {
  initialMessage?: string | null;
  initialMessageType?: "info" | "error";
};

const LAST_AUTH_EMAIL_KEY = "webai:last-auth-email";
const AUTH_NOTICE_STORAGE_KEY = "webai:auth-notice";
const EMAIL_CODE_COOLDOWN_SECONDS = 60;

type AuthFeedbackState = {
  message: string;
  type: "info" | "error";
  code?: string | null;
};

type AuthMode = "password" | "email-code";

// 登录相关报错可能来自 fetch、Supabase callback 或手动抛错，需要统一转换成前端提示。
function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "登录失败，请稍后再试。";
}

function rememberLoginSuccessNotice() {
  window.sessionStorage.setItem(
    AUTH_NOTICE_STORAGE_KEY,
    "登录成功，欢迎回来。",
  );
}

/**
 * Supabase 邮箱回调既可能把状态放在 query string，也可能放在 hash。
 * 统一解析两种形态，避免登录页遗漏某类回跳提示。
 */
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
      message: "登录邮件已过期或已失效，请重新发送验证码后尽快使用。",
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

/**
 * AuthPanel 是未登录用户的入口面板：
 * 负责邮箱、密码、邮箱验证码和 OAuth 入口，以及消费回跳后的登录反馈。
 */
export function AuthPanel({
  initialMessage = null,
  initialMessageType = "info",
}: AuthPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isEmailCodeSending, setIsEmailCodeSending] = useState(false);
  const [isEmailCodeVerifying, setIsEmailCodeVerifying] = useState(false);
  const [emailCodeCooldown, setEmailCodeCooldown] = useState(0);
  const [feedback, setFeedback] = useState(initialMessage);
  const [feedbackType, setFeedbackType] = useState<"info" | "error">(initialMessageType);
  const [isGithubSubmitting, setIsGithubSubmitting] = useState(false);
  const isAuthSubmitting =
    isPasswordSubmitting ||
    isEmailCodeSending ||
    isEmailCodeVerifying ||
    isGithubSubmitting;

  // 登录页首次挂载时需要恢复本机邮箱，并解析 URL / hash 中的登录回跳结果。
  // 这能让过期链接、OAuth 失败和邮件发送成功都落到同一个提示区域。
  useEffect(() => {
    const savedEmail = window.localStorage.getItem(LAST_AUTH_EMAIL_KEY);

    if (savedEmail) {
      setEmail(savedEmail);
    }

    const locationFeedback = parseAuthFeedbackFromLocation();

    if (locationFeedback) {
      setFeedback(locationFeedback.message);
      setFeedbackType(locationFeedback.type);

      if (locationFeedback.code === "otp_expired") {
        // 链接过期时把焦点拉回邮箱框，减少用户重新发送的操作成本。
        window.setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 0);
      }
    }
  }, []);

  // Supabase Auth 仍会限制同一邮箱短时间内重复发送 OTP。
  // 前端先做 60 秒冷却，避免用户连续点击后直接撞到服务端限流。
  useEffect(() => {
    if (emailCodeCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setEmailCodeCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [emailCodeCooldown]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();

    if (!email.trim() || !password || isAuthSubmitting) {
      return;
    }

    setIsPasswordSubmitting(true);
    setFeedback(null);

    try {
      window.localStorage.setItem(LAST_AUTH_EMAIL_KEY, email.trim());

      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "邮箱或密码不正确。");
      }

      setFeedback("登录成功，正在进入你的会话工作区。");
      setFeedbackType("info");
      rememberLoginSuccessNotice();
      window.location.assign("/");
    } catch (error) {
      setFeedback(getErrorMessage(error));
      setFeedbackType("error");
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  async function handleSendEmailCodeClick() {
    if (!email.trim() || isAuthSubmitting || emailCodeCooldown > 0) {
      return;
    }

    setIsEmailCodeSending(true);
    setFeedback(null);

    try {
      window.localStorage.setItem(LAST_AUTH_EMAIL_KEY, email.trim());

      const response = await fetch("/api/auth/email-code/send", {
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
        throw new Error(payload?.error?.message ?? "发送验证码失败。");
      }

      setFeedback(payload?.message ?? "验证码已发送，请查看邮箱。");
      setFeedbackType("info");
      setEmailCodeCooldown(EMAIL_CODE_COOLDOWN_SECONDS);
    } catch (error) {
      setFeedback(getErrorMessage(error));
      setFeedbackType("error");
      setEmailCodeCooldown(EMAIL_CODE_COOLDOWN_SECONDS);
    } finally {
      setIsEmailCodeSending(false);
    }
  }

  async function handleVerifyEmailCodeClick() {
    if (!email.trim() || !emailCode.trim() || isAuthSubmitting) {
      return;
    }

    setIsEmailCodeVerifying(true);
    setFeedback(null);

    try {
      window.localStorage.setItem(LAST_AUTH_EMAIL_KEY, email.trim());

      const response = await fetch("/api/auth/email-code/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          token: emailCode,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "验证码不正确或已过期。");
      }

      setFeedback("登录成功，正在进入你的会话工作区。");
      setFeedbackType("info");
      rememberLoginSuccessNotice();
      window.location.assign("/");
    } catch (error) {
      setFeedback(getErrorMessage(error));
      setFeedbackType("error");
    } finally {
      setIsEmailCodeVerifying(false);
    }
  }

  return (
    <motion.main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6"
      initial={false}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(133,188,255,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(200,226,255,0.32),transparent_30%)]" />
      <section className="relative w-full max-w-[31rem] rounded-[18px] border border-border/65 bg-white/86 p-6 shadow-[0_24px_72px_rgba(62,96,154,0.1)] backdrop-blur-xl sm:p-8">
        <div className="mx-auto w-full max-w-[27rem]">
          <div className="inline-flex items-center gap-2 rounded-[12px] border border-border/60 bg-background/70 px-3 py-1 text-[0.72rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            <SparklesIcon className="size-3.5" />
            WebAI
          </div>

          <div className="mt-5 space-y-3">
            <h1 className="max-w-[14ch] text-4xl font-semibold tracking-[0.01em] text-foreground sm:text-[3.0rem]">
              登录
            </h1>
            <p className="max-w-[42ch] text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
              使用密码或邮箱验证码进入你的会话工作区。
            </p>
            <p className="max-w-[42ch] text-xs leading-5 text-slate-500">
              首次使用邮箱验证码或 GitHub 登录时，会自动创建账户。
            </p>
          </div>

          <div
            className="mt-8 grid grid-cols-2 gap-1 rounded-[14px] border border-border/65 bg-background/70 p-1"
            role="tablist"
            aria-label="登录方式"
          >
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "password"}
              className={cn(
                "h-10 rounded-[11px] text-sm font-medium transition-colors",
                authMode === "password"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setAuthMode("password")}
            >
              密码
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "email-code"}
              className={cn(
                "h-10 rounded-[11px] text-sm font-medium transition-colors",
                authMode === "email-code"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setAuthMode("email-code")}
            >
              邮箱验证码
            </button>
          </div>

          <div className="mt-4 space-y-3">
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
          </div>

          {authMode === "password" ? (
            <form className="mt-3 space-y-3" onSubmit={handleSubmit} role="tabpanel">
              <label className="block space-y-2">
                <div className="relative">
                  <LockKeyholeIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    placeholder="密码"
                    className="h-11 border-border/70 bg-background/88 pl-10 text-sm shadow-none"
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </label>

              <Button
                className="h-12 w-full rounded-[14px] bg-primary text-primary-foreground shadow-[0_18px_36px_rgba(72,115,195,0.24)] hover:bg-primary/92"
                type="submit"
                disabled={isAuthSubmitting || !email.trim() || !password}
              >
                <ArrowRightIcon data-icon="inline-end" />
                {isPasswordSubmitting ? "登录中..." : "密码登录"}
              </Button>
            </form>
          ) : (
            <form
              className="mt-3 space-y-3"
              role="tabpanel"
              onSubmit={(event) => {
                event.preventDefault();
                void handleVerifyEmailCodeClick();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="block">
                  <div className="relative">
                    <KeyRoundIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={emailCode}
                      placeholder="输入邮箱验证码"
                      className="h-11 border-border/70 bg-background/88 pl-10 text-sm shadow-none"
                      onChange={(event) =>
                        setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                    />
                  </div>
                </label>
                <Button
                  variant="outline"
                  className="h-11 rounded-[14px] border-border/70 bg-background/82 px-4 shadow-none"
                  type="button"
                  disabled={isAuthSubmitting || !email.trim() || emailCodeCooldown > 0}
                  onClick={() => void handleSendEmailCodeClick()}
                >
                  <KeyRoundIcon data-icon="inline-start" />
                  {isEmailCodeSending
                    ? "发送中..."
                    : emailCodeCooldown > 0
                      ? `${emailCodeCooldown} 秒后重发`
                      : "发送验证码"}
                </Button>
              </div>

              <Button
                className="h-12 w-full rounded-[14px] bg-primary text-primary-foreground shadow-[0_18px_36px_rgba(72,115,195,0.24)] hover:bg-primary/92"
                type="submit"
                disabled={isAuthSubmitting || !email.trim() || !emailCode.trim()}
              >
                <ArrowRightIcon data-icon="inline-end" />
                {isEmailCodeVerifying ? "验证中..." : "验证码登录"}
              </Button>
              <p className="text-xs leading-5 text-slate-500">
                验证码通常很快送达；如果没有看到，可以稍等片刻并检查垃圾邮件或拦截规则。
              </p>
            </form>
          )}

          <div className="mt-3">
            <Button
              variant="outline"
              className="h-11 w-full rounded-[14px] border-border/70 bg-background/82 shadow-none"
              type="button"
              disabled={isAuthSubmitting}
              onClick={() => {
                setIsGithubSubmitting(true);
                window.location.assign("/api/auth/github");
              }}
            >
              <GitBranchIcon data-icon="inline-start" />
              {isGithubSubmitting ? "跳转中..." : "使用 GitHub 登录"}
            </Button>
          </div>

          {feedback ? (
            <Alert
              variant={feedbackType === "error" ? "destructive" : "default"}
              className={cn(
                "mt-5 rounded-[14px] border bg-white/72 shadow-none",
                feedbackType === "error"
                  ? "border-red-200/80 bg-red-50/80 text-red-700"
                  : "border-blue-100/80 bg-blue-50/72 text-foreground",
              )}
              role="status"
            >
              <AlertCircleIcon className="size-4" />
              <AlertTitle>
                {feedbackType === "error"
                  ? "登录提醒"
                  : feedback.includes("登录成功")
                    ? "登录成功"
                    : "邮件已发送"}
              </AlertTitle>
              <AlertDescription>{feedback}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </section>
    </motion.main>
  );
}
