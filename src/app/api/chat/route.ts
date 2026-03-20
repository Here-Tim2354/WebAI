import { NextResponse } from "next/server";
import { generateAssistantReply } from "@/lib/ai/gemini";
import { ServerEnvError } from "@/lib/env/server";
import {
  chatRequestSchema,
  chatResponseSchema,
  createChatMessage,
} from "@/lib/schemas/chat";

export async function POST(request: Request) {
  try {
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

    const parsedRequest = chatRequestSchema.safeParse(payload);

    if (!parsedRequest.success) {
      return NextResponse.json(
        {
          error: {
            message: "请求数据格式不正确，请检查消息结构。",
          },
        },
        { status: 400 },
      );
    }

    const { messages } = parsedRequest.data;

    const reply = await generateAssistantReply(messages);

    const responseBody = chatResponseSchema.parse({
      message: createChatMessage({
        role: "assistant",
        content: reply,
        status: "complete",
      }),
    });

    return NextResponse.json(responseBody);
  } catch (error) {
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

    const message =
      error instanceof Error
        ? error.message
        : "Gemini 暂时不可用，请稍后重试。";

    return NextResponse.json(
      {
        error: {
          message,
        },
      },
      { status: 500 },
    );
  }
}
