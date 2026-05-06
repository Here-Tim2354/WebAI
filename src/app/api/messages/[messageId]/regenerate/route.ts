import { NextResponse } from "next/server";
import { createAssistantStreamResponse } from "@/lib/ai/assistant-stream-response";
import { assertAttachmentInputAllowed } from "@/lib/attachment-capabilities";
import { ServerEnvError } from "@/lib/env/server";
import { getNetworkErrorMessage } from "@/lib/network-errors";
import { regenerateAssistantMessageRequestSchema } from "@/lib/schemas/chat";
import {
  cleanupUnreferencedAttachments,
  getAttachmentPaths,
  normalizeMessageAttachments,
} from "@/lib/attachments";
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
  deleteConversationMessagesById,
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

function handleRegenerateError(error: unknown) {
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

  const message =
    getNetworkErrorMessage(
      error,
      "云端连接暂时不稳定，重新生成失败。请稍后重试。",
    ) ??
    (error instanceof Error
      ? error.message
      : "重新生成失败，请稍后再试。");

  return NextResponse.json(
    {
      error: {
        message,
      },
    },
    { status: 500 },
  );
}

export async function POST(request: Request, context: RouteContext) {
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

    const parsed = regenerateAssistantMessageRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message:
              parsed.error.issues[0]?.message ?? "重新生成参数不正确。",
          },
        },
        { status: 400 },
      );
    }

    const { messageId } = await context.params;
    const {
      conversationId,
      modelId,
      thinkingLevel,
      webSearchEnabled,
      urls,
      attachments,
      geminiRuntimeConfig,
    } =
      parsed.data;

    if (!geminiRuntimeConfig?.apiKey?.trim()) {
      return NextResponse.json(
        {
          error: {
            message: "请先在 Gemini 设置中填写 API Key。",
          },
        },
        { status: 400 },
      );
    }
    let conversation = await getConversationById(
      supabase,
      user.id,
      conversationId,
    );
    const messages = await listConversationMessages(supabase, conversationId);
    const targetMessageIndex = messages.findIndex(
      (message) => message.id === messageId,
    );

    if (targetMessageIndex === -1) {
      return NextResponse.json(
        {
          error: {
            message: "消息不存在，或你没有访问权限。",
          },
        },
        { status: 404 },
      );
    }

    const targetMessage = messages[targetMessageIndex];

    if (targetMessage.role !== "assistant") {
      return NextResponse.json(
        {
          error: {
            message: "只能重新生成 assistant 消息。",
          },
        },
        { status: 400 },
      );
    }

    if (targetMessageIndex !== messages.length - 1) {
      return NextResponse.json(
        {
          error: {
            message: "仅最新对话可重新生成。",
          },
        },
        { status: 400 },
      );
    }

    if (
      targetMessage.status === "pending" ||
      targetMessage.status === "streaming"
    ) {
      return NextResponse.json(
        {
          error: {
            message: "消息生成完成后才能重新生成。",
          },
        },
        { status: 400 },
      );
    }

    const messagesForModel = messages.slice(0, targetMessageIndex);

    if (messagesForModel.length === 0) {
      return NextResponse.json(
        {
          error: {
            message: "没有可用于重新生成的上下文。",
          },
        },
        { status: 400 },
      );
    }

    const previousUserMessage = [...messagesForModel]
      .reverse()
      .find((message) => message.role === "user");

    if (!previousUserMessage) {
      return NextResponse.json(
        {
          error: {
            message: "没有可用于重新生成的用户消息。",
          },
        },
        { status: 400 },
      );
    }

    const effectiveUrls = urls ?? previousUserMessage.metadata.urls;
    const nextPreviousUserMetadata =
      urls !== undefined || attachments !== undefined
        ? {
            ...previousUserMessage.metadata,
            ...(urls !== undefined ? { urls } : {}),
            ...(attachments !== undefined
              ? { attachments: normalizeMessageAttachments(attachments) }
              : {}),
          }
        : previousUserMessage.metadata;

    const effectiveModelId = modelId ?? conversation.modelId;
    const selectedModel = effectiveModelId
      ? await getEnabledModelById(supabase, user.id, effectiveModelId)
      : null;

    // 重新生成可以顺手修改会话模型 / 联网开关。模型要先校验，避免会话被写入无效 modelId。
    if (
      (modelId && conversation.modelId !== modelId) ||
      (
        thinkingLevel !== undefined &&
        conversation.thinkingLevel !== thinkingLevel
      ) ||
      (
        webSearchEnabled !== undefined &&
        conversation.webSearchEnabled !== webSearchEnabled
      )
    ) {
      conversation = await updateConversation(
        supabase,
        user.id,
        conversationId,
        {
          modelId: modelId ?? undefined,
          thinkingLevel,
          webSearchEnabled,
        },
      );
    }
    const effectiveAttachments = nextPreviousUserMetadata.attachments ?? [];

    // 重新生成复用上一条 user 消息的附件上下文；
    // 如果本次请求覆盖了附件，也要按新 metadata 重新检查权限和模型能力。
    assertAttachmentInputAllowed({
      userId: user.id,
      attachments: effectiveAttachments,
      model: selectedModel,
    });

    if (urls !== undefined || attachments !== undefined) {
      // URL / 附件覆盖不只是临时请求参数，也会写回上一条 user 消息，
      // 这样刷新页面或之后分支时仍能看到同一份上下文。
      await updateConversationMessage(
        supabase,
        conversationId,
        previousUserMessage.id,
        {
          metadata: nextPreviousUserMetadata,
        },
      );
      const previousAttachments =
        previousUserMessage.metadata.attachments ?? [];
      previousUserMessage.metadata = {
        ...nextPreviousUserMetadata,
      };
      void cleanupUnreferencedAttachments(
        supabase,
        previousAttachments.filter(
          (attachment) =>
            !getAttachmentPaths(nextPreviousUserMetadata).includes(attachment.storagePath),
        ),
      ).catch(() => null);
    }

    await deleteConversationMessagesById(supabase, conversationId, [messageId]);
    conversation = await touchConversation(supabase, user.id, conversationId);

    return createAssistantStreamResponse({
      supabase,
      userId: user.id,
      conversation,
      messagesForModel,
      model: selectedModel,
      thinkingLevel: conversation.thinkingLevel,
      geminiRuntimeConfig,
      urls: effectiveUrls,
      attachments: effectiveAttachments,
      requestSignal: request.signal,
    });
  } catch (error) {
    return handleRegenerateError(error);
  }
}
