import { NextResponse } from "next/server";
import { createAssistantStreamResponse } from "@/lib/ai/assistant-stream-response";
import { assertAttachmentInputAllowed } from "@/lib/attachment-capabilities";
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
    const { conversationId, content, modelId, thinkingLevel, urls, attachments } =
      parsed.data;
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

    if (
      (modelId && conversation.modelId !== modelId) ||
      (
        thinkingLevel !== undefined &&
        conversation.thinkingLevel !== thinkingLevel
      )
    ) {
      conversation = await updateConversation(supabase, user.id, conversationId, {
        modelId,
        thinkingLevel,
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
    // modelId 可能在编辑时一并切换，附件能力校验必须基于最终会话模型。
    const effectiveModelId = modelId ?? conversation.modelId;
    const selectedModel = effectiveModelId
      ? await getEnabledModelById(supabase, effectiveModelId)
      : null;

    // 编辑带附件消息时，前端传回的是 metadata 引用。
    // 服务端必须重新确认路径归属和模型能力，不能只信任已上传成功。
    assertAttachmentInputAllowed({
      userId: user.id,
      attachments: nextMetadata.attachments ?? [],
      model: selectedModel,
    });

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
      // RPC 是首选原子路径；fallback 保证远端函数异常时仍能完成“更新目标消息 + 删除后续”。
      // fallback 不是严格事务，但能避免整个编辑链路被单个 RPC 问题卡死。
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
      thinkingLevel: conversation.thinkingLevel,
      urls: nextMetadata.urls,
      attachments: nextMetadata.attachments,
      requestSignal: request.signal,
    });
  } catch (error) {
    return handleMessageError(error);
  }
}
