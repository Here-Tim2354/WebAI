package com.tim.webai.javabackend.model.dto.python;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GeminiThinkingConfig(
    @JsonProperty("include_thoughts") Boolean includeThoughts,
    @JsonProperty("thinking_budget") Integer thinkingBudget,
    @JsonProperty("thinking_level") GeminiThinkingLevel thinkingLevel
) {
}
