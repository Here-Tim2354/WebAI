package com.tim.webai.javabackend.model.dto.react;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ReactChatResponse {
    private String content;
    private String status;
}
