import { SupabaseClient } from "@supabase/supabase-js";

export type UserProfile = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export async function getUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      userId,
      displayName: null,
      avatarUrl: null,
    };
  }

  return {
    userId: data.user_id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
  };
}

export async function updateUserProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: {
    displayName?: string | null;
    avatarUrl?: string | null;
  },
) {
  const payload = {
    user_id: userId,
    ...(updates.displayName !== undefined
      ? { display_name: updates.displayName }
      : {}),
    ...(updates.avatarUrl !== undefined ? { avatar_url: updates.avatarUrl } : {}),
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id, display_name, avatar_url")
    .single<ProfileRow>();

  if (error) {
    throw error;
  }

  return {
    userId: data.user_id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
  } satisfies UserProfile;
}
