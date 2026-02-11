package com.tim.webai.javabackend.model.dto.python;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

public record GeminiGenerationConfig(
    Double temperature,
    @JsonProperty("top_p") Double topP,
    @JsonProperty("top_k") Integer topK,
    Integer seed,
    @JsonProperty("max_output_tokens") Integer maxOutputTokens,
    @JsonProperty("candidate_count") Integer candidateCount,
    @JsonProperty("stop_sequences") List<String> stopSequences,
    @JsonProperty("response_mime_type") String responseMimeType,
    @JsonProperty("response_schema") Object responseSchema,
    @JsonProperty("presence_penalty") Double presencePenalty,
    @JsonProperty("frequency_penalty") Double frequencyPenalty,
    @JsonProperty("include_thoughts") Boolean includeThoughts,
    @JsonProperty("thought_budget_token_count") Integer thoughtBudgetTokenCount,
    @JsonProperty("thinking_config") GeminiThinkingConfig thinkingConfig,
    @JsonProperty("system_instruction") String systemInstruction,
    GeminiTools tools,
    @JsonProperty("speech_config") GeminiSpeechConfig speechConfig,
    @JsonProperty("image_config") GeminiImageConfig imageConfig,
    @JsonProperty("media_resolution") Map<String, Object> mediaResolution,
    @JsonProperty("response_logprobs") Boolean responseLogprobs,
    Integer logprobs
) {
}
