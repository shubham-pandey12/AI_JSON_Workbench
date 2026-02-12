package com.example.jsonworkbench.dto;

import com.example.jsonworkbench.ai.ValidJsonData;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AiTransformRequest(
        @NotBlank(message = "Transformation request must not be blank")
        @Size(max = 1_000, message = "Transformation request must not exceed 1000 characters")
        String prompt,
        @NotNull(message = "JSON data is required")
        @ValidJsonData
        JsonNode jsonData
) {
}
