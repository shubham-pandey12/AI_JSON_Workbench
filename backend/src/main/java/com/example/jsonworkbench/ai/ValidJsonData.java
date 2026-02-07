package com.example.jsonworkbench.ai;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Constraint(validatedBy = JsonDataLimitsValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidJsonData {
    String message() default "JSON data exceeds the size, nesting, or node limit";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
