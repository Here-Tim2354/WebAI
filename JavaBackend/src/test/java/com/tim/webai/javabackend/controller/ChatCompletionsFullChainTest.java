package com.tim.webai.javabackend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * 全链路测试：通过真实 HTTP 调用 Java 接口，验证 React -> Java -> Python 链路可返回文本结果。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ChatCompletionsFullChainTest {

    @LocalServerPort
    private int port;

    @Test
    void shouldReturnModelTextFromFullChain() {
        String userInput = System.getProperty("chat.test.user-input", "你好");
        String model = System.getProperty("chat.test.model", "gemini-3-flash-preview");

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("user_input", userInput);
        payload.put("model", model);

        WebClient client = WebClient.builder()
                .baseUrl("http://127.0.0.1:" + port)
                .build();

        try {
            ChatApiResponse response = client.post()
                    .uri("/api/v1/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(ChatApiResponse.class)
                    .block();

            assertNotNull(response, "Java endpoint returned null response");
            assertEquals("ok", response.status(), "Expected Java response status to be ok");
            assertNotNull(response.content(), "Java response content is null");
            assertFalse(response.content().isBlank(), "Java response content is blank");

            System.out.println("[SUCCESS] ChatCompletionsFullChainTest.shouldReturnModelTextFromFullChain");
            System.out.println("[RESPONSE_CONTENT] " + response.content());
        } catch (WebClientRequestException connectionError) {
            fail("Cannot connect to Java endpoint at http://127.0.0.1:" + port + "/api/v1/chat/completions",
                    connectionError);
        } catch (WebClientResponseException httpError) {
            fail(
                    "Java endpoint returned HTTP " + httpError.getStatusCode() +
                            " with body: " + httpError.getResponseBodyAsString(),
                    httpError);
        }
    }

    private record ChatApiResponse(
            String content,
            String status) {
    }
}
