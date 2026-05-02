"use client";

import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkCjkFriendlyGfmStrikethrough from "remark-cjk-friendly-gfm-strikethrough";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CodeBlock } from "./code-block";

type MarkdownMessageProps = {
  content: string;
  className?: string;
};

function isEscaped(content: string, index: number) {
  let backslashCount = 0;

  for (
    let cursor = index - 1;
    cursor >= 0 && content[cursor] === "\\";
    cursor -= 1
  ) {
    backslashCount += 1;
  }

  return backslashCount % 2 === 1;
}

function isSingleDollarDelimiter(content: string, index: number) {
  // 只处理单个 $，块级 $$...$$ 交给 remark-math 原生逻辑。
  return (
    content[index] === "$" &&
    content[index - 1] !== "$" &&
    content[index + 1] !== "$" &&
    !isEscaped(content, index)
  );
}

function containsCjkNaturalLanguage(content: string) {
  return /[\p{Script=Han}，。！？、；：]/u.test(content);
}

function escapeCjkContaminatedSingleDollarMath(content: string) {
  let nextContent = "";

  for (let index = 0; index < content.length; index += 1) {
    if (!isSingleDollarDelimiter(content, index)) {
      nextContent += content[index];
      continue;
    }

    let closingIndex = -1;

    for (let cursor = index + 1; cursor < content.length; cursor += 1) {
      if (isSingleDollarDelimiter(content, cursor)) {
        closingIndex = cursor;
        break;
      }
    }

    if (closingIndex === -1) {
      nextContent += content[index];
      continue;
    }

    const mathCandidate = content.slice(index + 1, closingIndex);

    if (containsCjkNaturalLanguage(mathCandidate)) {
      // 中文自然语言里常出现“$价格$”一类文本，直接交给 KaTeX 会被渲染成错误公式。
      // 这里仅转义含中文/中文标点的单美元片段，正常数学公式仍保持可渲染。
      nextContent += `\\$${mathCandidate}\\$`;
      index = closingIndex;
      continue;
    }

    nextContent += content.slice(index, closingIndex + 1);
    index = closingIndex;
  }

  return nextContent;
}

function normalizeSingleLineDisplayMath(content: string) {
  return content
    .split("\n")
    .map((line) => {
      const match = /^\s*\$\$([\s\S]+)\$\$\s*$/.exec(line);
      const mathContent = match?.[1]?.trim();

      if (!mathContent) {
        return line;
      }

      // 模型常把块级公式压成单行 $$...$$。
      // 拆成独立块后，KaTeX 会按 display math 居中渲染，不会挤在段落里。
      return `\n$$\n${mathContent}\n$$\n`;
    })
    .join("\n");
}

// ReactMarkdown 的 code/pre 回调拿到的是 ReactNode。
// 这里先递归抽出纯文本，后面才能交给自定义 CodeBlock 处理。
function extractTextContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractTextContent).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractTextContent(node.props.children);
  }

  return "";
}

/**
 * MarkdownMessage 是消息内容的统一渲染入口。
 * 这里集中处理 GFM、中文排版兼容，以及代码块替换逻辑。
 */
export function MarkdownMessage({
  content,
  className,
}: MarkdownMessageProps) {
  return (
    <div className={["markdown", className].filter(Boolean).join(" ")}>
      <ReactMarkdown
        remarkPlugins={[
          remarkMath,
          remarkGfm,
          remarkCjkFriendly,
          remarkCjkFriendlyGfmStrikethrough,
        ]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table({ children }) {
            return (
              <ScrollArea axis="horizontal" className="markdown-table-wrap">
                <table>{children}</table>
              </ScrollArea>
            );
          },
          pre({ children }) {
            const codeChild = Children.only(children);

            if (!isValidElement<{
              children?: ReactNode;
              className?: string;
            }>(codeChild)) {
              return <pre>{children}</pre>;
            }

            const className = codeChild.props.className;
            const match = /language-([^\s]+)/.exec(className ?? "");
            const code = extractTextContent(codeChild.props.children).replace(
              /\n$/,
              "",
            );

            // 默认 <pre><code> 结构在这里被替换成项目自定义的 CodeBlock。
            return (
              <CodeBlock
                className={className}
                code={code}
                language={match?.[1] ?? "text"}
              />
            );
          },
          code(props) {
            const { className, children, ...rest } = props;

            if (!className) {
              // 没有 language class 的 code 视为行内代码，不走块级 CodeBlock。
              return (
                <code className="markdown-inline-code" {...rest}>
                  {children}
                </code>
              );
            }

            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
        }}
      >
        {normalizeSingleLineDisplayMath(
          escapeCjkContaminatedSingleDollarMath(content),
        )}
      </ReactMarkdown>
    </div>
  );
}
