package com.example.jsonworkbench.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class RequestBodySizeFilter extends OncePerRequestFilter {
    private final long maxBodySize;
    private final ObjectMapper objectMapper;

    public RequestBodySizeFilter(@Value("${app.request.max-body-size:1048576}") long maxBodySize,
                                 ObjectMapper objectMapper) {
        if (maxBodySize < 1 || maxBodySize >= Integer.MAX_VALUE) {
            throw new IllegalArgumentException("app.request.max-body-size must be between 1 and 2147483646 bytes");
        }
        this.maxBodySize = maxBodySize;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String contextPath = request.getContextPath();
        String requestUri = request.getRequestURI();
        String path = requestUri != null && contextPath != null && requestUri.startsWith(contextPath)
                ? requestUri.substring(contextPath.length())
                : requestUri;
        String method = request.getMethod();
        return path == null || !path.startsWith("/api/")
                || "GET".equalsIgnoreCase(method)
                || "HEAD".equalsIgnoreCase(method)
                || "OPTIONS".equalsIgnoreCase(method);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    jakarta.servlet.FilterChain filterChain) throws jakarta.servlet.ServletException, IOException {
        if (request.getContentLengthLong() > maxBodySize) {
            writePayloadTooLarge(request, response);
            return;
        }

        byte[] body = request.getInputStream().readNBytes((int) maxBodySize + 1);
        if (body.length > maxBodySize) {
            writePayloadTooLarge(request, response);
            return;
        }

        filterChain.doFilter(new CachedBodyRequest(request, body), response);
    }

    private void writePayloadTooLarge(HttpServletRequest request, HttpServletResponse response) throws IOException {
        Object requestId = request.getAttribute(RequestIdFilter.ATTRIBUTE_NAME);
        ApiErrorResponse error = new ApiErrorResponse(
                "REQUEST_TOO_LARGE",
                "Request body exceeds the allowed size",
                requestId instanceof String id ? id : null,
                List.of());
        response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getOutputStream(), error);
    }

    private static final class CachedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;
        private ServletInputStream inputStream;

        private CachedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            if (inputStream == null) {
                ByteArrayInputStream input = new ByteArrayInputStream(body);
                inputStream = new ServletInputStream() {
                    @Override
                    public int read() {
                        return input.read();
                    }

                    @Override
                    public boolean isFinished() {
                        return input.available() == 0;
                    }

                    @Override
                    public boolean isReady() {
                        return true;
                    }

                    @Override
                    public void setReadListener(ReadListener readListener) {
                        if (readListener == null) {
                            throw new IllegalArgumentException("ReadListener must not be null");
                        }
                        try {
                            if (!isFinished()) {
                                readListener.onDataAvailable();
                            }
                            if (isFinished()) {
                                readListener.onAllDataRead();
                            }
                        } catch (IOException exception) {
                            readListener.onError(exception);
                        }
                    }
                };
            }
            return inputStream;
        }

        @Override
        public BufferedReader getReader() {
            Charset charset = getCharacterEncoding() == null
                    ? StandardCharsets.UTF_8
                    : Charset.forName(getCharacterEncoding());
            return new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }

        @Override
        public int getContentLength() {
            return body.length;
        }

        @Override
        public long getContentLengthLong() {
            return body.length;
        }
    }
}
