"use client";

import type { HTMLAttributes } from "react";
import { useState } from "react";

type CodeBlockProps = {
  className?: string;
  code: string;
  language: string;
  preProps?: Omit<HTMLAttributes<HTMLElement>, "children">;
};

export function CodeBlock({
  className,
  code,
  language,
  preProps,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="code-block">
      <div className="code-block__header">
        <span>{language}</span>
        <button type="button" onClick={() => void handleCopy()}>
          {copied ? "已复制" : "复制代码"}
        </button>
      </div>
      <pre>
        <code className={className} {...preProps}>
          {code}
        </code>
      </pre>
    </div>
  );
}
