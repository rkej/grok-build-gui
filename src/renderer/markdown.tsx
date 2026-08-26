import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const REMARK_PLUGINS = [remarkGfm];

const MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a href={href} onClick={(e) => { e.preventDefault(); if (href) void window.grokApp.openExternal(href); }}>
      {children}
    </a>
  ),
};

export const MessageMarkdown = memo(function MessageMarkdown({ text }: { readonly text: string }) {
  return (
    <div className="message__content">
      <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {text}
      </Markdown>
    </div>
  );
});
