import { type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { MESSAGE_ATTACHMENTS_BUCKET } from "@/lib/attachment-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";

const PROFILE_AVATARS_BUCKET = "profile_avatars";
const STORAGE_DELETE_BATCH_SIZE = 100;

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

type StorageListItem = {
  id?: string | null;
  name: string;
  metadata?: unknown;
};

async function listUserStoragePaths(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
) {
  const paths: string[] = [];
  const folders = [prefix];

  while (folders.length > 0) {
    const folder = folders.pop();

    if (!folder) {
      continue;
    }

    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit: 1000,
    });

    if (error) {
      throw error;
    }

    for (const item of (data ?? []) as StorageListItem[]) {
      const itemPath = `${folder}/${item.name}`;

      if (item.id || item.metadata) {
        paths.push(itemPath);
      } else {
        folders.push(itemPath);
      }
    }
  }

  return paths;
}

async function removeUserStorageObjects(
  supabase: SupabaseClient,
  bucket: string,
  userId: string,
) {
  const paths = await listUserStoragePaths(supabase, bucket, userId);

  for (let index = 0; index < paths.length; index += STORAGE_DELETE_BATCH_SIZE) {
    const batch = paths.slice(index, index + STORAGE_DELETE_BATCH_SIZE);
    const { error } = await supabase.storage.from(bucket).remove(batch);

    if (error) {
      throw error;
    }
  }
}

export async function DELETE() {
  try {
    const { supabase, user } = await getSupabaseAuthContext();

    if (!user) {
      return unauthorizedResponse();
    }

    const admin = createSupabaseAdminClient();

    await Promise.all([
      removeUserStorageObjects(admin, PROFILE_AVATARS_BUCKET, user.id),
      removeUserStorageObjects(admin, MESSAGE_ATTACHMENTS_BUCKET, user.id),
    ]);

    const { error } = await admin.auth.admin.deleteUser(user.id);

    if (error) {
      throw error;
    }

    await supabase.auth.signOut();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error && error.message.trim()
              ? error.message
              : "账户注销失败，请稍后再试。",
        },
      },
      { status: 500 },
    );
  }
}
