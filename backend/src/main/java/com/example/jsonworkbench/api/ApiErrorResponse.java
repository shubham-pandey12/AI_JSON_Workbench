package com.example.jsonworkbench.api;

import java.util.List;

public record ApiErrorResponse(
        String code,
        String message,
        String requestId,
        List<ApiErrorDetail> details
) {
    public record ApiErrorDetail(String field, String code, String message) {
    }
}
