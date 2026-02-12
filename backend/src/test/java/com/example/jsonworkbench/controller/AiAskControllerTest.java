package com.example.jsonworkbench.controller;

import com.example.jsonworkbench.JsonWorkbenchApplication;
import com.example.jsonworkbench.ai.AiProvider;
import com.example.jsonworkbench.ai.AiProviderException;
import com.example.jsonworkbench.api.RequestIdFilter;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = JsonWorkbenchApplication.class)
@AutoConfigureMockMvc
class AiAskControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AiProvider aiProvider;

    @Test
    void validRequestReturnsProviderAnswerAndCorrelatedRequestId() throws Exception {
        when(aiProvider.answer(eq("How many users?"), any(JsonNode.class))).thenReturn("There are 2 users.");

        mockMvc.perform(post("/api/v1/ai/ask")
                        .header(RequestIdFilter.HEADER_NAME, "ai-call-7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"question\":\"How many users?\",\"jsonData\":{\"users\":[{},{}]}}"))
                .andExpect(status().isOk())
                .andExpect(header().string(RequestIdFilter.HEADER_NAME, "ai-call-7"))
                .andExpect(jsonPath("$.answer").value("There are 2 users."))
                .andExpect(jsonPath("$.requestId").value("ai-call-7"));
        verify(aiProvider).answer(eq("How many users?"), any(JsonNode.class));
    }

    @Test
    void transformationProposalReturnsCodeWithoutExecutingIt() throws Exception {
        String code = "function transform(input) { return input.users; }";
        when(aiProvider.generateTransformation(eq("Return users"), any(JsonNode.class))).thenReturn(code);
        mockMvc.perform(post("/api/v1/ai/transform")
                        .header(RequestIdFilter.HEADER_NAME, "transform-call-8")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prompt\":\"Return users\",\"jsonData\":{\"users\":[1]}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.requestId").value("transform-call-8"));
        verify(aiProvider).generateTransformation(eq("Return users"), any(JsonNode.class));
        verify(aiProvider, never()).answer(any(), any());
    }

    @Test
    void invalidTransformationRequestIsRejectedBeforeProviderCall() throws Exception {
        mockMvc.perform(post("/api/v1/ai/transform")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prompt\":\" \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        verify(aiProvider, never()).generateTransformation(any(), any());
    }

    @Test
    void blankAndOversizedQuestionsAreRejectedBeforeProviderCall() throws Exception {
        mockMvc.perform(post("/api/v1/ai/ask")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"question\":\"  \",\"jsonData\":{}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        String oversizedQuestion = "q".repeat(2_001);
        mockMvc.perform(post("/api/v1/ai/ask")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(new RequestBody(oversizedQuestion, objectMapper.readTree("{}")))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        verify(aiProvider, never()).answer(any(), any());
    }

    @Test
    void missingFieldsMalformedJsonAndExcessiveJsonAreRejected() throws Exception {
        mockMvc.perform(post("/api/v1/ai/ask")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.details.length()").value(2));

        mockMvc.perform(post("/api/v1/ai/ask")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not-json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));

        JsonNode tooLarge = objectMapper.readTree("{\"data\":\"" + "x".repeat(256 * 1024) + "\"}");
        mockMvc.perform(post("/api/v1/ai/ask")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(new RequestBody("Explain this", tooLarge))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        verify(aiProvider, never()).answer(any(), any());
    }

    @ParameterizedTest
    @EnumSource(AiProviderException.Failure.class)
    void expectedProviderFailuresUseSafeStatusAndErrorContract(AiProviderException.Failure failure) throws Exception {
        when(aiProvider.answer(any(), any())).thenThrow(new AiProviderException(failure));
        ExpectedError expected = expectedError(failure);

        mockMvc.perform(post("/api/v1/ai/ask")
                        .header(RequestIdFilter.HEADER_NAME, "failed-ai-call")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"question\":\"Explain this JSON\",\"jsonData\":{}}"))
                .andExpect(status().is(expected.status()))
                .andExpect(header().string(RequestIdFilter.HEADER_NAME, "failed-ai-call"))
                .andExpect(jsonPath("$.code").value(expected.code()))
                .andExpect(jsonPath("$.message").value(expected.message()))
                .andExpect(jsonPath("$.requestId").value("failed-ai-call"));
    }

    @Test
    void unexpectedProviderFailuresDoNotExposeInternalMessages() throws Exception {
        when(aiProvider.answer(any(), any())).thenThrow(new IllegalStateException("secret provider response detail"));

        mockMvc.perform(post("/api/v1/ai/ask")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"question\":\"Explain this JSON\",\"jsonData\":{}}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_PROVIDER_UNAVAILABLE"))
                .andExpect(jsonPath("$.message").value("The AI provider is unavailable"))
                .andExpect(jsonPath("$.message", not(containsString("secret"))))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    private ExpectedError expectedError(AiProviderException.Failure failure) {
        return switch (failure) {
            case NOT_CONFIGURED -> new ExpectedError(503, "AI_PROVIDER_NOT_CONFIGURED", "The AI provider is not configured on the server");
            case TIMEOUT -> new ExpectedError(504, "AI_PROVIDER_TIMEOUT", "The AI provider did not respond in time");
            case RATE_LIMITED -> new ExpectedError(429, "AI_PROVIDER_RATE_LIMITED", "The AI provider is rate limiting requests");
            case AUTHENTICATION -> new ExpectedError(503, "AI_PROVIDER_CONFIGURATION_ERROR", "AI provider authentication is not configured correctly");
            case UNAVAILABLE -> new ExpectedError(503, "AI_PROVIDER_UNAVAILABLE", "The AI provider is temporarily unavailable");
            case INVALID_RESPONSE -> new ExpectedError(502, "AI_PROVIDER_INVALID_RESPONSE", "The AI provider returned an invalid response");
            case PROVIDER_ERROR -> new ExpectedError(502, "AI_PROVIDER_ERROR", "The AI provider could not process the request");
        };
    }

    private record RequestBody(String question, JsonNode jsonData) {
    }

    private record ExpectedError(int status, String code, String message) {
    }
}
