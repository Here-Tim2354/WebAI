import { randomUUID } from "crypto";
import { extname } from "path";
import { convertWithOptions } from "libreoffice-convert";
import { type SupabaseClient } from "@supabase/supabase-js";
import {
  type ChatMessageMetadata,
  type MessageAttachment,
  messageAttachmentsSchema,
} from "@/lib/schemas/chat";

export const MESSAGE_ATTACHMENTS_BUCKET = "message_attachments";
export const MAX_MESSAGE_ATTACHMENTS = 5;
export const MAX_IMAGE_ATTACHMENT_SIZE = 5 * 1024 * 1024;
export const MAX_FILE_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_MESSAGE_ATTACHMENTS_SIZE = 20 * 1024 * 1024;

const imageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const storedFileMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
]);
const officeMimeTypes = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const extensionMimeTypeMap = new Map([
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
  [
    ".xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  [".ppt", "application/vnd.ms-powerpoint"],
  [
    ".pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
]);

export function isSupportedImageMimeType(mimeType: string) {
  return imageMimeTypes.has(mimeType);
}

export function isSupportedStoredFileMimeType(mimeType: string) {
  return storedFileMimeTypes.has(mimeType);
}

export function isSupportedOfficeMimeType(mimeType: string) {
  return officeMimeTypes.has(mimeType);
}

export function isSupportedAttachmentMimeType(mimeType: string) {
  return (
    isSupportedImageMimeType(mimeType) ||
    isSupportedStoredFileMimeType(mimeType) ||
    isSupportedOfficeMimeType(mimeType)
  );
}

export function getAttachmentSizeLimit(mimeType: string) {
  return isSupportedImageMimeType(mimeType)
    ? MAX_IMAGE_ATTACHMENT_SIZE
    : MAX_FILE_ATTACHMENT_SIZE;
}

export function formatAttachmentSizeLimit(size: number) {
  if (size % (1024 * 1024) === 0) {
    return `${size / 1024 / 1024}MB`;
  }

  if (size % 1024 === 0) {
    return `${size / 1024}KB`;
  }

  return `${size}B`;
}

function getSupportedMimeType(file: File) {
  if (file.type && isSupportedAttachmentMimeType(file.type)) {
    return file.type;
  }

  const mimeTypeFromExtension = extensionMimeTypeMap.get(
    extname(file.name).toLowerCase(),
  );

  return mimeTypeFromExtension ?? file.type ?? "application/octet-stream";
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName.trim().replace(/[\\/:*?"<>|]+/g, "-");
  return normalized.length > 0 ? normalized : "attachment";
}

function createStoragePath(userId: string, fileName: string) {
  const attachmentId = randomUUID();
  const extension = extname(fileName).toLowerCase();

  return {
    attachmentId,
    storagePath: `${userId}/drafts/${attachmentId}/attachment${extension}`,
  };
}

async function convertOfficeBufferToPdf(
  buffer: Buffer,
  fileName: string,
): Promise<Buffer> {
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      convertWithOptions(buffer, "pdf", undefined, {
        fileName: sanitizeFileName(fileName),
        asyncOptions: {
          times: 4,
          interval: 250,
        },
      }, (error, data) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(data);
      });
    });
  } catch {
    throw new Error(
      "Office 转 PDF 失败：当前运行环境缺少 LibreOffice/soffice 或转换失败。请先导出为 PDF 后上传。",
    );
  }
}

