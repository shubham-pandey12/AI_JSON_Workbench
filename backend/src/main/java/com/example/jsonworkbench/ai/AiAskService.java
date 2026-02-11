package com.example.jsonworkbench.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.example.jsonworkbench.api.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AiAskService {
    private final AiProvider aiProvider;
    public AiAskService(AiProvider aiProvider) {
        this.aiProvider = aiProvider;
    }

    public String answer(String question, JsonNode jsonData) {
        try {
            String answer = aiProvider.answer(question.trim(), jsonData);
            if (answer == null || answer.isBlank()) {
                throw new AiProviderException(AiProviderException.Failure.INVALID_RESPONSE);
            }
            return answer;
        } catch (AiProviderException exception) {
            throw toApiException(exception.getFailure());
        } catch (RuntimeException exception) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_PROVIDER_UNAVAILABLE",
                    "The AI provider is unavailable");
        }
    }

    public String generateTransformation(String prompt, JsonNode jsonData) {
        try {
            String code = aiProvider.generateTransformation(prompt.trim(), jsonData);
            if (code == null || code.isBlank()) {
                throw new AiProviderException(AiProviderException.Failure.INVALID_RESPONSE);
            }
            return code;
        } catch (AiProviderException exception) {
            throw toApiException(exception.getFailure());
        } catch (RuntimeException exception) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_PROVIDER_UNAVAILABLE",
                    "The AI provider is unavailable");
        }
    }

    private ApiException toApiException(AiProviderException.Failure failure) {
        return switch (failure) {
            case NOT_CONFIGURED -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_PROVIDER_NOT_CONFIGURED",
                    "The AI provider is not configured on the server");
            case TIMEOUT -> new ApiException(HttpStatus.GATEWAY_TIMEOUT, "AI_PROVIDER_TIMEOUT",
                    "The AI provider did not respond in time");
            case RATE_LIMITED -> new ApiException(HttpStatus.TOO_MANY_REQUESTS, "AI_PROVIDER_RATE_LIMITED",
                    "The AI provider is rate limiting requests");
            case AUTHENTICATION -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_PROVIDER_CONFIGURATION_ERROR",
                    "AI provider authentication is not configured correctly");
            case UNAVAILABLE -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_PROVIDER_UNAVAILABLE",
                    "The AI provider is temporarily unavailable");
            case INVALID_RESPONSE -> new ApiException(HttpStatus.BAD_GATEWAY, "AI_PROVIDER_INVALID_RESPONSE",
                    "The AI provider returned an invalid response");
            case PROVIDER_ERROR -> new ApiException(HttpStatus.BAD_GATEWAY, "AI_PROVIDER_ERROR",
                    "The AI provider could not process the request");
        };
    }

}
