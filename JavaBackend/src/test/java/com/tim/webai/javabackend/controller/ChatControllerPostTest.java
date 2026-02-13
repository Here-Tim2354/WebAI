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

class ChatControllerPostTest {

    @Test
    void shouldReturnModelReplyTextWhenReactPostHasOnlyUserInput() throws Exception {
        String expectedReply = "only model reply text";
        PythonChatResponse pythonResponse = pythonResponseWithText(expectedReply);
        StubPythonAdapter stubPythonAdapter = new StubPythonAdapter(pythonResponse);

        ChatService chatService = new ChatService(stubPythonAdapter, "gemini-3-flash-preview");
        ChatController chatController = new ChatController(chatService);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(chatController).build();

        mockMvc.perform(
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
                        """));

        PythonChatRequest captured = stubPythonAdapter.capturedRequest();
        assertNotNull(captured);
        assertEquals("gemini-3-flash-preview", captured.model());
        assertEquals("hello from react", captured.userInput());
        assertNull(captured.customSettings());
        assertNull(captured.config());
    }

    private static PythonChatResponse pythonResponseWithText(String text) {
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
            this.capturedRequest = request;
            return response;
        }

        private PythonChatRequest capturedRequest() {
            return capturedRequest;
        }
    }
}
