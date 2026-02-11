package com.tim.webai.javabackend.adapter;

import com.tim.webai.javabackend.model.dto.python.PythonChatRequest;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import static org.junit.jupiter.api.Assertions.fail;

class PythonAdapterConnectivityTest {

    @Test
    void javaCanReachPythonEndpoint() {
        String pythonBaseUrl = System.getProperty("python.base-url", "http://127.0.0.1:5000");
        String chatPath = System.getProperty("python.chat-completions-path", "/api/v1/chat/completions");

        PythonAdapter adapter = new PythonAdapter(WebClient.builder(), pythonBaseUrl, chatPath);

        // Intentionally invalid payload: if Python is reachable, FastAPI should return 4xx.
        PythonChatRequest invalidRequest = new PythonChatRequest(null, null, null, null);

        try {
            adapter.ask(invalidRequest);
        } catch (WebClientResponseException expectedHttpError) {
            // Reaching this branch means Java successfully connected to Python and got an HTTP response.
            return;
        } catch (WebClientRequestException connectionError) {
            fail("Java cannot connect to Python service at " + pythonBaseUrl + chatPath, connectionError);
        }
    }
}
