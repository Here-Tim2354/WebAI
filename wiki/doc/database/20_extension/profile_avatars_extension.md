# Profile Avatars Extension

需求基线：

- [[plan/phase/phase_overview|phase_overview]]

## 作用范围

个人资料扩展用于承接用户展示名称和头像。

相关对象：

- `profiles.display_name`：用户在界面中展示的名称
- `profiles.avatar_url`：头像 Storage 路径
- `profile_avatars`：私有头像 Storage bucket

## Storage 设计

`profile_avatars` 是私有 bucket。

头像对象路径以用户 ID 作为第一层目录：

```text
<user_id>/avatar-<timestamp>.<ext>
```

这样可以让 Storage policy 使用目录前缀判断对象归属，避免不同用户读取或覆盖彼此头像。

## 文件限制

头像上传限制：

- PNG
- JPEG
- WebP
- 最大 2 MB

云端核对：

- `2026-05-20` 已通过 Supabase CLI 确认 `profile_avatars` bucket 存在
- `public = false`
- bucket 类型为 `STANDARD`
- `file_size_limit = 2097152`
- `allowed_mime_types = {image/png,image/jpeg,image/webp}`
- Storage policy 已按 `storage.foldername(name)[1] = auth.uid()` 做用户目录隔离

浏览器读取头像时不直接暴露公开 bucket，而是通过 `/api/profile/avatar?path=...` 代理下载。接口会检查路径是否位于当前用户目录下。

## 接口映射

| 能力 | 接口 | 数据对象 |
| --- | --- | --- |
| 读取个人资料 | `GET /api/profile` | `profiles` |
| 修改昵称 | `PATCH /api/profile` | `profiles.display_name` |
| 上传头像 | `POST /api/profile/avatar` | `profile_avatars`, `profiles.avatar_url` |
| 读取头像 | `GET /api/profile/avatar` | `profile_avatars` |
| 修改密码 | `PATCH /api/profile/password` | `auth.users` |

## 继续观察

- 头像上传后旧对象不会自动清理；后续如头像频繁替换，可以补后台清理策略。
- `profiles` 仍只保存展示资料，不承担认证主表职责。
