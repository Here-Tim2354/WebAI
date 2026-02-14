package com.tim.webai.javabackend.controller;

import com.tim.webai.javabackend.adapter.PythonAdapter;
import com.tim.webai.javabackend.model.dto.python.PythonChatRequest;
import com.tim.webai.javabackend.model.dto.python.PythonChatResponse;
import com.tim.webai.javabackend.service.ChatService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 验证聊天 POST 接口在仅提供 user_input 时的行为：
 * 使用 MockMvc 模拟 HTTP 调用，使用 StubPythonAdapter 隔离外部依赖，
 * 预期返回 200 + 正确响应体，并向 Python 层传递默认模型与正确入参。
 */
class ChatControllerPostOnlyUserInputTest {

    @Test
    void shouldReturnModelReplyTextWhenReactPostHasOnlyUserInput() throws Exception {
        // Arrange: 准备一个固定的 Python 返回，避免真实网络调用。
        String expectedReply = "only model reply text";
        PythonChatResponse pythonResponse = pythonResponseWithText(expectedReply);
        StubPythonAdapter stubPythonAdapter = new StubPythonAdapter(pythonResponse);

        // 组装真实的 Controller + Service，只替换最外部依赖（PythonAdapter）。
        ChatService chatService = new ChatService(stubPythonAdapter, "gemini-3-flash-preview");
        ChatController chatController = new ChatController(chatService);
        // MockMvc 用于模拟 HTTP 请求，不需要启动 Web 服务器。
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(chatController).build();

        // Act + Assert: 模拟前端 POST，并校验接口响应契约。
        MvcResult mvcResult = mockMvc.perform(
                post("/api/v1/chat/completions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "user_input": "hello from react"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {
                          "content": "only model reply text",
                          "status": "ok"
                        }
                        """))
                .andReturn();

        // 额外校验：确认 Service 组装给 Python 层的请求字段正确。
        PythonChatRequest captured = stubPythonAdapter.capturedRequest();
        assertNotNull(captured);
        assertEquals("gemini-3-flash-preview", captured.model());
        assertEquals("hello from react", captured.userInput());
        assertNull(captured.customSettings());
        assertNull(captured.config());

        System.out.println("[SUCCESS] ChatControllerPostOnlyUserInputTest.shouldReturnModelReplyTextWhenReactPostHasOnlyUserInput");
        System.out.println("[RESPONSE_CONTENT] " + mvcResult.getResponse().getContentAsString());
    }

    private static PythonChatResponse pythonResponseWithText(String text) {
        // 构造最小可用响应结构，只保留 modelReplyText() 解析所需字段。
        return new PythonChatResponse(
                null,
                List.of(
                        new PythonChatResponse.Candidate(
                                new PythonChatResponse.Content(
                                        List.of(
                                                new PythonChatResponse.Part(
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        null,
                                                        text,
                                                        null,
                                                        null,
                                                        null)),
                                        "model"),
                                null,
                                null,
                                null,
                                "STOP",
                                null,
                                null,
                                0,
                                null,
                                null,
                                null)),
                null,
                "gemini-3-flash-preview",
                null,
                "response-id",
                null,
                List.of(),
                null);
    }

    private static final class StubPythonAdapter extends PythonAdapter {
        private final PythonChatResponse response;
        private PythonChatRequest capturedRequest;

        private StubPythonAdapter(PythonChatResponse response) {
            super(WebClient.builder(), "http://127.0.0.1:5000", "/api/v1/chat/completions");
            this.response = response;
        }

        @Override
        public PythonChatResponse ask(PythonChatRequest request) {
            // 记录入参供断言，并返回预设响应。
            this.capturedRequest = request;
            return response;
        }

        private PythonChatRequest capturedRequest() {
            return capturedRequest;
        }
    }
}
