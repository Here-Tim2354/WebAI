import {
  LinkIcon,
  PencilIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const MAX_EDIT_URL_CONTEXT_ITEMS = 20;

export function getUrlDisplayText(url: string) {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.hostname}${parsedUrl.pathname === "/" ? "" : parsedUrl.pathname}`;
  } catch {
    return url;
  }
}

export function normalizeUrlCandidate(url: string) {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return null;
  }

  try {
    const candidateUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;
    const normalizedUrl = new URL(candidateUrl);

    if (
      normalizedUrl.protocol !== "http:" &&
      normalizedUrl.protocol !== "https:"
    ) {
      return null;
    }

    return normalizedUrl.toString();
  } catch {
    return null;
  }
}

export function areUrlListsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((url, index) => url === right[index]);
}

type MessageUrlContextSummaryProps = {
  urls: string[];
  className?: string;
  maxVisibleItems?: number;
};

export function MessageUrlContextSummary({
  urls,
  className,
  maxVisibleItems = 3,
}: MessageUrlContextSummaryProps) {
  const visibleUrls = urls.slice(0, maxVisibleItems);
  const hiddenUrlCount = Math.max(urls.length - visibleUrls.length, 0);

  if (urls.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex max-w-full flex-wrap items-center gap-1.5 text-[0.72rem] leading-5 text-slate-500",
        className,
      )}
    >
      <span className="inline-flex shrink-0 items-center gap-1 font-medium text-slate-500">
        <LinkIcon className="size-3.5" />
        URL Context · {urls.length}
      </span>
      {visibleUrls.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-[14rem] items-center rounded-[8px] border border-blue-100/80 bg-white/58 px-1.5 py-0.5 text-slate-500 transition-colors hover:border-blue-200 hover:text-slate-700"
          title={url}
        >
          <span className="truncate">{getUrlDisplayText(url)}</span>
        </a>
      ))}
      {hiddenUrlCount > 0 ? (
        <span className="inline-flex rounded-[8px] border border-blue-100/80 bg-white/48 px-1.5 py-0.5 text-slate-400">
          +{hiddenUrlCount}
        </span>
      ) : null}
    </div>
  );
}

type EditableMessageUrlContextProps = {
  urls: string[];
  inputValue: string;
  error: string | null;
  expanded: boolean;
  disabled: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onInputChange: (value: string) => void;
  onAddUrl: () => void;
  onRemoveUrl: (url: string) => void;
  onClearError: () => void;
};

export function EditableMessageUrlContext({
  urls,
  inputValue,
  error,
  expanded,
  disabled,
  onExpandedChange,
  onInputChange,
  onAddUrl,
  onRemoveUrl,
  onClearError,
}: EditableMessageUrlContextProps) {
  const visibleUrls = expanded ? urls : urls.slice(0, 3);
  const hiddenUrlCount = Math.max(urls.length - visibleUrls.length, 0);

  return (
    <div className="rounded-[12px] border border-blue-100/80 bg-white/48 px-2.5 py-2">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[0.72rem] leading-5 text-slate-500">
          <span className="inline-flex shrink-0 items-center gap-1 font-medium text-slate-500">
            <LinkIcon className="size-3.5" />
            URL Context · {urls.length}
          </span>
          {visibleUrls.map((url) => (
            <span
              key={url}
              className="inline-flex max-w-[13rem] items-center gap-1 rounded-[8px] border border-blue-100/80 bg-white/70 px-1.5 py-0.5 text-slate-500"
              title={url}
            >
              <span className="truncate">{getUrlDisplayText(url)}</span>
              {expanded ? (
                <Tooltip content="移除 URL">
                  <button
                    type="button"
                    className="inline-flex size-4 items-center justify-center rounded-[5px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    onClick={() => onRemoveUrl(url)}
                    disabled={disabled}
                    aria-label="移除 URL"
                  >
                    <XIcon className="size-3" />
                  </button>
                </Tooltip>
              ) : null}
            </span>
          ))}
          {!expanded && hiddenUrlCount > 0 ? (
            <span className="inline-flex rounded-[8px] border border-blue-100/80 bg-white/48 px-1.5 py-0.5 text-slate-400">
              +{hiddenUrlCount}
            </span>
          ) : null}
        </div>
        <Tooltip content="修改 URL Context">
          <Button
            variant="outline"
            size="icon-sm"
            className="h-7 w-10 rounded-[9px] border-blue-100/85 bg-white/65 text-slate-500 shadow-none hover:bg-white hover:text-slate-800"
            type="button"
            onClick={() => {
              onExpandedChange(!expanded);
              onClearError();
            }}
            disabled={disabled}
            aria-label="修改 URL Context"
          >
            <PencilIcon className="size-3.5" />
          </Button>
        </Tooltip>
      </div>
      {expanded ? (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Input
              value={inputValue}
              onChange={(event) => {
                onInputChange(event.target.value);
                onClearError();
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }

                event.preventDefault();
                onAddUrl();
              }}
              placeholder="粘贴或输入 URL"
              className="h-8 rounded-[10px] border-blue-100/90 bg-white/72 text-[0.82rem] shadow-none"
              disabled={disabled}
            />
            <Tooltip content="添加 URL">
              <Button
                variant="outline"
                size="icon-sm"
                className="h-8 w-11 rounded-[9px] border-blue-100/85 bg-white/65 text-slate-500 shadow-none hover:bg-white hover:text-slate-800"
                type="button"
                onClick={onAddUrl}
                disabled={disabled || inputValue.trim().length === 0}
                aria-label="添加 URL"
              >
                <PlusIcon className="size-3.5" />
              </Button>
            </Tooltip>
          </div>
          {error ? (
            <p className="px-0.5 text-[0.72rem] leading-5 text-red-500">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
