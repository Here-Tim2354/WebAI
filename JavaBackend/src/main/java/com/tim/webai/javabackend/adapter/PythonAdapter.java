package com.tim.webai.javabackend.adapter;

import com.tim.webai.javabackend.model.dto.python.PythonChatRequest;
import com.tim.webai.javabackend.model.dto.python.PythonChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

@Component
public class PythonAdapter {

    private final WebClient webClient;
    private final String chatCompletionsPath;

    public PythonAdapter(
            WebClient.Builder webClientBuilder,
            @Value("${python.base-url:http://127.0.0.1:5000}") String pythonBaseUrl,
            @Value("${python.chat-completions-path:/api/v1/chat/completions}") String chatCompletionsPath) {
        this.webClient = webClientBuilder.baseUrl(pythonBaseUrl).build();
        this.chatCompletionsPath = chatCompletionsPath;
    }

    public PythonChatResponse ask(PythonChatRequest request) {
        return webClient.post()
                .uri(chatCompletionsPath)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(PythonChatResponse.class)
                .block();
    }
}
