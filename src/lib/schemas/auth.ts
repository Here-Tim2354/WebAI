import { z } from "zod";

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const authUserResponseSchema = z.object({
  user: authUserSchema.nullable(),
});

export const sendMagicLinkRequestSchema = z.object({
  email: z.string().trim().email("请输入合法的邮箱地址。"),
});

export const signInWithPasswordRequestSchema = z.object({
  email: z.string().trim().email("请输入合法的邮箱地址。"),
  password: z.string().min(1, "请输入密码。"),
});

export type AuthUser = z.infer<typeof authUserSchema>;
