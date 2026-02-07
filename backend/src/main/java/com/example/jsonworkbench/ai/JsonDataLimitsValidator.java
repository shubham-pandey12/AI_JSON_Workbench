package com.example.jsonworkbench.ai;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Deque;

public class JsonDataLimitsValidator implements ConstraintValidator<ValidJsonData, JsonNode> {
    @Override
    public boolean isValid(JsonNode value, ConstraintValidatorContext context) {
        if (value == null) return true;
        if (value.toString().getBytes(StandardCharsets.UTF_8).length > JsonDataLimits.MAX_JSON_BYTES) return false;

        Deque<NodeAtDepth> pending = new ArrayDeque<>();
        pending.push(new NodeAtDepth(value, 0));
        int nodes = 0;
        while (!pending.isEmpty()) {
            NodeAtDepth current = pending.pop();
            if (++nodes > JsonDataLimits.MAX_JSON_NODES || current.depth() > JsonDataLimits.MAX_JSON_DEPTH) return false;
            if (current.node().isContainerNode()) {
                current.node().elements().forEachRemaining(child -> pending.push(new NodeAtDepth(child, current.depth() + 1)));
            }
        }
        return true;
    }

    private record NodeAtDepth(JsonNode node, int depth) {
    }
}
