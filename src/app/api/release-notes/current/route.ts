import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { CURRENT_RELEASE_NOTE } from "@/lib/release-notes";

export const runtime = "nodejs";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), CURRENT_RELEASE_NOTE.sourcePath);
    const content = await readFile(filePath, "utf8");

    return NextResponse.json({
      ...CURRENT_RELEASE_NOTE,
      content,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error && error.message.trim()
              ? error.message
              : "更新日志读取失败。",
        },
      },
      { status: 500 },
    );
  }
}
