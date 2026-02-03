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
