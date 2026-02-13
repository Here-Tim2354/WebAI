package com.tim.webai.javabackend.model.dto.python;

import org.junit.jupiter.api.Test;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PythonChatResponseTest {

    @Test
    void shouldExtractTextFromCandidateParts() {
        PythonChatResponse response = new PythonChatResponse(
            null,
            List.of(candidateWithPartText("text from candidate part")),
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );

        assertEquals("text from candidate part", response.modelReplyText());
    }

    @Test
    void shouldSkipBlankPartTextAndFindNext() {
        PythonChatResponse response = new PythonChatResponse(
            null,
            List.of(
                candidateWithPartText("   "),
                candidateWithPartText("candidate part text")
            ),
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );

        assertEquals("candidate part text", response.modelReplyText());
    }

    @Test
    void shouldReturnEmptyWhenNoTextIsAvailable() {
        PythonChatResponse response = new PythonChatResponse(
            null,
            List.of(candidateWithPartText(null)),
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );

        assertEquals("", response.modelReplyText());
    }

    private static PythonChatResponse.Candidate candidateWithPartText(String text) {
        return new PythonChatResponse.Candidate(
            new PythonChatResponse.Content(
                List.of(
                    new PythonChatResponse.Part(
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        text,
                        null,
                        null,
                        null
                    )
                ),
                "model"
            ),
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );
    }
}
