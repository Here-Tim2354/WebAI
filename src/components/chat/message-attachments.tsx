"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  FileTextIcon,
  ImageIcon,
  LoaderCircleIcon,
  PaperclipIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  MAX_FILE_ATTACHMENT_SIZE,
  MAX_IMAGE_ATTACHMENT_SIZE,
  MAX_MESSAGE_ATTACHMENTS,
  MAX_MESSAGE_ATTACHMENTS_SIZE,
  SUPPORTED_FILE_EXTENSION_SET,
  SUPPORTED_FILE_MIME_TYPE_SET,
  SUPPORTED_IMAGE_EXTENSION_SET,
  SUPPORTED_IMAGE_MIME_TYPES,
  SUPPORTED_IMAGE_MIME_TYPE_SET,
  XLSX_MIME_TYPE,
  buildAttachmentObjectUrl,
  formatAttachmentSize,
  getAttachmentFileExtension,
} from "@/lib/attachment-config";
import { type MessageAttachment } from "@/lib/schemas/chat";
import { cn } from "@/lib/utils";
import { smoothEase } from "./motion-presets";
import {
  MAX_EDIT_URL_CONTEXT_ITEMS,
  normalizeUrlCandidate,
} from "./message-url-context";

const previewBackdropTransition = { duration: 0.18, ease: smoothEase } as const;
const previewPanelTransition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.72,
} as const;

type AttachmentEditorDialogProps = {
  open: boolean;
  title: string;
  urls: string[];
  attachments: MessageAttachment[];
  disabled?: boolean;
  supportsFiles: boolean;
  supportsImages: boolean;
  isUploading?: boolean;
  onOpenChange: (open: boolean) => void;
  onUrlsChange: (urls: string[]) => void;
  onAttachmentsChange: Dispatch<SetStateAction<MessageAttachment[]>>;
  onUploadFiles: (files: File[]) => Promise<MessageAttachment[]>;
};

export function getAttachmentAcceptMimeTypes({
  supportsFiles,
  supportsImages,
}: {
  supportsFiles: boolean;
  supportsImages: boolean;
}) {
  // accept 只负责优化文件选择器展示，真正的安全校验仍在客户端预校验和服务端上传阶段各做一次。
  return [
    ...(supportsImages ? SUPPORTED_IMAGE_MIME_TYPES : []),
    ...(supportsFiles
      ? [
          "application/pdf",
          "text/plain",
          "text/markdown",
          "text/csv",
          ".md",
          ".csv",
          ".doc",
          ".docx",
          ".xlsx",
          ".ppt",
          ".pptx",
        ]
      : []),
  ].join(",");
}

function isSupportedByCurrentModel(
  file: File,
  {
    supportsFiles,
    supportsImages,
  }: {
    supportsFiles: boolean;
    supportsImages: boolean;
  },
) {
  // Windows / Office 场景经常给空 MIME 或泛 MIME，所以这里同时按扩展名兜底判断。
  if (SUPPORTED_IMAGE_MIME_TYPE_SET.has(file.type)) {
    return supportsImages;
  }

  if (SUPPORTED_IMAGE_EXTENSION_SET.has(getAttachmentFileExtension(file.name))) {
    return supportsImages;
  }

  if (SUPPORTED_FILE_MIME_TYPE_SET.has(file.type)) {
    return supportsFiles;
  }

  if (SUPPORTED_FILE_EXTENSION_SET.has(getAttachmentFileExtension(file.name))) {
    return supportsFiles;
  }

  return false;
}

