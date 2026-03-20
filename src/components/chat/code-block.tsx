"use client";

import hljs from "highlight.js";
import { useState } from "react";

type CodeBlockProps = {
  className?: string;
  code: string;
  language: string;
};

function highlightCode(code: string, language: string) {
  if (language !== "text" && hljs.getLanguage(language)) {
    return hljs.highlight(code, {
      language,
      ignoreIllegals: true,
    }).value;
  }

  return hljs.highlightAuto(code).value;
}

export function CodeBlock({ className, code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const highlightedCode = highlightCode(code, language);

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
        <code
          className={["hljs", className].filter(Boolean).join(" ")}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  );
}
