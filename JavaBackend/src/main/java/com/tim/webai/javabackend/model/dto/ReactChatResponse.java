package com.tim.webai.javabackend.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ReactChatResponse {
    private String content;
    private String status;
}