export function getAttachmentFileValidationError(
  files: File[],
  {
    currentAttachmentCount,
    currentAttachmentSizes = [],
    supportsFiles,
    supportsImages,
  }: {
    currentAttachmentCount: number;
    currentAttachmentSizes?: number[];
    supportsFiles: boolean;
    supportsImages: boolean;
  },
) {
  // 这是输入区和弹窗共用的轻量预校验；服务端仍会按同一配置再校验一次。
  if (
    files.some(
      (file) =>
        !isSupportedByCurrentModel(file, { supportsFiles, supportsImages }),
    )
  ) {
    return "当前模型不支持所选文件类型。";
  }

  if (currentAttachmentCount + files.length > MAX_MESSAGE_ATTACHMENTS) {
    return `每条消息最多添加 ${MAX_MESSAGE_ATTACHMENTS} 个附加项。`;
  }

  if (files.some((file) => file.size > getFileSizeLimit(file))) {
    return `文件大小超过限制：图片不得超过 ${formatAttachmentSize(MAX_IMAGE_ATTACHMENT_SIZE)}，文件不得超过 ${formatAttachmentSize(MAX_FILE_ATTACHMENT_SIZE)}。`;
  }

  const totalSize = [
    ...currentAttachmentSizes,
    ...files.map((file) => file.size),
  ].reduce((sum, size) => sum + size, 0);

  if (totalSize > MAX_MESSAGE_ATTACHMENTS_SIZE) {
    return `单条消息附加项总大小不能超过 ${formatAttachmentSize(MAX_MESSAGE_ATTACHMENTS_SIZE)}。`;
  }

  return null;
}

function getFileSizeLimit(file: File) {
  return (
    SUPPORTED_IMAGE_MIME_TYPE_SET.has(file.type) ||
    SUPPORTED_IMAGE_EXTENSION_SET.has(getAttachmentFileExtension(file.name))
  )
    ? MAX_IMAGE_ATTACHMENT_SIZE
    : MAX_FILE_ATTACHMENT_SIZE;
}

function getAttachmentLabel(attachment: MessageAttachment) {
  return attachment.fileName;
}

function isConvertedXlsxAttachment(attachment: MessageAttachment) {
  return attachment.originalMimeType === XLSX_MIME_TYPE;
}

function ImagePreviewPortal({
  attachment,
  onClose,
}: {
  attachment: MessageAttachment | null;
  onClose: () => void;
}) {
  const shouldReduceMotion = Boolean(useReducedMotion());

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {attachment ? (
        // 图片预览放到 document.body，避免被输入框或消息容器的 overflow 裁切。
        <motion.div
          key={attachment.id}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={getAttachmentLabel(attachment)}
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : previewBackdropTransition}
        >
          <button
            type="button"
            className="absolute inset-0 cursor-zoom-out"
            onClick={onClose}
            aria-label="关闭图片预览"
          />
          <motion.div
            className="relative flex max-h-full max-w-full flex-col gap-3"
            initial={
              shouldReduceMotion
                ? false
                : { opacity: 0, scale: 0.96, y: 12, filter: "blur(2px)" }
            }
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.98, y: 8, filter: "blur(1px)" }
            }
            transition={shouldReduceMotion ? { duration: 0 } : previewPanelTransition}
          >
            <button
              type="button"
              className="absolute -top-3 -right-3 z-10 inline-flex size-9 items-center justify-center rounded-full border border-white/18 bg-slate-950/78 text-white shadow-[0_14px_32px_rgba(15,23,42,0.35)] transition-colors hover:bg-slate-900"
              onClick={onClose}
              aria-label="关闭图片预览"
            >
              <XIcon className="size-4" />
            </button>
            <div className="overflow-hidden rounded-[16px] border border-white/14 bg-white/8 p-2 shadow-[0_28px_90px_rgba(15,23,42,0.42)]">
              <img
                src={buildAttachmentObjectUrl(attachment.storagePath)}
                alt={getAttachmentLabel(attachment)}
                className="max-h-[calc(100dvh-8rem)] max-w-[calc(100vw-3rem)] rounded-[10px] object-contain"
              />
            </div>
            <motion.div
              className="mx-auto max-w-[min(34rem,calc(100vw-3rem))] truncate rounded-full border border-white/12 bg-slate-950/58 px-3 py-1.5 text-center text-xs text-white/82 shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
              initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.16, ease: smoothEase }
              }
            >
              {getAttachmentLabel(attachment)}
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function AttachmentPreviewList({
  attachments,
  className,
  onRemove,
}: {
  attachments: MessageAttachment[];
  className?: string;
  onRemove?: (attachment: MessageAttachment) => void;
}) {
  const [previewAttachment, setPreviewAttachment] =
    useState<MessageAttachment | null>(null);

  useEffect(() => {
    if (!previewAttachment) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewAttachment(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewAttachment]);

  if (attachments.length === 0) {
    return null;
  }

  return (
    <>
      <div className={cn("flex flex-wrap gap-2", className)}>
        {attachments.map((attachment) =>
          attachment.kind === "image" ? (
            <div
              key={attachment.id}
              className="group relative size-18 overflow-hidden rounded-[10px] border border-blue-100/90 bg-white/70"
            >
              <button
                type="button"
                className="h-full w-full"
                onClick={() => setPreviewAttachment(attachment)}
                aria-label={`放大查看 ${getAttachmentLabel(attachment)}`}
              >
                <img
                  src={buildAttachmentObjectUrl(attachment.storagePath)}
                  alt={getAttachmentLabel(attachment)}
                  className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                />
              </button>
              {onRemove ? (
                <button
                  type="button"
                  className="absolute top-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-slate-950/62 text-white opacity-90 shadow-[0_4px_10px_rgba(15,23,42,0.24)] transition-opacity hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(attachment);
                  }}
                  aria-label={`移除 ${getAttachmentLabel(attachment)}`}
                >
                  <XIcon className="size-3" />
                </button>
              ) : null}
            </div>
          ) : (
            <div
              key={attachment.id}
              className="flex max-w-[18rem] items-center gap-2 rounded-[10px] border border-blue-100/85 bg-white/70 px-2.5 py-2 text-xs text-slate-600"
            >
              <FileTextIcon className="size-4 shrink-0 text-sky-500" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0 truncate font-medium text-slate-700">
                    {getAttachmentLabel(attachment)}
                  </div>
                  <div className="shrink-0 text-[0.68rem] text-slate-400">
                    {formatAttachmentSize(attachment.size)}
                  </div>
                </div>
                {isConvertedXlsxAttachment(attachment) ? (
                  <div className="text-[0.68rem] text-sky-600">
                    XLSX 已自动转为 CSV
                  </div>
                ) : null}
              </div>
              {onRemove ? (
                <button
                  type="button"
                  className="ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500"
                  onClick={() => onRemove(attachment)}
                  aria-label={`移除 ${getAttachmentLabel(attachment)}`}
                >
                  <XIcon className="size-3" />
                </button>
              ) : null}
            </div>
          ),
        )}
      </div>

      <ImagePreviewPortal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </>
  );
}

