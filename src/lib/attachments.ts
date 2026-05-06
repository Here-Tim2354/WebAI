import { randomUUID } from "crypto";
import readXlsxFile from "read-excel-file/universal";
import { type SupabaseClient } from "@supabase/supabase-js";
import {
  ATTACHMENT_EXTENSION_MIME_TYPE_MAP,
  MAX_FILE_ATTACHMENT_SIZE,
  MAX_IMAGE_ATTACHMENT_SIZE,
  MAX_MESSAGE_ATTACHMENTS,
  MAX_MESSAGE_ATTACHMENTS_SIZE,
  MESSAGE_ATTACHMENTS_BUCKET,
  SUPPORTED_IMAGE_MIME_TYPE_SET,
  SUPPORTED_SPREADSHEET_MIME_TYPE_SET,
  SUPPORTED_ATTACHMENT_DESCRIPTION,
  SUPPORTED_STORED_FILE_MIME_TYPE_SET,
  formatAttachmentSize,
  getAttachmentFileExtension,
} from "@/lib/attachment-config";
import {
  type ChatMessageMetadata,
  type MessageAttachment,
  messageAttachmentsSchema,
} from "@/lib/schemas/chat";
import { isFetchNetworkError } from "@/lib/network-errors";

export {
  MAX_MESSAGE_ATTACHMENTS,
  MAX_MESSAGE_ATTACHMENTS_SIZE,
  MESSAGE_ATTACHMENTS_BUCKET,
};

export class AttachmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentValidationError";
  }
}

const ATTACHMENT_DOWNLOAD_RETRY_DELAYS_MS = [300, 900];

export function isSupportedImageMimeType(mimeType: string) {
  return SUPPORTED_IMAGE_MIME_TYPE_SET.has(mimeType);
}

export function isSupportedStoredFileMimeType(mimeType: string) {
  return SUPPORTED_STORED_FILE_MIME_TYPE_SET.has(mimeType);
}

export function isSupportedSpreadsheetMimeType(mimeType: string) {
  return SUPPORTED_SPREADSHEET_MIME_TYPE_SET.has(mimeType);
}

export function isSupportedAttachmentMimeType(mimeType: string) {
  return (
    isSupportedImageMimeType(mimeType) ||
    isSupportedStoredFileMimeType(mimeType) ||
    isSupportedSpreadsheetMimeType(mimeType)
  );
}

export function getAttachmentSizeLimit(mimeType: string) {
  return isSupportedImageMimeType(mimeType)
    ? MAX_IMAGE_ATTACHMENT_SIZE
    : MAX_FILE_ATTACHMENT_SIZE;
}

export function formatAttachmentSizeLimit(size: number) {
  return formatAttachmentSize(size);
}

function getSupportedMimeType(file: File) {
  if (file.type && isSupportedAttachmentMimeType(file.type)) {
    return file.type;
  }

  const mimeTypeFromExtension = ATTACHMENT_EXTENSION_MIME_TYPE_MAP.get(
    getAttachmentFileExtension(file.name),
  );

  return mimeTypeFromExtension ?? file.type ?? "application/octet-stream";
}

