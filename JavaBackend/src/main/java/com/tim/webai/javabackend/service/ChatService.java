package com.tim.webai.javabackend.service;

import com.tim.webai.javabackend.adapter.PythonAdapter;
import com.tim.webai.javabackend.model.dto.python.PythonChatRequest;
import com.tim.webai.javabackend.model.dto.python.PythonChatResponse;
import com.tim.webai.javabackend.model.dto.react.ReactChatRequest;
import com.tim.webai.javabackend.model.dto.react.ReactChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ChatService {

    private final PythonAdapter pythonAdapter;
    private final String defaultModel;

    public ChatService(
        PythonAdapter pythonAdapter,
        @Value("${python.default-model:gemini-3-flash-preview}") String defaultModel
    ) {
        this.pythonAdapter = pythonAdapter;
        this.defaultModel = defaultModel;
    }

    public ReactChatResponse ask(ReactChatRequest request) {
        PythonChatRequest pythonRequest = new PythonChatRequest(
            defaultModel,
            request.message(),
            null,
            null
        );

        PythonChatResponse pythonResponse = pythonAdapter.ask(pythonRequest);
        String answer = pythonResponse != null && pythonResponse.text() != null
            ? pythonResponse.text()
            : "";

        return new ReactChatResponse(answer, "ok");
    }
}
