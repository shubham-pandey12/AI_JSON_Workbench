package com.example.jsonworkbench.dto;

import com.example.jsonworkbench.ai.ValidJsonData;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AiAskRequest(
        @NotBlank(message = "Question must not be blank")
        @Size(max = 1_000, message = "Question must not exceed 1000 characters")
        String question,
        @NotNull(message = "JSON data is required")
        @ValidJsonData
        JsonNode jsonData
) {
}