function sanitizeFileName(fileName: string) {
  // 原始文件名只用于展示；真正的 Storage key 不再直接拼中文、空格或特殊符号。
  const normalized = fileName.trim().replace(/[\\/:*?"<>|]+/g, "-");
  return normalized.length > 0 ? normalized : "attachment";
}

function createStoragePath(userId: string, fileName: string) {
  const attachmentId = randomUUID();
  const extension = getAttachmentFileExtension(fileName);

  return {
    attachmentId,
    // 目录前缀必须是 userId，后续 RLS / Storage policy 都依赖这个路径隔离用户文件。
    storagePath: `${userId}/drafts/${attachmentId}/attachment${extension}`,
  };
}

function getCsvCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function escapeCsvCell(value: unknown) {
  const text = getCsvCellValue(value);

  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll("\"", "\"\"")}"`;
}

async function convertXlsxBufferToCsv(buffer: Buffer) {
  // read-excel-file 接收 ArrayBuffer；Buffer 不能直接共用底层切片，否则可能带入多余字节。
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  const sheets = await readXlsxFile(arrayBuffer);
  const sheetCsvBlocks = sheets
    // 空行不写入 CSV，避免模型看到大量无意义的逗号。
    .map((sheet) => ({
      name: sheet.sheet,
      rows: sheet.data.filter((row) =>
        row.some((cell) => getCsvCellValue(cell).trim().length > 0),
      ),
    }))
    .filter((sheet) => sheet.rows.length > 0)
    .map((sheet, index) => {
      const rows = sheet.rows.map((row) =>
        row.map((cell) => escapeCsvCell(cell)).join(","),
      );

      if (sheets.length <= 1) {
        return rows.join("\r\n");
      }

      // 多 sheet 文件合成一个文本附件时保留 sheet 名，方便模型理解块之间的来源。
      return [
        `# Sheet: ${sheet.name || `Sheet${index + 1}`}`,
        ...rows,
      ].join("\r\n");
    });
  const csv = sheetCsvBlocks.join("\r\n\r\n");

  if (csv.trim().length === 0) {
    throw new AttachmentValidationError(
      "Excel 转 CSV 失败：没有读取到有效单元格。请确认表格不是空表，或先另存为 CSV 后上传。",
    );
  }

  return Buffer.from(csv, "utf8");
}

export async function prepareAttachmentUpload(file: File) {
  const sourceMimeType = getSupportedMimeType(file);

  if (!isSupportedAttachmentMimeType(sourceMimeType)) {
    throw new AttachmentValidationError(SUPPORTED_ATTACHMENT_DESCRIPTION);
  }

  if (file.size > getAttachmentSizeLimit(sourceMimeType)) {
    throw new AttachmentValidationError(
      `文件大小超过限制：图片不得超过 ${formatAttachmentSizeLimit(MAX_IMAGE_ATTACHMENT_SIZE)}，文件不得超过 ${formatAttachmentSizeLimit(MAX_FILE_ATTACHMENT_SIZE)}。`,
    );
  }

  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  if (isSupportedSpreadsheetMimeType(sourceMimeType)) {
    // xlsx 直接转 CSV：更稳定，也更适合传给文本模型理解表格内容。
    const csvBuffer = await convertXlsxBufferToCsv(sourceBuffer);
    const csvFileName = `${sanitizeFileName(file.name).replace(/\.[^.]+$/, "")}.csv`;

    return {
      buffer: csvBuffer,
      fileName: csvFileName,
      mimeType: "text/csv",
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
  // metadata 可能来自历史消息或浏览器请求，进入业务逻辑前统一过 schema。
  return messageAttachmentsSchema.parse(attachments ?? []);
}

export function assertAttachmentsOwnedByUser(
  userId: string,
  attachments: MessageAttachment[],
) {
  for (const attachment of attachments) {
    if (!isAttachmentStoragePathOwnedByUser(userId, attachment.storagePath)) {
      throw new Error("附件不属于当前用户，无法继续操作。");
    }
  }
}

export function isAttachmentStoragePathOwnedByUser(
  userId: string,
  storagePath: string,
) {
  return (
    // 只允许请求用户的 draft 目录；禁止用 ../ 这类片段越过目录边界。
    storagePath.startsWith(`${userId}/drafts/`) &&
    !storagePath.split("/").includes("..")
  );
}

export function getAttachmentPaths(metadata: ChatMessageMetadata | undefined) {
  return (metadata?.attachments ?? []).map((attachment) => attachment.storagePath);
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

  // 清理失败不应阻断主消息链路，调用方通常会 fire-and-forget 并吞掉错误。
  await supabase.storage.from(MESSAGE_ATTACHMENTS_BUCKET).remove(removablePaths);
}

export async function downloadAttachmentBuffer(
  supabase: SupabaseClient,
  attachment: MessageAttachment,
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const { data, error } = await supabase.storage
        .from(MESSAGE_ATTACHMENTS_BUCKET)
        .download(attachment.storagePath);

      if (error) {
        throw error;
      }

      return Buffer.from(await data.arrayBuffer());
    } catch (error) {
      const retryDelay = ATTACHMENT_DOWNLOAD_RETRY_DELAYS_MS[attempt];

      // 只对网络型失败做短重试；权限、路径、格式错误要尽快暴露给上层。
      if (!isFetchNetworkError(error) || retryDelay === undefined) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

export { buildAttachmentObjectUrl, getAttachmentFileExtension as getFileExtension } from "@/lib/attachment-config";