export async function prepareAttachmentUpload(file: File) {
  const sourceMimeType = getSupportedMimeType(file);

  if (!isSupportedAttachmentMimeType(sourceMimeType)) {
    throw new Error("当前文件类型暂不支持。");
  }

  if (file.size > getAttachmentSizeLimit(sourceMimeType)) {
    throw new Error(
      `文件大小超过限制：图片不得超过 ${formatAttachmentSizeLimit(MAX_IMAGE_ATTACHMENT_SIZE)}，文件不得超过 ${formatAttachmentSizeLimit(MAX_FILE_ATTACHMENT_SIZE)}。`,
    );
  }

  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  if (isSupportedOfficeMimeType(sourceMimeType)) {
    const pdfBuffer = await convertOfficeBufferToPdf(sourceBuffer, file.name);
    const pdfFileName = `${sanitizeFileName(file.name).replace(/\.[^.]+$/, "")}.pdf`;

    return {
      buffer: pdfBuffer,
      fileName: pdfFileName,
      mimeType: "application/pdf",
      kind: "file" as const,
      originalFileName: file.name,
      originalMimeType: sourceMimeType,
    };
  }

  return {
    buffer: sourceBuffer,
    fileName: sanitizeFileName(file.name),
    mimeType: sourceMimeType,
    kind: isSupportedImageMimeType(sourceMimeType) ? "image" as const : "file" as const,
    originalFileName: undefined,
    originalMimeType: undefined,
  };
}

export async function uploadMessageAttachment(
  supabase: SupabaseClient,
  userId: string,
  file: File,
) {
  const prepared = await prepareAttachmentUpload(file);
  const { attachmentId, storagePath } = createStoragePath(
    userId,
    prepared.fileName,
  );
  const { error } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .upload(storagePath, prepared.buffer, {
      contentType: prepared.mimeType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return {
    id: attachmentId,
    kind: prepared.kind,
    fileName: prepared.fileName,
    mimeType: prepared.mimeType,
    size: prepared.buffer.byteLength,
    storagePath,
    originalFileName: prepared.originalFileName,
    originalMimeType: prepared.originalMimeType,
  } satisfies MessageAttachment;
}

export function normalizeMessageAttachments(
  attachments: MessageAttachment[] | undefined,
) {
  return messageAttachmentsSchema.parse(attachments ?? []);
}

export function assertAttachmentsOwnedByUser(
  userId: string,
  attachments: MessageAttachment[],
) {
  const expectedPrefix = `${userId}/drafts/`;

  for (const attachment of attachments) {
    if (!attachment.storagePath.startsWith(expectedPrefix)) {
      throw new Error("附件不属于当前用户，无法继续操作。");
    }
  }
}

export function getAttachmentPaths(metadata: ChatMessageMetadata | undefined) {
  return (metadata?.attachments ?? []).map((attachment) => attachment.storagePath);
}

export function buildAttachmentObjectUrl(storagePath: string) {
  return `/api/attachments/object?path=${encodeURIComponent(storagePath)}`;
}

async function listReferencedAttachmentPaths(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("messages")
    .select("metadata")
    .not("metadata", "is", null);

  if (error) {
    throw error;
  }

  const paths = new Set<string>();

  for (const row of data ?? []) {
    const metadata = row.metadata as ChatMessageMetadata | null;

    for (const path of getAttachmentPaths(metadata ?? undefined)) {
      paths.add(path);
    }
  }

  return paths;
}

export async function cleanupUnreferencedAttachments(
  supabase: SupabaseClient,
  previousAttachments: MessageAttachment[],
) {
  if (previousAttachments.length === 0) {
    return;
  }

  const referencedPaths = await listReferencedAttachmentPaths(supabase);
  const removablePaths = previousAttachments
    .map((attachment) => attachment.storagePath)
    .filter((path) => !referencedPaths.has(path));

  if (removablePaths.length === 0) {
    return;
  }

  await supabase.storage.from(MESSAGE_ATTACHMENTS_BUCKET).remove(removablePaths);
}

export async function downloadAttachmentBuffer(
  supabase: SupabaseClient,
  attachment: MessageAttachment,
) {
  const { data, error } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .download(attachment.storagePath);

  if (error) {
    throw error;
  }

  return Buffer.from(await data.arrayBuffer());
}

export function getFileExtension(fileName: string) {
  return extname(fileName).toLowerCase();
}
