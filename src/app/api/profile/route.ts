import { NextResponse } from "next/server";
import { z } from "zod";
import { authUserResponseSchema } from "@/lib/schemas/auth";
import { getSupabaseAuthContext, mapAuthUser } from "@/lib/supabase/auth";
import { getUserProfile, updateUserProfile } from "@/lib/supabase/profiles";

const updateProfileRequestSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(100, "昵称不能超过 100 个字符。")
    .nullable()
    .optional(),
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

    const body = updateProfileRequestSchema.parse(await request.json());
    const profile = await updateUserProfile(supabase, user.id, {
      displayName: body.displayName?.trim() || null,
    });

    return NextResponse.json(
      authUserResponseSchema.parse({
        user: mapAuthUser(user, profile),
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            message: error.issues[0]?.message ?? "资料格式不正确。",
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
              : "资料保存失败，请稍后再试。",
        },
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  const { supabase, user } = await getSupabaseAuthContext();

  if (!user) {
    return unauthorizedResponse();
  }

  const profile = await getUserProfile(supabase, user.id);

  return NextResponse.json(
    authUserResponseSchema.parse({
      user: mapAuthUser(user, profile),
    }),
  );
}
