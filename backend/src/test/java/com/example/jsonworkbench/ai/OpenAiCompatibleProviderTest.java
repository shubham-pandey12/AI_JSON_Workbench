package com.example.jsonworkbench.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class OpenAiCompatibleProviderTest {
    private HttpServer server;
    private int port;
    private final AtomicReference<Integer> statusCode = new AtomicReference<>(200);
    private final AtomicReference<String> responseBody = new AtomicReference<>(
            "{\"choices\":[{\"message\":{\"content\":\"Two users\"}}]}");
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private final AtomicReference<String> requestBody = new AtomicReference<>();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = responseBody.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(statusCode.get(), bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        port = server.getAddress().getPort();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void sendsOnlyExplicitAskToConfiguredCompatibleProvider() throws Exception {
        OpenAiCompatibleProvider provider = provider("test-secret");
        JsonNode data = new ObjectMapper().readTree("{\"users\":[{},{}]}");

        assertEquals("Two users", provider.answer("How many users?", data));
        assertEquals("Bearer test-secret", authorization.get());
        JsonNode sent = new ObjectMapper().readTree(requestBody.get());
        assertEquals("test-model", sent.path("model").asText());
        assertEquals("system", sent.path("messages").path(0).path("role").asText());
        assertEquals("user", sent.path("messages").path(1).path("role").asText());
        org.junit.jupiter.api.Assertions.assertTrue(sent.path("messages").path(1).path("content").asText().contains(data.toString()));
    }

    @Test
    void missingCredentialsFailWithoutCallingProvider() {
        OpenAiCompatibleProvider provider = provider("");
        AiProviderException exception = assertThrows(AiProviderException.class,
                () -> provider.answer("Explain", new ObjectMapper().createObjectNode()));
        assertEquals(AiProviderException.Failure.NOT_CONFIGURED, exception.getFailure());
    }

    @Test
    void rateLimitAndAuthenticationResponsesMapToTypedFailures() {
        OpenAiCompatibleProvider provider = provider("test-secret");
        statusCode.set(429);
        AiProviderException rateLimit = assertThrows(AiProviderException.class,
                () -> provider.answer("Explain", new ObjectMapper().createObjectNode()));
        assertEquals(AiProviderException.Failure.RATE_LIMITED, rateLimit.getFailure());

        statusCode.set(401);
        AiProviderException authentication = assertThrows(AiProviderException.class,
                () -> provider.answer("Explain", new ObjectMapper().createObjectNode()));
        assertEquals(AiProviderException.Failure.AUTHENTICATION, authentication.getFailure());
    }

    @Test
    void malformedProviderResponseIsRejectedWithoutExposingResponseBody() {
        OpenAiCompatibleProvider provider = provider("test-secret");
        responseBody.set("upstream secret response");
        AiProviderException exception = assertThrows(AiProviderException.class,
                () -> provider.answer("Explain", new ObjectMapper().createObjectNode()));
        assertEquals(AiProviderException.Failure.INVALID_RESPONSE, exception.getFailure());
    }

    @Test
    void transformationProposalRequiresTheDocumentedJsonFunctionContract() throws Exception {
        OpenAiCompatibleProvider provider = provider("test-secret");
        JsonNode data = new ObjectMapper().readTree("{\"users\":[]}");
        responseBody.set("{\"choices\":[{\"message\":{\"content\":\"{\\\"code\\\":\\\"function transform(input) { return input.users; }\\\"}\"}}]}");

        assertEquals("function transform(input) { return input.users; }", provider.generateTransformation("Return users", data));
        JsonNode sent = new ObjectMapper().readTree(requestBody.get());
        org.junit.jupiter.api.Assertions.assertTrue(sent.path("messages").path(0).path("content").asText().contains("function transform(input)"));
    }

    @Test
    void malformedTransformationProposalIsRejected() {
        OpenAiCompatibleProvider provider = provider("test-secret");
        responseBody.set("{\"choices\":[{\"message\":{\"content\":\"Here is your code: function transform(input) { return input; }\"}}]}");
        AiProviderException exception = assertThrows(AiProviderException.class,
                () -> provider.generateTransformation("Keep it", new ObjectMapper().createObjectNode()));
        assertEquals(AiProviderException.Failure.INVALID_RESPONSE, exception.getFailure());
    }

    private OpenAiCompatibleProvider provider(String apiKey) {
        return new OpenAiCompatibleProvider(RestClient.builder(), new ObjectMapper(),
                "http://127.0.0.1:" + port + "/v1/", apiKey, "test-model",
                Duration.ofSeconds(1), Duration.ofSeconds(2));
    }
}
