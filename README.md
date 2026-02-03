# AI JSON Workbench

A local-first workbench for inspecting and transforming JSON. The frontend includes a browser-based editor for formatting, minifying, validating, uploading, copying, and downloading JSON, plus an interactive tree explorer with search and copyable JSON paths. The Spring Boot API currently provides a health endpoint; AI integration and additional product features will be added incrementally.

## Prerequisites

- Node.js 22.12 or newer (Vite requires Node.js 20.19+ or 22.12+).
- Java 21.
- Maven 3.6.3 or newer.

## Run locally

1. Copy `.env.example` to `.env` to configure the backend. The default port is `8080`; allowed browser origins default to the local Vite addresses. Export variables from `.env` in your shell before starting the backend; Spring Boot does not load the root `.env` file automatically.
2. Start the backend in one terminal:

   ```sh
   cd backend
   mvn spring-boot:run
   ```

3. Start the frontend in another terminal:

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

4. Open the URL printed by Vite (normally `http://localhost:5173`). The Vite development server proxies `/api` requests to `http://localhost:8080`.

The health endpoint is available at `http://localhost:8080/api/v1/health`, or through the frontend proxy at `http://localhost:5173/api/v1/health` while both apps are running.

Backend settings can be overridden with `SERVER_PORT`, `CORS_ALLOWED_ORIGINS` (comma-separated exact origins), `SERVER_MAX_HTTP_REQUEST_HEADER_SIZE`, and `SERVER_MAX_HTTP_FORM_POST_SIZE`. The header and form limits default to `8KB` and `1MB`.

## Checks

```sh
cd frontend && npm test && npm run build
cd backend && mvn test && mvn package
```

## Project layout

```text
frontend/  React, TypeScript, Vite, and frontend tests
backend/   Java 21, Spring Boot API, and backend tests
```
