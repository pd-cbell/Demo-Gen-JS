# PD Demo Generator Web App

The PD Demo Generator is a Flask-based web application designed to generate and preview incident narratives and event payloads for demonstration purposes. It leverages OpenAI's language models via LangChain to produce structured incident storyboards and associated event payloads that mimic PagerDuty events. This tool is particularly useful for demonstration, training, or testing scenarios in AIOps and incident management.

## Features

- **Incident Narrative Generation:**
  - Generate realistic incident narratives for various scenarios:
    - Major Incident
    - Partially Understood Incident
    - Well-Understood Incident

- **Event Payload Generation:**
  - Generate structured JSON event payloads that include:
    - A `payload` object with fields such as `summary`, `severity`, `source`, `component`, `group`, `class`, and `custom_details` (which includes `service_name` and additional contextual information).
    - `event_action` (either "trigger" or "resolve").
    - `timing_metadata` with a `schedule_offset`.
    - A `repeat_schedule` for major and partial incidents (defining `repeat_count` and `repeat_offset`) to simulate a total of 50–70 events over 420 seconds.
    - For major incidents, one event is flagged with `"major_failure": true`.

- **Event Sending:**
  - Send generated event payloads using the built-in event sender endpoint to simulate live incident events in your demos.

- **Preview & Editing Interface:**
  - View generated narratives and event payloads in an organization-specific file browser.
  - Edit and download files directly from the web interface.

- **Organization-Specific Output:**
  - Generated outputs are automatically saved in organization-specific subdirectories under `generated_files/`, making it easier to manage multiple customer demos.

## Project Structure

```
PD-Demo-Generator-Web/
├── app.py                  # Main Flask application
├── utils.py                # Contains logic for narrative and event generation
├── event_sender.py         # Logic for sending event payloads
├── templates/
│   ├── event_sender_results.html  # Results page for sent events
│   ├── event_sender.html          # Form to send events
│   ├── index.html                 # Web dashboard and form input interface
│   └── preview.html               # File browser and editing interface for generated outputs
├── static/                # Static assets (CSS, JS, images)
├── generated_files/       # Output directory for narratives and events (auto-generated)
│   ├── OrganizationA/
│   └── OrganizationB/
├── readme.md              # Project overview and documentation
└── .gitignore             # Git ignore file
```

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/yourusername/pd-demo-generator.git
   cd pd-demo-generator
   ```

2. **Set Up a Virtual Environment:**

   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

3. **Install Dependencies:**

   ```bash
   pip install flask langchain openai langchain_community
   ```

   *Note:* Ensure any additional dependencies are installed as needed.

4. **Set Your OpenAI API Key:**

   Set your OpenAI API key as an environment variable:
   
   ```bash
   export OPENAI_API_KEY="your_openai_api_key"
   ```

## Usage

1. **Run the Flask App:**

   ```bash
   python app.py
   ```

   The application will start locally (typically at [http://127.0.0.1:5000](http://127.0.0.1:5000)).

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

## Configuration

- **Service Name Defaults:**
  - **Major Incident:** "User Authentication, API Nodes, Payment Processing"
  - **Partially Understood Incident:** "API Nodes, Database"
  - **Well-Understood Incident:** "Storage"

- **Event Generation:**
  The event generation functions in `utils.py` generate structured JSON arrays:
  - **Major and Partial Incidents:** Generate 10 unique events with repeat schedules (to simulate 50–70 events over 420 seconds). For major incidents, one event is flagged with `"major_failure": true`.
  - **Well-Understood Incident:** Generates 2–3 events.

## Contributing

Contributions and improvements are welcome! Please feel free to fork the repository and submit pull requests with enhancements or bug fixes.

## License

This project is licensed under the [MIT License](LICENSE).
