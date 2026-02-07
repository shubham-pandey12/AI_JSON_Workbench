package com.example.jsonworkbench.ai;

public class AiProviderException extends RuntimeException {
    public enum Failure {
        NOT_CONFIGURED,
        TIMEOUT,
        RATE_LIMITED,
        AUTHENTICATION,
        UNAVAILABLE,
        INVALID_RESPONSE,
        PROVIDER_ERROR
    }

    private final Failure failure;

    public AiProviderException(Failure failure) {
        super(failure.name());
        this.failure = failure;
    }

    public AiProviderException(Failure failure, Throwable cause) {
        super(failure.name(), cause);
        this.failure = failure;
    }

    public Failure getFailure() {
        return failure;
    }
}
