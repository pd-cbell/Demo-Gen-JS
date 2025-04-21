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

 ### gen_service/
 - `app.py`: Main Flask app entrypoint.
 - `utils.py`: Core logic for generating narratives and payloads.
 - `generate.py`, `event_sender.py`: Helper scripts.
 - `templates/`, `static/`: HTML templates & static assets.
 - `Dockerfile`, `requirements.txt`, `readme.md`: Service-specific setup.

 ### backend/
 - `src/`: Source code (routes, controllers, services).
 - `package.json`: Node dependencies & scripts.
 - `Dockerfile`: Container configuration.
 - `generated_files/`: Organization-specific generated outputs (JSON & text).

 ### frontend/
 - `src/`: React components & pages.
 - `public/`: Static HTML & assets.
 - `package.json`: Frontend dependencies & scripts.
 - `Dockerfile`: Container configuration.

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