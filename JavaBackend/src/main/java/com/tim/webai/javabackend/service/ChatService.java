package com.tim.webai.javabackend.service;

import com.tim.webai.javabackend.adapter.PythonAdapter;
import com.tim.webai.javabackend.model.dto.ReactChatRequest;
import com.tim.webai.javabackend.model.dto.ReactChatResponse;
import org.springframework.stereotype.Service;

@Service
public class ChatService {

    private final PythonAdapter pythonAdapter;

    public ChatService(PythonAdapter pythonAdapter) {
        this.pythonAdapter = pythonAdapter;
    }

    public ReactChatResponse ask(ReactChatRequest request) {
        String answer = pythonAdapter.ask(request.getMessage());
        return new ReactChatResponse(answer, "ok");
    }
}
