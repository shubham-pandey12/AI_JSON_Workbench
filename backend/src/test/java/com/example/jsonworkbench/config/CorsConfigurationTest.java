package com.example.jsonworkbench.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CorsConfigurationTest {
    @Test
    void acceptsExplicitOrigins() {
        assertDoesNotThrow(() -> new CorsConfiguration("http://localhost:5173, https://workbench.example"));
    }

    @Test
    void rejectsWildcardAndEmptyOriginConfiguration() {
        assertThrows(IllegalArgumentException.class, () -> new CorsConfiguration("*"));
        assertThrows(IllegalArgumentException.class, () -> new CorsConfiguration(" , "));
    }
}
