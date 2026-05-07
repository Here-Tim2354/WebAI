"use client";

import hljs from "highlight.js";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip } from "@/components/ui/tooltip";

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

function fallbackCopyText(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand("copy");
  } finally {
    textarea.parentNode?.removeChild(textarea);
  }
}

export function CodeBlock({ className, code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const highlightedCode = highlightCode(code, language);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else if (!fallbackCopyText(code)) {
        throw new Error("复制失败");
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      if (fallbackCopyText(code)) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
        return;
      }

      setCopied(false);
    }
  }

  return (
    <div className="code-block">
      <div className="code-block__header">
        <span>{language}</span>
        <Tooltip content={copied ? "代码已复制" : "复制代码"}>
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label={copied ? "代码已复制" : "复制代码"}
          >
            {copied ? (
              <CheckIcon className="size-4" />
            ) : (
              <CopyIcon className="size-4" />
            )}
          </button>
        </Tooltip>
      </div>
      <ScrollArea axis="horizontal" className="code-block__scroll">
        <pre>
          <code
            className={["hljs", className].filter(Boolean).join(" ")}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </ScrollArea>
    </div>
  );
}
