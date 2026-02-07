package com.example.jsonworkbench.ai;

import com.fasterxml.jackson.databind.JsonNode;

public interface AiProvider {
    String answer(String question, JsonNode jsonData);

    String generateTransformation(String prompt, JsonNode jsonData);
}
