# AI JSON Workbench

A local-first workbench for inspecting and transforming JSON. The frontend includes a browser-based editor for formatting, minifying, validating, uploading, copying, and downloading JSON, plus an interactive tree explorer with search and copyable JSON paths. The Spring Boot API provides a health endpoint and a versioned AI endpoint for answering questions about caller-supplied JSON.

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

### Ask about JSON

The workbench includes an AI Assistant below the editor and tree explorer. Enter a question and acknowledge the data-sharing notice before the first request in the session. Each answer still requires clicking **Ask AI**. At that moment the frontend sends the question and the complete current editor JSON to the backend at `/api/v1/ai/ask`; the backend forwards them to its configured AI provider. The browser does not send requests automatically, and the provider may process the submitted data under its own policies. The assistant does not keep chat history. Local format, minify, validate, upload, download, copy, and tree operations work without AI credentials or network access.

Run the frontend and backend together using the local startup instructions above. Configure the provider only in the backend environment using `AI_PROVIDER_BASE_URL`, `AI_PROVIDER_MODEL`, and `AI_PROVIDER_API_KEY`; never put provider credentials in frontend variables. The API key is optional when using the editor or running frontend tests. Frontend tests mock the API and do not contact an AI provider:

```sh
cd frontend
npm ci
npm test
npm run build
```

The backend must be configured with a provider to receive AI answers; without it, the UI displays the safe `AI_PROVIDER_NOT_CONFIGURED` error and request ID when available.

`POST /api/v1/ai/ask` submits a question and JSON value to the configured AI provider:

```sh
curl -X POST http://localhost:8080/api/v1/ai/ask \
  -H 'Content-Type: application/json' \
  -H 'X-Request-Id: local-ask-1' \
  -d '{"question":"How many users are there?","jsonData":{"users":[{"name":"Asha"},{"name":"Ravi"}]}}'
```

Successful responses contain an `answer` and `requestId`:

```json
{
  "answer": "There are two users.",
  "requestId": "local-ask-1"
}
```

The question must contain 1–1000 characters. `jsonData` must be valid JSON no larger than 256 KiB, at most 64 levels deep, and contain no more than 10,000 values. These limits apply in addition to the 1 MiB API request-body limit.

The backend uses an OpenAI-compatible Chat Completions API. Configure `AI_PROVIDER_BASE_URL`, `AI_PROVIDER_MODEL`, and `AI_PROVIDER_API_KEY` in the server environment. Connection and response timeouts are configurable with `AI_PROVIDER_CONNECT_TIMEOUT` and `AI_PROVIDER_RESPONSE_TIMEOUT`; defaults are 3 seconds and 20 seconds. The API key is optional for running the app and its tests. Without it, calls to the ask endpoint return `503 AI_PROVIDER_NOT_CONFIGURED`. Copy `.env.example` and export its values before starting the backend; Spring Boot does not read `.env` automatically.

### Generate and review JSON transformations

The **Transformation workspace** is below the AI Assistant. A code-generation request sends `{ "prompt": "...", "jsonData": <JSON value> }` to `POST /api/v1/ai/transform`. It returns `{ "code": "function transform(input) { ... }", "requestId": "..." }`; generation never runs the proposal. Review and edit the proposal in the JavaScript editor, then explicitly choose **Run transformation**. Each run uses the latest valid JSON from the main editor. The result is shown separately and can be copied or downloaded; it never replaces the source editor.

Execution uses the QuickJS JavaScript interpreter compiled to WebAssembly inside a disposable module Web Worker. The worker receives a structured-clone copy of the parsed JSON and reviewed function, exposes no browser or server host APIs, and is terminated when it completes, errors, is cancelled by source changes, or exceeds a five-second worker timeout. QuickJS enforces a 1.5-second execution deadline, an 8 MiB interpreter memory limit, and a 512 KiB serialized output limit. Inputs are limited to 256 KiB, matching the backend JSON limit. Results must be JSON-compatible; cycles, functions, `undefined`, `BigInt`, non-finite numbers, custom prototypes, holes, and accessors are rejected. The generated source must be at most 20,000 characters.

**Security limitation:** a Worker and a WebAssembly interpreter reduce exposure and keep synchronous computation off the UI thread; they are not a complete security boundary or a guarantee against browser, interpreter, or resource-exhaustion vulnerabilities. Do not run code you do not trust. The app does not provide filesystem, network, DOM, or host callbacks to the interpreter. It does not persist prompts, JSON, code, or results. The current checks do not perform a full JavaScript AST review, and users can edit the proposal before running it.

Frontend tests mock the AI HTTP response and use the actual QuickJS interpreter for deterministic transformation tests, so they do not need provider credentials or make paid requests. Worker lifecycle behavior uses deterministic fake-worker tests; browser-specific Worker/Wasm loading should also be exercised manually in a supported browser.

Errors use the standard `{ "code", "message", "requestId", "details" }` response. The ask endpoint uses `400` for invalid or excessive fields, `413` when the overall request exceeds its body limit, `429` when the provider rate limits the request, `502` for invalid provider responses or provider request errors, `503` when provider configuration, authentication, availability, or an unexpected provider failure prevents a response, and `504` for provider timeouts. Messages are sanitized and do not include upstream response bodies or credentials.

JSON is sent to the configured provider only when a caller explicitly invokes this endpoint. A configured external provider may process the question and JSON under its own data policies. The application does not persist JSON or conversations, run background AI requests, or execute model output.

Tests mock the provider at the API boundary and use a local fake HTTP server for adapter checks. They do not need an API key, external AI access, or paid requests. Run them with `cd backend && mvn test`.

Backend settings can also be overridden with `SERVER_PORT`, `CORS_ALLOWED_ORIGINS` (comma-separated exact origins; wildcard origins are rejected), `SERVER_MAX_HTTP_REQUEST_HEADER_SIZE`, `SERVER_MAX_HTTP_FORM_POST_SIZE`, and `MAX_REQUEST_BODY_SIZE` (bytes, default `1048576`). The header and form limits default to `8KB` and `1MB`. The API body limit returns a standardized `413` error when exceeded.

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
