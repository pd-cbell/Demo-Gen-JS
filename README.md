# PD Demo Generator

This repository provides a complete end-to-end solution for generating incident narratives and event payloads, previewing and editing them, and sending live events to PagerDuty. It consists of three main components:

- **gen_service**: A Flask/Python service that uses LangChain and OpenAI to generate narratives and event JSON.
- **backend**: A Node.js/Express API that orchestrates generation requests and serves as the client-facing API for the React frontend.
- **frontend**: A React application providing a UI for generating, previewing, editing, and sending events.

For detailed documentation, see the README.md files in the `gen_service/`, `backend/`, and `frontend/` directories.

All components can be run locally or via Docker Compose, with environment variables for secure API key configuration.

## Architecture

```
Frontend (React on 3000)  <-->  Backend (Express on 5002)  <-->  gen_service (Flask on 5001)
```

## Prerequisites

- Docker & Docker Compose (recommended)
- (Optional) Node.js & npm for local development
- (Optional) Python 3.10+ & pip for local development
- An OpenAI API key

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `PYTHON_SERVICE_URL`: Override URL for the Python generation service (default: `http://localhost:5001/api/generate`)
- `OPENAI_MODEL`: Model to use (default: `o3-mini`)
- `OPENAI_TEMP`: Sampling temperature (default: `1.0`)
- `OPENAI_MAX_TOKENS`: Maximum tokens for completions (default: `16384`)

## Setup with Docker Compose

1. Create an `.env` file at the project root containing:
   ```bash
   OPENAI_API_KEY=your_key_here
   ```
2. Build and start all services:
   ```bash
   docker-compose up --build
   ```
3. Access the apps:
   - Frontend UI: http://localhost:3000
   - Backend API: http://localhost:5002
   - Python Gen API: http://localhost:5001

## Local Development

### Python Generation & Event UI Service
This Flask microservice provides:
- **Incident Narrative Generation**: structured JSON narratives for Major, Partial, and Well‑Understood incidents via the `/api/generate` endpoint.
- **Event Payload Generation**: realistic alert streams with `payload.summary`, `severity`, `source`, `component`, `group`, `class`, rich `custom_details`, `event_action`, timing metadata, repeat schedules, and `major_failure` flags.
- **Organization-Based Storage**: outputs saved under `backend/generated_files/<ORG>/` with timestamped filenames.
- **Legacy Web UI**: a simple Event Sender form at `/event_sender` (proxies to the Node backend for dispatch).

It listens by default on port 5001 and exposes:
  - `POST /api/generate` for narrative and event JSON generation
  - `GET /event_sender` for the Event Sender UI (legacy)

```bash
cd gen_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Configure your OpenAI key and the Node events API URL
export OPENAI_API_KEY="your_key_here"
export NODE_EVENTS_URL="http://127.0.0.1:5002/api/events"
# Start the Flask app on port 5001
flask run --host=127.0.0.1 --port=5001
```

### Backend (Express)
```bash
cd backend
npm install
export OPENAI_API_KEY="your_key_here"
export PYTHON_SERVICE_URL="http://localhost:5001/api/generate"
npm start
```
  
#### Backend API Endpoints
  
**File Preview & Management**

- `GET /api/preview/organizations` - List available organization directories under `generated_files`.
- `GET /api/preview/files/:org` - List event JSON files for a given organization.
- `GET /api/preview/:org/:file` - Retrieve content of a specific event JSON file.
- `POST /api/preview/:org/:file` - Save updated content of a specific event JSON file.
- `GET /api/preview/download/:org/:file` - Download a specific event JSON file.
- `GET /api/postman/:org/:file` - Export the events JSON file as a Postman collection, preserving routing_key and timing metadata. Returns a downloadable `.json` collection.
  
**SOP Generation**

- `POST /api/generate_sop` - Generate a Standard Operating Procedure (SOP) in Markdown for a specified event file. Request body: `{ org_name, filename, event_index }`. Returns `{ sop_text, sop_filename }` and saves the SOP `.md` file under `generated_files/{org}`.
- `POST /api/generate_sop/inline` - Generate an SOP Markdown directly from a provided event payload JSON. Request body: JSON object with event fields (e.g., title, description, custom_details). Returns `{ sop_text }` without persisting a file.

**Event Sending**
  
- `POST /api/events/send` - Send a batch of events (incident or change). Include `org`, `filename`, and optionally `routing_key` in the request body. Returns send results for each event.
- `GET /api/events/stream` - Server-Sent Events (SSE) endpoint for streaming live send statuses.
  
**Template Engine Enhancements**
  
- Event JSON files support Lodash-style templates using `{{ ... }}`. Helpers available in templates:
  - `timestamp(offsetOrMin, [maxOffset])` for dynamic ISO timestamps with fixed or random offsets.
  - `faker` (Faker.js) to generate realistic fake data, e.g., `{{ faker.name.firstName() }}` or `{{ faker.internet.uuid() }}`.
  
**Change Event Support**
  
- Events including a top-level `routing_key` or `links` field are treated as PagerDuty Change Events and sent to `/v2/change/enqueue`. Other events are sent as incident events to `/v2/enqueue`.
  
**Improved File Selection**
  
- The Preview API now groups files by organization, enabling the UI to display and filter event files from `generated_files/{org}` directories.

### Frontend (React)
```bash
cd frontend
npm install
export CHOKIDAR_USEPOLLING=true
export BROWSER=none
npm start
```

## Usage

1. Use the **Dashboard** in the React frontend (http://localhost:3000) to generate narratives and event payloads.
2. Preview and edit generated JSON files on the **Preview** page; export any JSON file as a Postman collection via the “Export to Postman” button.
3. Generate Standard Operating Procedures (SOPs) on the **SOP Generator** page: select an organization, choose an event JSON file, pick one or more events, and generate SOP markdown files for download.
4. Send live events and monitor status using the **Event Sender** page in the React frontend.
   (Alternatively, use the legacy Flask UI at http://localhost:5001/event_sender.)

## Contributing

We welcome contributions! Fork the repo and submit pull requests for:
- Enhancements to prompts
- UI improvements
- Bug fixes or new features
- Documentation updates

## License

This project is licensed under the MIT License.