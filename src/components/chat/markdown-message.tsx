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
