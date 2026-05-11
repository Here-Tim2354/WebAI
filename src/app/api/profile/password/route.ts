import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";

const updatePasswordRequestSchema = z.object({
  password: z
    .string()
    .min(8, "密码至少需要 8 个字符。")
    .max(72, "密码不能超过 72 个字符。"),
});

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

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await getSupabaseAuthContext();

    if (!user) {
      return unauthorizedResponse();
    }

    const body = updatePasswordRequestSchema.parse(await request.json());
    const { error } = await supabase.auth.updateUser({
      password: body.password,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            message: error.issues[0]?.message ?? "密码格式不正确。",
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error && error.message.trim()
              ? error.message
              : "密码修改失败，请稍后再试。",
        },
      },
      { status: 500 },
    );
  }
}
