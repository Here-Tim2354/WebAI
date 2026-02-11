package com.tim.webai.javabackend.model.dto.python;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum GeminiThinkingLevel {
    @JsonProperty("minimal")
    MINIMAL,
    @JsonProperty("low")
    LOW,
    @JsonProperty("medium")
    MEDIUM,
    @JsonProperty("high")
    HIGH
}
