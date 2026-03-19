import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { generateAssistantReply } from "@/lib/ai/gemini";
import {
  chatRequestSchema,
  chatResponseSchema,
  createChatMessage,
} from "@/lib/schemas/chat";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { messages } = chatRequestSchema.parse(payload);

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
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            message: "请求数据格式不正确，请检查消息结构。",
          },
        },
        { status: 400 },
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
