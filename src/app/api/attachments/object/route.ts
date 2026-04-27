import { NextResponse } from "next/server";
import { MESSAGE_ATTACHMENTS_BUCKET } from "@/lib/attachments";
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const storagePath = searchParams.get("path") ?? "";
  const { supabase, user } = await getSupabaseAuthContext();

  if (!user) {
    return unauthorizedResponse();
  }

  if (!storagePath || !storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json(
      {
        error: {
          message: "附件不存在，或你没有访问权限。",
        },
      },
      { status: 404 },
    );
  }

  const { data, error } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .download(storagePath);

  if (error) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
        },
      },
      { status: 404 },
    );
  }

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}
