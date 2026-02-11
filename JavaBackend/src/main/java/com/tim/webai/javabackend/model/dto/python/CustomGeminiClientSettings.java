package com.tim.webai.javabackend.model.dto.python;

import com.fasterxml.jackson.annotation.JsonProperty;

public record CustomGeminiClientSettings(
    @JsonProperty("gemini_api_key") String geminiApiKey,
    @JsonProperty("gemini_base_url") String geminiBaseUrl
) {
}
