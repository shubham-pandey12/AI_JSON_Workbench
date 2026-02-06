package com.example.jsonworkbench.api;

import com.example.jsonworkbench.JsonWorkbenchApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = JsonWorkbenchApplication.class)
@AutoConfigureMockMvc
class ApiErrorHandlingTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void validationErrorsHaveStableStructuredContractAndPropagateRequestId() throws Exception {
        mockMvc.perform(post("/api/v1/test/validated")
                        .header(RequestIdFilter.HEADER_NAME, "client-request_42")
                        .contentType("application/json")
                        .content("{\"value\":\" \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string(RequestIdFilter.HEADER_NAME, "client-request_42"))
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.message").value("Request validation failed"))
                .andExpect(jsonPath("$.requestId").value("client-request_42"))
                .andExpect(jsonPath("$.details[0].field").value("value"))
                .andExpect(jsonPath("$.details[0].code").value("INVALID_VALUE"));
    }

    @Test
    void knownApplicationErrorsPreserveTheirStatusAndSafeMessage() throws Exception {
        mockMvc.perform(post("/api/v1/test/known-error"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("EXAMPLE_REJECTED"))
                .andExpect(jsonPath("$.message").value("The example request was rejected"))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    @Test
    void unexpectedErrorsReturnSafeServerError() throws Exception {
        mockMvc.perform(post("/api/v1/test/unexpected-error"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"))
                .andExpect(jsonPath("$.message", not(containsString("sensitive"))))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    @Test
    void invalidRequestIdsAreReplacedWithGeneratedIds() throws Exception {
        String tooLong = "x".repeat(65);
        String generatedId = mockMvc.perform(get("/api/v1/health").header(RequestIdFilter.HEADER_NAME, tooLong))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader(RequestIdFilter.HEADER_NAME);

        UUID.fromString(generatedId);
    }

    @Test
    void allowedFrontendOriginReceivesExplicitCorsHeaders() throws Exception {
        mockMvc.perform(get("/api/v1/health").header("Origin", "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Expose-Headers", containsString(RequestIdFilter.HEADER_NAME)));
    }

    @Test
    void unknownApiRouteUsesStandardNotFoundResponse() throws Exception {
        mockMvc.perform(get("/api/v1/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }
}
