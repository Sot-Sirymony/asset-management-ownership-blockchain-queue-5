package com.up.asset_holder_api.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.HashMap;
import java.util.Map;

/**
 * Global exception handler for standardized error responses across the application.
 * Provides consistent error formatting and logging for all exceptions.
 */
@Slf4j
@ControllerAdvice
public class GlobalExceptionHandle {

    /**
     * Handles NotFoundException - returns 404 with detailed message.
     */
    @ExceptionHandler(NotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetail handleNotFoundExceptionCustom(NotFoundException e) {
        log.warn("Resource not found: {}", e.getMessage());
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
        problemDetail.setTitle("Not Found");
        problemDetail.setProperty("timestamp", System.currentTimeMillis());
        return problemDetail;
    }

    /**
     * Handles validation exceptions from @Valid annotations.
     * Returns 400 with field-level error details.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<Map<String, String>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        log.warn("Validation failed: {}", ex.getBindingResult().getFieldErrors());
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
                errors.put(error.getField(), error.getDefaultMessage())
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errors);
    }

    /**
     * Handles access denied exceptions (403 Forbidden).
     */
    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ProblemDetail handleAccessDeniedException(AccessDeniedException e) {
        log.warn("Access denied: {}", e.getMessage());
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, 
                "You do not have permission to access this resource");
        problemDetail.setTitle("Access Denied");
        problemDetail.setProperty("timestamp", System.currentTimeMillis());
        return problemDetail;
    }

    /**
     * Handles authentication failures (401 Unauthorized).
     */
    @ExceptionHandler(BadCredentialsException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ProblemDetail handleBadCredentialsException(BadCredentialsException e) {
        log.warn("Authentication failed: {}", e.getMessage());
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, 
                "Invalid credentials");
        problemDetail.setTitle("Unauthorized");
        problemDetail.setProperty("timestamp", System.currentTimeMillis());
        return problemDetail;
    }

    /**
     * Handles IllegalStateException (e.g. enrollment, gateway, or orderer failure) - returns 503.
     */
    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ProblemDetail handleIllegalStateException(IllegalStateException e) {
        log.warn("Service state error: {}", e.getMessage());
        String detail = e.getMessage() != null && !e.getMessage().isBlank()
                ? e.getMessage()
                : "Service temporarily unavailable. Please try again later.";
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, detail);
        problemDetail.setTitle("Service Unavailable");
        problemDetail.setProperty("timestamp", System.currentTimeMillis());
        return problemDetail;
    }

    /**
     * Handles all other unhandled exceptions (500 Internal Server Error).
     */
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ProblemDetail handleGenericException(Exception e) {
        log.error("Unexpected error occurred", e);
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred. Please try again later.");
        problemDetail.setTitle("Internal Server Error");
        problemDetail.setProperty("timestamp", System.currentTimeMillis());
        // In production, don't expose internal error details
        if (log.isDebugEnabled()) {
            problemDetail.setProperty("detail", e.getMessage());
        }
        return problemDetail;
    }
}
