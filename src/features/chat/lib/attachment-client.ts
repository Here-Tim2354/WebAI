import {
  MAX_FILE_ATTACHMENT_SIZE,
  MAX_IMAGE_ATTACHMENT_SIZE,
  MAX_MESSAGE_ATTACHMENTS,
  MAX_MESSAGE_ATTACHMENTS_SIZE,
  SUPPORTED_ATTACHMENT_DESCRIPTION,
  SUPPORTED_FILE_EXTENSION_SET,
  SUPPORTED_FILE_MIME_TYPE_SET,
  SUPPORTED_IMAGE_EXTENSION_SET,
  SUPPORTED_IMAGE_MIME_TYPES,
  SUPPORTED_IMAGE_MIME_TYPE_SET,
  formatAttachmentSize,
  getAttachmentFileExtension,
} from "@/lib/attachment-config";

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
          ".xlsx",
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
  // Windows / Office 场景经常给空 MIME 或泛 MIME，因此同时按扩展名兜底判断。
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
    return SUPPORTED_ATTACHMENT_DESCRIPTION;
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
