package com.tim.webai.javabackend.model.dto.python;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PythonChatResponse(
    @JsonProperty("sdk_http_response") SdkHttpResponse sdkHttpResponse,
    List<Candidate> candidates,
    @JsonProperty("create_time") Object createTime,
    @JsonProperty("model_version") String modelVersion,
    @JsonProperty("prompt_feedback") Object promptFeedback,
    @JsonProperty("response_id") String responseId,
    @JsonProperty("usage_metadata") UsageMetadata usageMetadata,
    @JsonProperty("automatic_function_calling_history") List<Object> automaticFunctionCallingHistory,
    Object parsed
) {

    public String modelReplyText() {
        if (candidates == null) {
            return "";
        }

        for (Candidate candidate : candidates) {
            if (candidate == null || candidate.content() == null || candidate.content().parts() == null) {
                continue;
            }
            for (Part part : candidate.content().parts()) {
                if (part != null && hasText(part.text())) {
                    return part.text().trim();
                }
            }
        }
        return "";
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SdkHttpResponse(
        Map<String, String> headers,
        Object body
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Candidate(
        Content content,
        @JsonProperty("citation_metadata") Object citationMetadata,
        @JsonProperty("finish_message") Object finishMessage,
        @JsonProperty("token_count") Integer tokenCount,
        @JsonProperty("finish_reason") String finishReason,
        @JsonProperty("avg_logprobs") Double avgLogprobs,
        @JsonProperty("grounding_metadata") Object groundingMetadata,
        Integer index,
        @JsonProperty("logprobs_result") Object logprobsResult,
        @JsonProperty("safety_ratings") Object safetyRatings,
        @JsonProperty("url_context_metadata") Object urlContextMetadata
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Content(
        List<Part> parts,
        String role
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Part(
        @JsonProperty("media_resolution") Object mediaResolution,
        @JsonProperty("code_execution_result") Object codeExecutionResult,
        @JsonProperty("executable_code") Object executableCode,
        @JsonProperty("file_data") Object fileData,
        @JsonProperty("function_call") Object functionCall,
        @JsonProperty("function_response") Object functionResponse,
        @JsonProperty("inline_data") Object inlineData,
        String text,
        Object thought,
        @JsonProperty("thought_signature") String thoughtSignature,
        @JsonProperty("video_metadata") Object videoMetadata
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UsageMetadata(
        @JsonProperty("cache_tokens_details") Object cacheTokensDetails,
        @JsonProperty("cached_content_token_count") Integer cachedContentTokenCount,
        @JsonProperty("candidates_token_count") Integer candidatesTokenCount,
        @JsonProperty("candidates_tokens_details") Object candidatesTokensDetails,
        @JsonProperty("prompt_token_count") Integer promptTokenCount,
        @JsonProperty("prompt_tokens_details") List<TokenDetail> promptTokensDetails,
        @JsonProperty("thoughts_token_count") Integer thoughtsTokenCount,
        @JsonProperty("tool_use_prompt_token_count") Integer toolUsePromptTokenCount,
        @JsonProperty("tool_use_prompt_tokens_details") Object toolUsePromptTokensDetails,
        @JsonProperty("total_token_count") Integer totalTokenCount,
        @JsonProperty("traffic_type") String trafficType
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TokenDetail(
        String modality,
        @JsonProperty("token_count") Integer tokenCount
    ) {}
}