export function AttachmentEditorDialog({
  open,
  title,
  urls,
  attachments,
  disabled = false,
  supportsFiles,
  supportsImages,
  isUploading = false,
  onOpenChange,
  onUrlsChange,
  onAttachmentsChange,
  onUploadFiles,
}: AttachmentEditorDialogProps) {
  const [urlValue, setUrlValue] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const canUpload = !disabled && (supportsFiles || supportsImages);
  const acceptMimeTypes = getAttachmentAcceptMimeTypes({
    supportsFiles,
    supportsImages,
  });

  const addUrl = () => {
    const normalizedUrl = normalizeUrlCandidate(urlValue);

    if (!normalizedUrl) {
      setUrlError("URL 格式不正确。");
      return;
    }

    if (urls.includes(normalizedUrl)) {
      setUrlValue("");
      setUrlError(null);
      return;
    }

    if (urls.length >= MAX_EDIT_URL_CONTEXT_ITEMS) {
      setUrlError(`最多保留 ${MAX_EDIT_URL_CONTEXT_ITEMS} 个 URL。`);
      return;
    }

    onUrlsChange([...urls, normalizedUrl]);
    setUrlValue("");
    setUrlError(null);
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);

    if (files.length === 0 || !canUpload) {
      return;
    }

    const validationError = getAttachmentFileValidationError(files, {
      currentAttachmentCount: attachments.length,
      currentAttachmentSizes: attachments.map((attachment) => attachment.size),
      supportsFiles,
      supportsImages,
    });

    if (validationError) {
      setAttachmentError(validationError);
      return;
    }

    try {
      // onUploadFiles 由上层负责真正上传；弹窗只关心校验、错误展示和本地列表合并。
      const uploaded = await onUploadFiles(files);
      onAttachmentsChange((current) => [...current, ...uploaded]);
      setAttachmentError(null);
    } catch (uploadError) {
      setAttachmentError(
        uploadError instanceof Error
          ? uploadError.message
          : "附件上传失败，请稍后再试。",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(42rem,calc(100vh-2rem))] w-[min(calc(100vw-2rem),42rem)] max-w-none flex-col overflow-hidden rounded-[18px] border border-border/70 bg-white/98 p-0 shadow-[0_28px_64px_rgba(46,79,134,0.14)]">
        <DialogHeader className="border-b border-border/70 px-6 pt-6 pb-4">
          <DialogTitle className="text-[1.08rem] leading-none text-foreground">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section className="space-y-2.5">
            <div className="text-xs font-medium text-slate-500">URL</div>
            <div className="flex gap-2">
              <Input
                value={urlValue}
                onChange={(event) => {
                  setUrlValue(event.target.value);
                  setUrlError(null);
                }}
                disabled={disabled}
                placeholder="输入 URL"
                className="h-9 rounded-[10px]"
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return;
                  }

                  event.preventDefault();
                  addUrl();
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-9 w-11 rounded-[10px]"
                onClick={addUrl}
                disabled={disabled}
                aria-label="添加 URL"
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
            {urls.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {urls.map((url) => (
                  <span
                    key={url}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-[10px] bg-sky-50 px-2.5 py-1 text-xs text-sky-800"
                  >
                    <span className="max-w-[24rem] truncate">{url}</span>
                    <button
                      type="button"
                      onClick={() => onUrlsChange(urls.filter((item) => item !== url))}
                      disabled={disabled}
                      aria-label={`移除 URL：${url}`}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-slate-500">文件和图片</div>
                <div className="text-[0.7rem] text-slate-400">
                  .xlsx 会自动转换为 .csv 后保存
                </div>
              </div>
              <label
                className={cn(
                  "relative inline-flex h-8 cursor-pointer items-center gap-1 overflow-hidden rounded-[9px] border border-border/80 bg-white px-3 text-xs font-medium text-slate-600 shadow-none transition-colors hover:bg-muted hover:text-foreground",
                  (!canUpload || isUploading) && "cursor-not-allowed opacity-55",
                )}
                aria-label="添加文件和图片"
              >
                {isUploading ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <PaperclipIcon className="size-4" />
                )}
                添加
                <input
                  type="file"
                  multiple
                  className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  disabled={!canUpload || isUploading}
                  accept={acceptMimeTypes}
                  aria-label="添加文件和图片"
                  onClick={() => setAttachmentError(null)}
                  onChange={(event) => {
                    const files = Array.from(event.currentTarget.files ?? []);
                    event.currentTarget.value = "";

                    if (files.length > 0) {
                      void uploadFiles(files);
                    }
                  }}
                />
              </label>
            </div>

            <div
              className={cn(
                "rounded-[13px] border border-dashed border-slate-200 bg-slate-50/70 p-3",
                canUpload && "hover:border-sky-200 hover:bg-sky-50/42",
              )}
              onDragOver={(event) => {
                if (!canUpload) {
                  return;
                }

                event.preventDefault();
              }}
              onDrop={(event) => {
                if (!canUpload) {
                  return;
                }

                event.preventDefault();
                void uploadFiles(event.dataTransfer.files);
              }}
            >
              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between gap-3 rounded-[10px] border border-white bg-white/82 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {attachment.kind === "image" ? (
                          <ImageIcon className="size-4 shrink-0 text-sky-500" />
                        ) : (
                          <FileTextIcon className="size-4 shrink-0 text-sky-500" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="min-w-0 truncate text-sm text-slate-700">
                              {getAttachmentLabel(attachment)}
                            </div>
                            <div className="shrink-0 text-xs text-slate-400">
                              {formatAttachmentSize(attachment.size)}
                            </div>
                          </div>
                          {isConvertedXlsxAttachment(attachment) ? (
                            <div className="text-xs text-sky-600">
                              XLSX 已自动转为 CSV
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <Tooltip content="移除">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-7 rounded-[8px] text-slate-400 hover:text-red-500"
                          disabled={disabled}
                          onClick={() =>
                            onAttachmentsChange((current) =>
                              current.filter((item) => item.id !== attachment.id),
                            )
                          }
                          aria-label={`移除 ${getAttachmentLabel(attachment)}`}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center text-sm text-slate-400">
                  拖拽文件到这里
                </div>
              )}
            </div>
          </section>

          {urlError ? <p className="text-xs text-red-500">{urlError}</p> : null}
          {attachmentError ? (
            <p className="text-xs text-red-500">{attachmentError}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
