import { NextResponse } from "next/server";
import { createAssistantStreamResponse } from "@/lib/ai/assistant-stream-response";
import { ServerEnvError } from "@/lib/env/server";
import {
  chatMessageMetadataSchema,
  editMessageRequestSchema,
} from "@/lib/schemas/chat";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import {
  ConversationAccessError,
  getConversationById,
  touchConversation,
  updateConversation,
} from "@/lib/supabase/conversations";
import {
  getEnabledModelById,
  ModelRegistryError,
} from "@/lib/supabase/model-registry";
import {
  assertAttachmentsOwnedByUser,
  cleanupUnreferencedAttachments,
  getAttachmentPaths,
  normalizeMessageAttachments,
} from "@/lib/attachments";
import {
  deleteConversationMessagesById,
  editUserMessageAndDeleteFollowing,
  getConversationMessage,
  listConversationMessages,
  updateConversationMessage,
} from "@/lib/supabase/messages";

type RouteContext = {
  params: Promise<{
    messageId: string;
  }>;
};

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: {
        message: "请先登录后再继续。",
      },
    },
    { status: 401 },
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return fallback;
}

function handleMessageError(error: unknown) {
  if (error instanceof ConversationAccessError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
        },
      },
      { status: 404 },
    );
  }

  if (error instanceof ServerEnvError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
        },
      },
      { status: 500 },
    );
  }

  if (error instanceof ModelRegistryError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
        },
      },
      { status: 400 },
    );
  }

  const message = getErrorMessage(error, "消息操作失败，请稍后再试。");

  return NextResponse.json(
    {
      error: {
        message,
      },
    },
    { status: 500 },
  );
}

/**
 * 编辑 user 消息采用覆盖式语义：
 * 原子更新目标消息并移除后续上下文，然后立即创建新的 assistant 流式回复。
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getSupabaseAuthContext();

    if (!user) {
      return unauthorizedResponse();
    }

    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            message: "请求体必须是合法 JSON。",
          },
        },
        { status: 400 },
      );
    }

    const parsed = editMessageRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: parsed.error.issues[0]?.message ?? "消息编辑参数不正确。",
          },
        },
        { status: 400 },
      );
    }

    const { messageId } = await context.params;
    const { conversationId, content, modelId, urls, attachments } = parsed.data;
    let conversation = await getConversationById(
      supabase,
      user.id,
      conversationId,
    );
    const previousMessages = await listConversationMessages(
      supabase,
      conversationId,
    );
    const targetMessage = await getConversationMessage(
      supabase,
      conversationId,
      messageId,
    );
    const targetMessageIndex = previousMessages.findIndex(
      (message) => message.id === messageId,
    );

    if (targetMessage.sender_type !== "user") {
      return NextResponse.json(
        {
          error: {
            message: "只能编辑你发送的消息。",
          },
        },
        { status: 400 },
      );
    }

    if (modelId && conversation.modelId !== modelId) {
      conversation = await updateConversation(supabase, user.id, conversationId, {
        modelId,
      });
    }

    const currentMetadata = chatMessageMetadataSchema.parse(
      targetMessage.metadata ?? {},
    );
    const nextMetadata =
      urls === undefined && attachments === undefined
        ? currentMetadata
        : {
            ...currentMetadata,
            ...(urls !== undefined ? { urls } : {}),
            ...(attachments !== undefined
              ? { attachments: normalizeMessageAttachments(attachments) }
              : {}),
          };
    const effectiveModelId = modelId ?? conversation.modelId;
    const selectedModel = effectiveModelId
      ? await getEnabledModelById(supabase, effectiveModelId)
      : null;

    if (nextMetadata.attachments && nextMetadata.attachments.length > 0) {
      assertAttachmentsOwnedByUser(user.id, nextMetadata.attachments);
    }

    if (nextMetadata.attachments && nextMetadata.attachments.length > 0 && selectedModel) {
      const hasImageAttachment = nextMetadata.attachments.some(
        (attachment) => attachment.kind === "image",
      );
      const hasFileAttachment = nextMetadata.attachments.some(
        (attachment) => attachment.kind === "file",
      );

      if (hasImageAttachment && !selectedModel.capabilities.image) {
        throw new ModelRegistryError("当前模型不支持图片输入。");
      }

      if (hasFileAttachment && !selectedModel.capabilities.files) {
        throw new ModelRegistryError("当前模型不支持文件输入。");
      }
    }

    if (targetMessageIndex === -1) {
      throw new Error("消息不存在，或你没有访问权限。");
    }

    const followingMessageIds = previousMessages
      .slice(targetMessageIndex + 1)
      .map((message) => message.id);

    try {
      await editUserMessageAndDeleteFollowing(
        supabase,
        conversationId,
        messageId,
        content,
        nextMetadata,
      );
    } catch {
      await updateConversationMessage(
        supabase,
        conversationId,
        messageId,
        {
          content,
          metadata: nextMetadata,
          status: "complete",
        },
      );
      await deleteConversationMessagesById(
        supabase,
        conversationId,
        followingMessageIds,
      );
    }
    const previousAttachments =
      previousMessages
        .slice(targetMessageIndex)
        .flatMap((message) => message.metadata.attachments ?? []);
    void cleanupUnreferencedAttachments(
      supabase,
      previousAttachments.filter(
        (attachment) =>
          !getAttachmentPaths(nextMetadata).includes(attachment.storagePath),
      ),
    ).catch(() => null);
    conversation = await touchConversation(
      supabase,
      user.id,
      conversationId,
    );
    const messagesForModel = await listConversationMessages(
      supabase,
      conversationId,
    );

    return createAssistantStreamResponse({
      supabase,
      userId: user.id,
      conversation,
      messagesForModel,
      model: selectedModel,
      urls: nextMetadata.urls,
      attachments: nextMetadata.attachments,
      requestSignal: request.signal,
    });
  } catch (error) {
    return handleMessageError(error);
  }
}
