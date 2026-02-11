package com.tim.webai.javabackend.model.dto.python;

import com.fasterxml.jackson.annotation.JsonProperty;


public record PythonChatRequest(
    /**
    * 发送至 Python 端的请求结构，对应 schemas.py 中的 JavaChatRequest
    */
    String model,
    @JsonProperty("user_input") String userInput,
    @JsonProperty("custom_settings") CustomGeminiClientSettings customSettings,
    GeminiGenerationConfig config
) {}
