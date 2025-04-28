 # Codebase Summary

 This repository provides a complete end-to-end solution for generating incident narratives and event payloads, previewing and editing them, and sending live events to PagerDuty. It consists of three main components, orchestrated via Docker Compose or run individually for local development.

 ## Architecture

 ```
 Frontend (React, port 3000)
   ↕
 Backend (Node.js/Express, port 5002)
   ↕
 gen_service (Python/Flask, port 5001)
 ```

 ## Directory Structure

 - `/`
   - `docker-compose.yml`: Orchestrates all services.
   - `README.md`: High-level project overview and setup instructions.
   - `CODEBASE_SUMMARY.md`: This summary file.
   - `gen_service/`: Python Flask service for narrative & event generation.
   - `backend/`: Node.js Express API, orchestrates requests & serves frontend.
   - `frontend/`: React application (bootstrapped with Create React App).

 ### gen_service/ (Python Flask service)
 Provides REST APIs and web UI endpoints for generating incident narratives and event payloads, scheduling and sending events to PagerDuty, and previewing/downloading generated outputs. Leverages LangChain and OpenAI SDK for LLM-powered generation.

 - `app.py`: Defines the Flask application (port 5001) and routes:
   - `POST /api/generate`: Programmatic generation of narratives and events for scenarios (`major`, `partial`, `well`).
   - `GET /get_files/<org>`: List generated files for an organization.
   - `GET/POST /event_sender*`: Web UI endpoints to preview, summarize, and send events to PagerDuty.
   - `GET /preview`, `/preview/<org>`, `/preview/<org>/<filename>`: Preview generated narrative and event files; support editing and cleanup.
   - `GET /download/<org>/<filename>`: Download files as attachments.
  
   - `POST /api/generate_sop`: Generate a Standard Operating Procedure (SOP) in Markdown for a specified alert/event file. Returns SOP text and filename, and persists the SOP alongside other artifacts.
   - `POST /api/generate_sop_inline`: Generate a Standard Operating Procedure (SOP) directly from provided event payload JSON. Returns SOP text without persisting a file.
  
   - `GET /preview/<org>/<filename>/postman`: Export events JSON as a Postman collection.
 - `utils.py`: Core generation logic using LangChain LLMChain:
   - `generate_major`, `generate_partial`, `generate_well`: Produce structured JSON narratives with `narrative`, `outage_summary`, and `incident_details`.
   - `generate_*_events`: Generate JSON arrays of event payloads with timing and repeat metadata.
   - `get_llm`, retry logic, and helper functions (`strip_rtf`, `extract_outage_summary`, `extract_incident_details`).
 - `event_sender.py`: Implements event dispatch UI and logic to:
   - Load and clean generated event JSON files.
   - Schedule and repeat events based on metadata.
   - Send payloads to PagerDuty API (`PAGERDUTY_API_URL`).
   - Render schedule summaries and send results.
 - `generate.py`: CLI helper script for direct invocation of generation routines.
 - `templates/`, `static/`: Flask HTML templates and static assets for the web UI.
 - `Dockerfile`, `requirements.txt`, `readme.md`: Containerization, dependencies, and service documentation.

 ### backend/ (Node.js Express API)
 Provides REST endpoints and streaming APIs to orchestrate generation requests and PagerDuty event dispatch, serving as the bridge between the React frontend and the Python gen_service.

 - `src/index.js`: Express server entrypoint; configures CORS, JSON parsing, health check, and mounts all routes.
 - `src/routes/generate.js`: `/api/generate` endpoint to accept generation parameters, forward to the Python gen_service, and handle responses.
 - `src/controllers/generateController.js`: Validates request payloads, calls gen_service (`/api/generate`), and persists returned narratives and events under `generated_files/<org>` with timestamps.
 - `src/services/generateService.js`: (stub/placeholder) for custom in-process generation orchestration or transformations.
 - `src/routes/events.js`: `/api/events/send` POST endpoint for batch event dispatch; `/api/events/stream` GET endpoint for Server-Sent Events (SSE) live streaming of send results.
 - `src/controllers/eventController.js`: Loads event definitions, computes send schedules, and delegates to `eventService` for actual dispatch.
 - `src/services/eventService.js`: Core logic to parse timing metadata, schedule and repeat HTTP calls to PagerDuty (`events.pagerduty.com/v2/enqueue`), and compute schedule summaries.
 - `src/routes/preview.js`: File-browser API:
   - `GET /api/organizations` - list organization directories under `generated_files`.
   - `GET /api/files/:org` - list files for a given organization.
   - `GET /api/preview/:org/:file` - retrieve file content.
   - `POST /api/preview/:org/:file` - save edited file content.
   - `GET /api/download/:org/:file` - download a file.
   - `GET /api/postman/:org/:file` - export events JSON as a Postman collection, preserving routing_key and timing metadata.
 - `src/routes/sop.js`:
   - `POST /api/generate_sop` endpoint to proxy SOP generation requests to the Python `gen_service` and return SOP text and filename.
   - `POST /api/generate_sop/inline` endpoint to proxy inline SOP generation requests: accepts a JSON event payload and returns SOP text without persisting a file.
 - `src/controllers/sopController.js`: Handles validation and forwarding of SOP generation requests; persists SOP `.md` files under `generated_files/<org>`.
 - `generated_files/`: Directory storing per-organization output files: narrative `.txt`, event `.json`, and SOP `.md` files.
 - `package.json`: Node.js dependencies and scripts (`npm start`).
 - `Dockerfile`: Docker configuration for containerizing the backend service.

 ### frontend/ (React, port 3000)
 - Implements a React application bootstrapped with Create React App, serving the UI at http://localhost:3000.
 - Navigation & routing (via React Router):
   - `/` (Dashboard): Select incident scenarios (`major`, `partial`, `well`), enter parameters (organization, ITSM tools, observability tools, service names), and generate narratives & event payloads via the backend `/api/generate` endpoint.
   - `/preview` (Preview): Browse organizations and generated files, view and edit content with a Markdown/JSON editor, save changes (`POST /api/preview/:org/:file`), and download files (`GET /api/download/:org/:file`).
   - `/sop-generator` (SOP Generator): Select an organization and event JSON file, pick one or more events, generate Standard Operating Procedures via `POST /api/generate_sop`, and download the resulting Markdown `.md` files.
   - `/event-sender` (Event Sender): Browse generated event JSON files, enter PagerDuty routing key, send events using Server-Sent Events (`/api/events/stream`), and view schedule summaries and results.
 - `src/`: Source code including:
   - `App.js`: Main application routing and navigation.
   - `pages/`: `Dashboard.js`, `EventSender.js`, `Preview.js`, `SopGenerator.js`.
   - `promptTemplates.js`: Templates for generation prompts.
 - `public/`: Static HTML and assets.
 - `package.json`: Frontend dependencies (React, React Router, Axios, Bootstrap, react-simplemde-editor) and scripts (`npm start`, `npm test`, `npm run build`).
 - `Dockerfile`: Produces optimized production build container.

 ## Key Technologies

 - Python 3.10+, Flask, LangChain, OpenAI SDK
 - Node.js (>=16), Express, Zod, OpenAI SDK
 - React (Create React App)
 - Docker & Docker Compose

 ## Running the Application

 1. Copy `.env.example` or create `.env` at project root:
    ```
    OPENAI_API_KEY=your_key
    ```
 2. Build & run all services:
    ```
    docker-compose up --build
    ```
 3. Access:
    - Frontend UI: http://localhost:3000
    - Backend API: http://localhost:5002
    - Python Gen API: http://localhost:5001

 ## Local Development

 - **gen_service**: `cd gen_service` → `python3 -m venv venv` → `pip install -r requirements.txt` → `python app.py`
 - **backend**: `cd backend` → `npm install` → `npm start`
 - **frontend**: `cd frontend` → `npm install` → `npm start`

 ## Contact & Contribution

 Please refer to `README.md` for contribution guidelines. For quick startup, this file serves as your on-ramp to the codebase.