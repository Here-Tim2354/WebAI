package com.tim.webai.javabackend.model.dto.react;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.tim.webai.javabackend.model.dto.python.CustomGeminiClientSettings;
import com.tim.webai.javabackend.model.dto.python.GeminiGenerationConfig;

public record ReactChatRequest(
    @JsonProperty("user_input") String userInput,
    String model,
    CustomGeminiClientSettings customSettings,
    GeminiGenerationConfig config
) {}
