package com.tim.webai.javabackend.model.dto.python;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GeminiTools(
    @JsonProperty("enable_google_search") Boolean enableGoogleSearch,
    @JsonProperty("enable_url_context") Boolean enableUrlContext
) {
}
