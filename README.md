# PD Demo Generator

This repository provides a complete end-to-end solution for generating incident narratives and event payloads, previewing and editing them, and sending live events to PagerDuty. It consists of three main components:

- **gen_service**: A Flask/Python service that uses LangChain and OpenAI to generate narratives and event JSON.
- **backend**: A Node.js/Express API that orchestrates generation requests and serves as the client-facing API for the React frontend.
- **frontend**: A React application providing a UI for generating, previewing, editing, and sending events.

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
This Flask service provides both the narrative/event generation API and a simple web UI for sending events.
It listens by default on port 5001 and exposes:
  - `/api/generate` for narrative and event JSON generation
  - `/event_sender` for the Event Sender form (proxies to the Node backend for parallel dispatch)

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

### Frontend (React)
```bash
cd frontend
npm install
export CHOKIDAR_USEPOLLING=true
export BROWSER=none
npm start
```

## Usage

1. Generate narratives via the **Frontend** (React UI at http://localhost:3000).
2. Preview and edit generated files on the **Preview** page.
3. Send live events using the Event Sender UI at http://localhost:5001/event_sender (proxies to the Node backend for parallel dispatch).

## Contributing

We welcome contributions! Fork the repo and submit pull requests for:
- Enhancements to prompts
- UI improvements
- Bug fixes or new features
- Documentation updates

## License

This project is licensed under the MIT License.