package com.example.jsonworkbench.api;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String safeMessage) {
        super(safeMessage);
        if (status == null || code == null || code.isBlank() || safeMessage == null || safeMessage.isBlank()) {
            throw new IllegalArgumentException("API errors require a status, code, and safe message");
        }
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
