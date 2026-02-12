package com.example.jsonworkbench.controller;

import com.example.jsonworkbench.ai.AiAskService;
import com.example.jsonworkbench.api.RequestIdFilter;
import com.example.jsonworkbench.dto.AiAskRequest;
import com.example.jsonworkbench.dto.AiAskResponse;
import com.example.jsonworkbench.dto.AiTransformRequest;
import com.example.jsonworkbench.dto.AiTransformResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/ai")
public class AiAskController {
    private final AiAskService aiAskService;

    public AiAskController(AiAskService aiAskService) {
        this.aiAskService = aiAskService;
    }

    @PostMapping("/ask")
    public AiAskResponse ask(@Valid @RequestBody AiAskRequest request, HttpServletRequest httpRequest) {
        String answer = aiAskService.answer(request.question(), request.jsonData());
        Object requestId = httpRequest.getAttribute(RequestIdFilter.ATTRIBUTE_NAME);
        return new AiAskResponse(answer, requestId instanceof String id ? id : null);
    }

    @PostMapping("/transform")
    public AiTransformResponse transform(@Valid @RequestBody AiTransformRequest request, HttpServletRequest httpRequest) {
        String code = aiAskService.generateTransformation(request.prompt(), request.jsonData());
        Object requestId = httpRequest.getAttribute(RequestIdFilter.ATTRIBUTE_NAME);
        return new AiTransformResponse(code, requestId instanceof String id ? id : null);
    }
}
