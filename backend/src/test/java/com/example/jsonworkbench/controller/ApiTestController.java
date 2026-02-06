package com.example.jsonworkbench.controller;

import com.example.jsonworkbench.api.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/test")
class ApiTestController {
    @PostMapping("/validated")
    String validated(@Valid @RequestBody ExampleRequest request) {
        return request.value();
    }

    @PostMapping("/known-error")
    void knownError() {
        throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "EXAMPLE_REJECTED", "The example request was rejected");
    }

    @PostMapping("/unexpected-error")
    void unexpectedError() {
        throw new IllegalStateException("sensitive implementation detail");
    }

    record ExampleRequest(@NotBlank String value) {
    }
}
