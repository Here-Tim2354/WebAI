import { NextResponse } from "next/server";
import {
  MAX_MESSAGE_ATTACHMENTS,
  MAX_MESSAGE_ATTACHMENTS_SIZE,
  MESSAGE_ATTACHMENTS_BUCKET,
  uploadMessageAttachment,
} from "@/lib/attachments";
import { type MessageAttachment } from "@/lib/schemas/chat";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";

export const runtime = "nodejs";

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

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getSupabaseAuthContext();

    if (!user) {
      return unauthorizedResponse();
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: {
            message: "请选择要上传的附件。",
          },
        },
        { status: 400 },
      );
    }

    if (files.length > MAX_MESSAGE_ATTACHMENTS) {
      return NextResponse.json(
        {
          error: {
            message: `每条消息最多添加 ${MAX_MESSAGE_ATTACHMENTS} 个附加项。`,
          },
        },
        { status: 400 },
      );
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    if (totalSize > MAX_MESSAGE_ATTACHMENTS_SIZE) {
      return NextResponse.json(
        {
          error: {
            message: "单条消息附加项总大小不能超过 20MB。",
          },
        },
        { status: 400 },
      );
    }

    const attachments: MessageAttachment[] = [];

    try {
      for (const file of files) {
        attachments.push(await uploadMessageAttachment(supabase, user.id, file));
      }
    } catch (uploadError) {
      const uploadedPaths = attachments.map((attachment) => attachment.storagePath);

      if (uploadedPaths.length > 0) {
        await supabase.storage
          .from(MESSAGE_ATTACHMENTS_BUCKET)
          .remove(uploadedPaths);
      }

      throw uploadError;
    }

    return NextResponse.json({ attachments });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "附件上传失败，请稍后再试。";

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
