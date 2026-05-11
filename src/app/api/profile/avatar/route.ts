import { NextResponse } from "next/server";
import { authUserResponseSchema } from "@/lib/schemas/auth";
import { getSupabaseAuthContext, mapAuthUser } from "@/lib/supabase/auth";
import { updateUserProfile } from "@/lib/supabase/profiles";

export const runtime = "nodejs";

const PROFILE_AVATARS_BUCKET = "profile_avatars";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

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

function getAvatarExtension(file: File) {
  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getSupabaseAuthContext();

    if (!user) {
      return unauthorizedResponse();
    }

    const formData = await request.formData();
    const file = formData.get("avatar");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: {
            message: "请选择要上传的头像图片。",
          },
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: {
            message: "头像仅支持 PNG、JPG 或 WebP 图片。",
          },
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json(
        {
          error: {
            message: "头像图片不能超过 2 MB。",
          },
        },
        { status: 400 },
      );
    }

    const storagePath = `${user.id}/avatar-${Date.now()}.${getAvatarExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from(PROFILE_AVATARS_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const profile = await updateUserProfile(supabase, user.id, {
      avatarUrl: storagePath,
    });

    return NextResponse.json(
      authUserResponseSchema.parse({
        user: mapAuthUser(user, profile),
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error && error.message.trim()
              ? error.message
              : "头像上传失败，请稍后再试。",
        },
      },
      { status: 500 },
    );
  }
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
          message: "头像不存在，或你没有访问权限。",
        },
      },
      { status: 404 },
    );
  }

  const { data, error } = await supabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .download(storagePath);

  if (error) {
    return NextResponse.json(
      {
        error: {
          message: "头像不存在，或你没有访问权限。",
        },
      },
      { status: 404 },
    );
  }

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
