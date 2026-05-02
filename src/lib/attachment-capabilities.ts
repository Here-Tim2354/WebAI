import { assertAttachmentsOwnedByUser } from "@/lib/attachments";
import { type MessageAttachment } from "@/lib/schemas/chat";
import {
  ModelRegistryError,
  type RuntimeAIModel,
} from "@/lib/supabase/model-registry";

export function assertAttachmentInputAllowed({
  userId,
  attachments,
  model,
}: {
  userId: string;
  attachments: MessageAttachment[];
  model: RuntimeAIModel | null;
}) {
  if (attachments.length === 0) {
    return;
  }

  // metadata 来自浏览器请求，不能只信任前端传回的 storagePath。
  // 先确认对象路径落在当前用户目录下，再继续做模型能力判断。
  assertAttachmentsOwnedByUser(userId, attachments);

  if (!model) {
    return;
  }

  // 附件能力是模型注册表的一部分。这里集中守住 API 边界，
  // 避免发送、编辑、重新生成三条链路各自复制一套判断。
  const hasImageAttachment = attachments.some(
    (attachment) => attachment.kind === "image",
  );
  const hasFileAttachment = attachments.some(
    (attachment) => attachment.kind === "file",
  );

  if (hasImageAttachment && !model.capabilities.image) {
    throw new ModelRegistryError("当前模型不支持图片输入。");
  }

  if (hasFileAttachment && !model.capabilities.files) {
    throw new ModelRegistryError("当前模型不支持文件输入。");
  }
}
