package com.tim.webai.javabackend.service;

import com.tim.webai.javabackend.adapter.PythonAdapter;
import com.tim.webai.javabackend.model.dto.python.CustomGeminiClientSettings;
import com.tim.webai.javabackend.model.dto.python.PythonChatRequest;
import com.tim.webai.javabackend.model.dto.python.PythonChatResponse;
import com.tim.webai.javabackend.model.dto.react.ReactChatRequest;
import com.tim.webai.javabackend.model.dto.react.ReactChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ChatService {

    private final PythonAdapter pythonAdapter;
    private final String defaultModel;

    public ChatService(
            PythonAdapter pythonAdapter,
            @Value("${python.default-model:gemini-3-flash-preview}") String defaultModel) {
        this.pythonAdapter = pythonAdapter;
        this.defaultModel = defaultModel;
    }

    public ReactChatResponse ask(ReactChatRequest request) {
        String model = resolveModel(request.model());
        CustomGeminiClientSettings customSettings = normalizeCustomSettings(request.customSettings());

        PythonChatRequest pythonRequest = new PythonChatRequest(
                model,
                request.userInput(),
                customSettings,
                request.config());

        PythonChatResponse pythonResponse = pythonAdapter.ask(pythonRequest);

        String answer = pythonResponse != null ? pythonResponse.modelReplyText() : "";

        return new ReactChatResponse(answer, "ok");
    }

    private String resolveModel(String requestModel) {
        if (hasText(requestModel)) {
            return requestModel.trim();
        }
        if (hasText(defaultModel)) {
            return defaultModel.trim();
        }
        return null;
    }

    private CustomGeminiClientSettings normalizeCustomSettings(CustomGeminiClientSettings customSettings) {
        if (customSettings == null) {
            return null;
        }

        String apiKey = trimToNull(customSettings.geminiApiKey());
        String baseUrl = trimToNull(customSettings.geminiBaseUrl());
        if (apiKey == null && baseUrl == null) {
            return null;
        }
        return new CustomGeminiClientSettings(apiKey, baseUrl);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String trimToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }
}

