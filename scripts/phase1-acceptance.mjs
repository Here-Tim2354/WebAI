import http from "node:http";
import { spawn, spawnSync } from "node:child_process";

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

async function getAvailablePort() {
  const server = http.createServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, resolve);
  });

  const address = server.address();
  const port =
    address && typeof address === "object" ? address.port : undefined;

  await closeServer(server);

  if (!port) {
    throw new Error("无法分配可用端口。");
  }

  return port;
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
  const nextPort = await getAvailablePort();

  await new Promise((resolve, reject) => {
    mockServer.once("error", reject);
    mockServer.listen(0, HOST, resolve);
  });

  const mockAddress = mockServer.address();
  const mockPort =
    mockAddress && typeof mockAddress === "object" ? mockAddress.port : undefined;

  if (!mockPort) {
    throw new Error("无法启动 Gemini mock 服务。");
  }

  try {
    nextServer = startProcess(
      NODE_EXE,
      [NEXT_BIN, "start", "--port", String(nextPort)],
      {
        env: {
          ...process.env,
          PORT: String(nextPort),
          GEMINI_API_KEY: "phase1-local-mock-key",
          GEMINI_MODEL: "gemini-2.5-flash",
          GEMINI_BASE_URL: `http://${HOST}:${mockPort}`,
        },
      },
    );

    const homeResponse = await waitForHttp(`http://${HOST}:${nextPort}/`);
    const homeHtml = await homeResponse.text();

    assert(homeHtml.includes("WebAI"), "首页没有渲染 WebAI 标识。");
    assert(
      homeHtml.includes("你好，今天想聊点什么？"),
      "首页没有渲染当前空态问候语。",
    );
    assert(homeHtml.includes("发一条消息..."), "首页没有渲染输入区占位。");
    assert(
      homeHtml.includes("产品") &&
        homeHtml.includes("代码") &&
        homeHtml.includes("计划") &&
        homeHtml.includes("文档"),
      "首页没有渲染当前的轻量分组入口。",
    );
    assert(
      !homeHtml.includes("Search chats") &&
        !homeHtml.includes("Images") &&
        !homeHtml.includes("Projects"),
      "首页仍然暴露了过时的伪功能入口。",
    );

    const successResponse = await fetch(`http://${HOST}:${nextPort}/api/chat`, {
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
      `http://${HOST}:${nextPort}/api/chat`,
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
      `http://${HOST}:${nextPort}/api/chat`,
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
  const basePort = await getAvailablePort();
  const cases = [
    {
      port: basePort,
      env: {
        GEMINI_API_KEY: "",
        GEMINI_MODEL: "gemini-2.5-flash",
        GEMINI_BASE_URL: "",
      },
      expectedMessage: "GEMINI_API_KEY",
      label: "缺少 GEMINI_API_KEY",
    },
    {
      port: basePort + 1,
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
