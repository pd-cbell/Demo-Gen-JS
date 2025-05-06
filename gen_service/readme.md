# gen_service: PD Demo Generator Microservice

The `gen_service` is a Flask microservice for generating incident narratives and structured event payloads for PagerDuty demos, training, and testing. It uses OpenAI's GPT models (via LangChain) to craft engaging incident storyboards (Major, Partial, Well‑Understood) and simulates alert streams through JSON payloads that resemble real PagerDuty events.

All outputs are saved under `backend/generated_files/<ORG>/`, where `<ORG>` is a sanitized organization name. Files are timestamped for easy organization.

## Key Features
 
### Recent Changes
- Prompts updated in `utils.py` to enforce `event_action: trigger` and require `repeat_schedule` as an array of `{repeat_count, repeat_offset}` objects for major, partial, and well event generators.
- Placeholder rendering in `backend/src/services/eventService.js` replaced Lodash templating with regex-based evaluation using `timestamp()` and `faker` helpers, improving stability and eliminating syntax errors on raw JSON fragments.
- Added alias so `faker.datatype.uuid()` now maps to `faker.string.uuid()`, and cleaned up escaped quotes around `'-cluster'` in `cluster_name` placeholders.
- Enhanced `computeScheduleSummary` to normalize numeric and array `repeat_schedule` formats.
- Refactored SSE logic in `backend/src/controllers/eventController.js` to track active send tasks and emit a single `end` event when all tasks complete; headers now always sent at start to prevent MIME errors.

- **Incident Narrative Generation**
  - Structured JSON narratives for Major, Partial, and Well‑Understood incidents.

- **Event Payload Generation**
  - Realistic alert streams with concise `payload.summary` titles representative of observability tools.
  - Includes `severity`, `source`, `component`, `group`, `class`, and rich `custom_details` (e.g., `service_name`, `event_id`, `hostname`, `ip_address`, `cluster_name`).
  - `event_action` of `"trigger"` or `"resolve"`.
  - `timing_metadata.schedule_offset` and `repeat_schedule` to simulate 50–70 events over 420 seconds for major/partial incidents; 2–3 events for well‑understood incidents.
  - One major event flagged with `"major_failure": true` between 120–180s.

- **Event Dispatching**
  - POST to `/event_sender/send` to simulate live event streams (e.g., PagerDuty API).

- **Web UI & Preview**
  - Browse, edit, and download generated files per organization via a simple Flask UI.

- **Organization-Based Storage**
  - Files saved under `backend/generated_files/<ORG>/` with timestamped filenames.

## Project Structure

```
gen_service/                # Flask-based demo generator service
├── app.py                  # Main Flask application entrypoint
├── utils.py                # Narrative & event generation logic (LangChain integrations)
├── event_sender.py         # Event sending & helper functions
├── requirements.txt        # Python dependencies
├── Dockerfile              # Docker image build instructions
├── templates/              # Flask Jinja2 templates
│   ├── event_sender.html
│   ├── event_sender_results.html
│   ├── index.html
│   └── preview.html
├── static/                 # Static assets (CSS, JS)
├── generated_files/        # legacy; outputs are now saved under `backend/generated_files/`
├── readme.md               # This documentation
└── .gitignore
``` 

## Installation

1. **Clone the Repository & Enter the Service Directory:**

   ```bash
   git clone https://github.com/yourusername/pd-demo-generator.git
   cd pd-demo-generator/gen_service
   ```

2. **Set Up a Virtual Environment:**

   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

3. **Install Dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Set Your OpenAI API Key:**

   Set your OpenAI API key as an environment variable:
   
   ```bash
   export OPENAI_API_KEY="your_openai_api_key"
   ```

5. **Optional: Configure LLM Settings via Environment Variables:**

   You can control which OpenAI model and parameters are used for narrative and event generation:

   ```bash
   export OPENAI_MODEL="o3-mini"        # Model to use (default: o3-mini)
   export OPENAI_TEMP=1.0                # Sampling temperature (default: 1.0)
   export OPENAI_MAX_TOKENS=16384        # Max tokens for completions (default: 16384)
   ```

## Usage

1. **Run the Flask App:**

   ```bash
   python app.py
   ```

   The application will start locally on port 5001 (e.g. [http://127.0.0.1:5001](http://127.0.0.1:5001)).

2. **Generate a Demo:**

   - Navigate to the web dashboard.
   - Fill in the form fields including Organization Name, ITSM Tools, Observability Tools, API Key, and Service Name(s).
   - Choose one of the scenarios (Major, Partial, or Well-Understood).
   - Submit the form to generate the incident narrative and event payloads.
   - The output will be saved in an organization-specific subdirectory under `generated_files/`.

3. **Preview & Edit Generated Files:**

   - Use the file browser on the preview page to navigate through organizations and files.
   - Click on a file to view and edit its content.
   - Download the file if needed.

## API Endpoints

- **POST /api/generate**
  - Request JSON body:
    ```json
    {
      "org_name": "string",
      "scenarios": ["major", "partial", "well"],
      "itsm_tools": "string (optional)",
      "observability_tools": "string (optional)",
      "service_names": "string (optional)"
    }
    ```
  - Response JSON:
    ```json
    {
      "message": "Scenarios generated for organization: <org_name>",
      "narratives": {"major": "...", "partial": "...", "well": "..."},
      "events": {"major": "<events JSON>", "partial": "...", "well": "..."},
      "change_events": {"major": "<change events JSON>"}
    }
    ```

- **GET /preview/<org>/<filename>/postman**
  - Export events JSON as a Postman collection for the specified file.
  
**POST /api/generate_diagnostics**
  - Request JSON body:
    ```json
    {
      "org_name": "string",
      "scenario": "major|partial|well",
      "narrative_file": "<scenario>_<timestamp>.txt",
      "files": ["<event_file.json>", "<change_events.json>"]
    }
    ```
  - Response JSON:
    ```json
    {
      "diagnostics": {
        "scenario": "string",
        "narrative": "<full narrative text>",
        "diagnostics": [ ... ]
      },
      "diagnostics_filename": "diagnostics_<timestamp>.json"
    }
    ```

## Configuration

- **Service Name Defaults:**
  - **Major Incident:** "User Authentication, API Nodes, Payment Processing"
  - **Partially Understood Incident:** "API Nodes, Database"
  - **Well-Understood Incident:** "Storage"

- **LLM Configuration via Environment Variables:**
  - `OPENAI_MODEL`: Model to use (default: `o3-mini`).
  - `OPENAI_TEMP`: Sampling temperature (default: `1.0`).
  - `OPENAI_MAX_TOKENS`: Maximum tokens for completions (default: `16384`).

- **Event Generation:**
  The event generation functions in `utils.py` generate structured JSON arrays:
  - **Major and Partial Incidents:** Generate 10 unique events with repeat schedules (to simulate 50–70 events over 420 seconds). For major incidents, one event is flagged with `"major_failure": true`.
  - **Well-Understood Incident:** Generates 2–3 events.

## Contributing

Contributions and improvements are welcome! Please feel free to fork the repository and submit pull requests with enhancements or bug fixes.

## License

This project is licensed under the [MIT License](LICENSE).
