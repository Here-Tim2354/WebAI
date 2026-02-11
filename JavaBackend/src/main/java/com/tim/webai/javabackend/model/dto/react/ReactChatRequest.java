package com.tim.webai.javabackend.model.dto.react;

public record ReactChatRequest(
    String message,
    String conversationId
) {}
