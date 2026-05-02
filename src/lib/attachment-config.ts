// 附件能力同时被客户端预校验、服务端上传处理和消息展示使用。
// 这些常量集中在这里，避免前端和后端各维护一套支持类型与大小限制。
export const MESSAGE_ATTACHMENTS_BUCKET = "message_attachments";

export const MAX_MESSAGE_ATTACHMENTS = 5;
export const MAX_IMAGE_ATTACHMENT_SIZE = 5 * 1024 * 1024;
export const MAX_FILE_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_MESSAGE_ATTACHMENTS_SIZE = 20 * 1024 * 1024;

export const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const SUPPORTED_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
] as const;

export const SUPPORTED_STORED_FILE_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
] as const;

export const SUPPORTED_OFFICE_MIME_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export const SUPPORTED_SPREADSHEET_MIME_TYPES = [XLSX_MIME_TYPE] as const;

export const SUPPORTED_FILE_MIME_TYPES = [
  ...SUPPORTED_STORED_FILE_MIME_TYPES,
  ...SUPPORTED_OFFICE_MIME_TYPES,
  ...SUPPORTED_SPREADSHEET_MIME_TYPES,
] as const;

export const SUPPORTED_FILE_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".doc",
  ".docx",
  ".xlsx",
  ".ppt",
  ".pptx",
] as const;

export const ATTACHMENT_EXTENSION_MIME_TYPE_ENTRIES = [
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".pdf", "application/pdf"],
  [".txt", "text/plain"],
  [".md", "text/markdown"],
  [".csv", "text/csv"],
  [".doc", "application/msword"],
  [
    ".docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  [".xls", "application/vnd.ms-excel"],
  [".xlsx", XLSX_MIME_TYPE],
  [".ppt", "application/vnd.ms-powerpoint"],
  [
    ".pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
] as const;

// 数组用于生成 input accept 等有序文本，Set/Map 用于运行时快速判断。
// 两类导出都保留，是为了让调用点按用途选择，而不是在组件里重复 new Set。
export const SUPPORTED_IMAGE_MIME_TYPE_SET = new Set<string>(
  SUPPORTED_IMAGE_MIME_TYPES,
);
export const SUPPORTED_IMAGE_EXTENSION_SET = new Set<string>(
  SUPPORTED_IMAGE_EXTENSIONS,
);
export const SUPPORTED_STORED_FILE_MIME_TYPE_SET = new Set<string>(
  SUPPORTED_STORED_FILE_MIME_TYPES,
);
export const SUPPORTED_OFFICE_MIME_TYPE_SET = new Set<string>(
  SUPPORTED_OFFICE_MIME_TYPES,
);
export const SUPPORTED_SPREADSHEET_MIME_TYPE_SET = new Set<string>(
  SUPPORTED_SPREADSHEET_MIME_TYPES,
);
export const SUPPORTED_FILE_MIME_TYPE_SET = new Set<string>(
  SUPPORTED_FILE_MIME_TYPES,
);
export const SUPPORTED_FILE_EXTENSION_SET = new Set<string>(
  SUPPORTED_FILE_EXTENSIONS,
);
export const ATTACHMENT_EXTENSION_MIME_TYPE_MAP = new Map<string, string>(
  ATTACHMENT_EXTENSION_MIME_TYPE_ENTRIES,
);

export function getAttachmentFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");

  return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase();
}

// 展示和校验提示共用同一个格式化函数，确保“5MB / 10MB / 20MB”这类文案不漂移。
export function formatAttachmentSize(size: number) {
  if (size % (1024 * 1024) === 0) {
    return `${size / 1024 / 1024}MB`;
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

// 私有 Storage 对象不能直接暴露公开 URL，前端统一通过鉴权代理路由读取。
export function buildAttachmentObjectUrl(storagePath: string) {
  return `/api/attachments/object?path=${encodeURIComponent(storagePath)}`;
}
