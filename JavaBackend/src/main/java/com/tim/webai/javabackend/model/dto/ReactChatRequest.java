package com.tim.webai.javabackend.model.dto;
import lombok.Data;

@Data
public class ReactChatRequest {
    private String message;
    private String conversationId;
}
