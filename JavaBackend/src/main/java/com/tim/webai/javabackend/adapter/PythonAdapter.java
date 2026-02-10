package com.tim.webai.javabackend.adapter;

import org.springframework.stereotype.Component;

@Component
public class PythonAdapter {

    public String ask(String message) {
        if (message == null || message.isBlank()) {
            return "message is empty";
        }
        return "echo: " + message;
    }
}
