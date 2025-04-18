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

### Python Gen Service
```bash
cd gen_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY="your_key_here"
python app.py
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

1. Generate narratives via the **Frontend**.
2. Preview/edit files in the **Preview** page.
3. Send live events on the **Event Sender** page (batch or live stream).

## Contributing

We welcome contributions! Fork the repo and submit pull requests for:
- Enhancements to prompts
- UI improvements
- Bug fixes or new features
- Documentation updates

## License

This project is licensed under the MIT License.