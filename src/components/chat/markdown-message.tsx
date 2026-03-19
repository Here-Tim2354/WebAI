"use client";

import ReactMarkdown from "react-markdown";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkCjkFriendlyGfmStrikethrough from "remark-cjk-friendly-gfm-strikethrough";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";

type MarkdownMessageProps = {
  content: string;
};

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          remarkCjkFriendly,
          remarkCjkFriendlyGfmStrikethrough,
        ]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code(props) {
            const { className, children, ...rest } = props;
            const textContent = String(children).replace(/\n$/, "");
            const match = /language-(\w+)/.exec(className ?? "");

            if (!match) {
              return (
                <code className="markdown-inline-code" {...rest}>
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock
                className={className}
                code={textContent}
                language={match[1]}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
