package com.tim.webai.javabackend.model.dto.python;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PythonChatResponse(
    String text
) {}
