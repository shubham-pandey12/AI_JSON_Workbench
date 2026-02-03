package com.example.jsonworkbench.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

@Configuration
public class CorsConfiguration implements WebMvcConfigurer {
    private final String[] allowedOrigins;

    public CorsConfiguration(@Value("${app.cors.allowed-origins}") String allowedOrigins) {
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);
        if (this.allowedOrigins.length == 0 || Arrays.asList(this.allowedOrigins).contains("*")) {
            throw new IllegalArgumentException("Configure one or more explicit CORS origins; wildcard origins are not allowed");
        }
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("Content-Type", "Accept", "X-Request-Id")
                .exposedHeaders("X-Request-Id")
                .maxAge(3600);
    }
}
