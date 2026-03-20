import http from "node:http";
import { spawn, spawnSync } from "node:child_process";

const NEXT_PORT = 3100;
const MOCK_PORT = 4318;
const HOST = "127.0.0.1";
const NODE_EXE = `${process.env.ProgramFiles}\\nodejs\\node.exe`;
const NEXT_BIN = "node_modules/next/dist/bin/next";

const mockReply = [
  "# Mock reply",
  "",
  "这是本地 Phase 1 验收用的 Gemini mock。",
  "",
  "```ts",
  "export function sum(a: number, b: number) {",
  "  return a + b;",
  "}",
  "```",
].join("\n");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockGeminiServer() {
  return http.createServer(async (request, response) => {
    if (!request.url?.includes(":generateContent")) {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "not found" }));
      return;
    }

    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const requestBody = Buffer.concat(chunks).toString("utf8");
    const parsed = JSON.parse(requestBody);
    const lastUserPart =
      parsed.contents?.[parsed.contents.length - 1]?.parts?.[0]?.text ?? "";

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: `${mockReply}\n\n用户最后一条消息：${lastUserPart}`,
                },
              ],
              role: "model",
            },
          },
        ],
      }),
    );
  });
}

function startProcess(command, args, options) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  let output = "";

  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  child.on("error", (error) => {
    output += `${error.stack ?? error.message}\n`;
  });

  return {
    child,
    getOutput() {
      return output;
    },
  };
}

async function waitForHttp(url, expectedStatus = 200) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 30000) {
    try {
      const response = await fetch(url);
      if (response.status === expectedStatus) {
        return response;
      }
      lastError = new Error(`unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(500);
  }

  throw lastError ?? new Error(`failed to reach ${url}`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    child.kill("SIGTERM");
  }

  const startedAt = Date.now();
  while (child.exitCode === null && Date.now() - startedAt < 5000) {
    await sleep(100);
  }

  if (child.exitCode === null && process.platform !== "win32") {
    child.kill("SIGKILL");
  }
}

async function closeServer(server) {
  if (!server?.listening) {
    return;
  }

  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runSuccessfulFlowChecks() {
  const mockServer = createMockGeminiServer();
  let nextServer;

  await new Promise((resolve) => mockServer.listen(MOCK_PORT, HOST, resolve));

  try {
    nextServer = startProcess(
      NODE_EXE,
      [NEXT_BIN, "start", "--port", String(NEXT_PORT)],
      {
        env: {
          ...process.env,
          PORT: String(NEXT_PORT),
          GEMINI_API_KEY: "phase1-local-mock-key",
          GEMINI_MODEL: "gemini-2.5-flash",
          GEMINI_BASE_URL: `http://${HOST}:${MOCK_PORT}`,
        },
      },
    );

    const homeResponse = await waitForHttp(`http://${HOST}:${NEXT_PORT}/`);
    const homeHtml = await homeResponse.text();

    assert(homeHtml.includes("WebAI"), "首页没有渲染 WebAI 标识。");
    assert(homeHtml.includes("Ask anything"), "首页没有渲染输入区空态。");
    assert(
      !homeHtml.includes("Search chats") &&
        !homeHtml.includes("Images") &&
        !homeHtml.includes("Projects"),
      "首页仍然暴露了 Phase 1 之外的伪功能入口。",
    );

    const successResponse = await fetch(`http://${HOST}:${NEXT_PORT}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            id: "user-1",
            role: "user",
            content: "请给我一个 TypeScript 示例",
            parts: [{ type: "text", text: "请给我一个 TypeScript 示例" }],
            status: "complete",
          },
        ],
      }),
    });

    assert(successResponse.status === 200, "合法聊天请求没有返回 200。");

    const successPayload = await successResponse.json();
    assert(
      successPayload.message?.role === "assistant",
      "聊天接口没有返回 assistant 消息。",
    );
    assert(
      successPayload.message?.status === "complete",
      "聊天接口返回的 assistant 状态不是 complete。",
    );
    assert(
      successPayload.message?.content.includes("Mock reply"),
      "聊天接口没有返回 mock Gemini 文本。",
    );

    const invalidJsonResponse = await fetch(
      `http://${HOST}:${NEXT_PORT}/api/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{bad json",
      },
    );
    assert(invalidJsonResponse.status === 400, "非法 JSON 没有返回 400。");

    const invalidSchemaResponse = await fetch(
      `http://${HOST}:${NEXT_PORT}/api/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: [] }),
      },
    );
    assert(
      invalidSchemaResponse.status === 400,
      "非法消息结构没有返回 400。",
    );
  } finally {
    await stopProcess(nextServer?.child);
    await closeServer(mockServer);
  }
}

async function runServerEnvChecks() {
  const cases = [
    {
      port: 3101,
      env: {
        GEMINI_API_KEY: "",
        GEMINI_MODEL: "gemini-2.5-flash",
        GEMINI_BASE_URL: "",
      },
      expectedMessage: "GEMINI_API_KEY",
      label: "缺少 GEMINI_API_KEY",
    },
    {
      port: 3102,
      env: {
        GEMINI_API_KEY: "phase1-local-mock-key",
        GEMINI_MODEL: "gemini-2.5-flash",
        GEMINI_BASE_URL: "not-a-url",
      },
      expectedMessage: "GEMINI_BASE_URL",
      label: "非法 GEMINI_BASE_URL",
    },
  ];

  for (const testCase of cases) {
    let nextServer;

    try {
      nextServer = startProcess(
        NODE_EXE,
        [NEXT_BIN, "start", "--port", String(testCase.port)],
        {
          env: {
            ...process.env,
            PORT: String(testCase.port),
            ...testCase.env,
          },
        },
      );

      await waitForHttp(`http://${HOST}:${testCase.port}/`);

      const response = await fetch(`http://${HOST}:${testCase.port}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              id: "user-1",
              role: "user",
              content: "hello",
              parts: [{ type: "text", text: "hello" }],
              status: "complete",
            },
          ],
        }),
      });

      assert(response.status === 500, `${testCase.label} 没有返回 500。`);

      const payload = await response.json();
      assert(
        String(payload.error?.message ?? "").includes(testCase.expectedMessage),
        `${testCase.label} 没有返回清晰的环境变量报错。`,
      );
    } finally {
      await stopProcess(nextServer?.child);
    }
  }
}

async function main() {
  console.log("Running Phase 1 acceptance checks...");
  await runSuccessfulFlowChecks();
  await runServerEnvChecks();
  console.log("Phase 1 acceptance checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
