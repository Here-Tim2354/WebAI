"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-card__eyebrow">Phase 3.4</div>
        <h1 className="auth-card__title">先登录，再进入你的会话工作区</h1>
        <p className="auth-card__description">
          这一阶段会把会话真正挂到 Supabase 用户下，列表、重命名、删除都会基于真实账户生效。
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-form__field">
            <span>邮箱</span>
            <input
              ref={inputRef}
              type="email"
              value={email}
              placeholder="you@example.com"
              autoFocus
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <button className="auth-form__button" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "发送中..."
              : feedbackCode === "otp_expired"
                ? "重新发送登录链接"
                : "发送登录链接"}
          </button>
        </form>

        {feedback ? (
          <div
            className={`auth-feedback auth-feedback--${feedbackType}`}
            role="status"
          >
            {feedback}
          </div>
        ) : null}
      </section>
    </main>
  );
}
