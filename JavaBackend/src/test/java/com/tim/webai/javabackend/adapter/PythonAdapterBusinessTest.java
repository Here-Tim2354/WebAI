package com.tim.webai.javabackend.adapter;

import com.tim.webai.javabackend.model.dto.python.CustomGeminiClientSettings;
import com.tim.webai.javabackend.model.dto.python.PythonChatRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

class PythonAdapterBusinessTest {

    @Test
    void shouldReturnGeminiResponseJsonForValidRequest() {
        String pythonBaseUrl = System.getProperty("python.base-url", "http://127.0.0.1:5000");
        String chatPath = System.getProperty("python.chat-completions-path", "/api/v1/chat/completions");

        String model = System.getProperty("python.test.model", "gemini-3-flash-preview");
        String userInput = System.getProperty("python.test.user-input", "你好！随便说点什么");

        String apiKey = System.getProperty("python.test.gemini-api-key");
        String baseUrl = System.getProperty("python.test.gemini-base-url");

        CustomGeminiClientSettings customSettings = (apiKey != null || baseUrl != null)
            ? new CustomGeminiClientSettings(apiKey, baseUrl)
            : null;

        PythonChatRequest request = new PythonChatRequest(model, userInput, customSettings, null);

        WebClient client = WebClient.builder()
            .baseUrl(pythonBaseUrl)
            .build();

        try {
            String responseJson = client.post()
                .uri(chatPath)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(String.class)
                .block();

            System.out.println("Python response JSON:\n" + responseJson);

            assertNotNull(responseJson, "Python returned null response body");
            assertFalse(responseJson.isBlank(), "Python returned blank response body");
            assertTrue(responseJson.contains("\"candidates\""), "Response JSON does not contain candidates");
        } catch (WebClientRequestException connectionError) {
            fail("Cannot connect to Python service at " + pythonBaseUrl + chatPath, connectionError);
        } catch (WebClientResponseException httpError) {
            fail(
                "Python endpoint returned HTTP " + httpError.getStatusCode() +
                " with body: " + httpError.getResponseBodyAsString(),
                httpError
            );
        }
    }
}
