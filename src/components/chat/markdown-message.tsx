"use client";

import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkCjkFriendlyGfmStrikethrough from "remark-cjk-friendly-gfm-strikethrough";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";

type MarkdownMessageProps = {
  content: string;
};

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
export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          remarkCjkFriendly,
          remarkCjkFriendlyGfmStrikethrough,
        ]}
        components={{
          table({ children }) {
            return (
              <div className="markdown-table-wrap">
                <table>{children}</table>
              </div>
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
        {content}
      </ReactMarkdown>
    </div>
  );
}
