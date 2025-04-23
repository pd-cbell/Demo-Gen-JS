from flask import Flask, render_template, request, send_from_directory, redirect, url_for, make_response
import json
from event_sender import event_sender, get_files, event_sender_summary, event_sender_send, load_event_file, PAGERDUTY_API_URL
import os
import datetime
import utils

app = Flask(__name__)
# Store generated files in the backend service directory so they are shared
backend_gen_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'generated_files'))
app.config['GENERATED_FOLDER'] = backend_gen_dir
app.add_url_rule('/get_files/<org>', 'get_files', get_files)
app.add_url_rule('/event_sender', 'event_sender', event_sender, methods=['GET', 'POST'])
app.add_url_rule('/event_sender/summary', 'event_sender_summary', event_sender_summary, methods=['POST'])
app.add_url_rule('/event_sender/send', 'event_sender_send', event_sender_send, methods=['POST'])

# Ensure the main generated_files folder exists
if not os.path.exists(app.config['GENERATED_FOLDER']):
    os.makedirs(app.config['GENERATED_FOLDER'])

def sanitize_org(org_name):
    # Basic sanitization: remove spaces and non-alphanumeric characters
    return "".join(c for c in org_name if c.isalnum())

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        # Retrieve form data
        scenario = request.form.get('scenario')
        org_name = request.form.get('org_name')
        itsm_tools = request.form.get('itsm_tools')
        observability_tools = request.form.get('observability_tools')
        api_key = request.form.get('api_key')
        service_names = request.form.get('service_names')
        
        # Set default service names if none provided
        if not service_names:
            if scenario == 'major':
                service_names = "User Authentication, API Nodes, Payment Processing"
            elif scenario == 'partial':
                service_names = "API Nodes, Database"
            elif scenario == 'well':
                service_names = "Storage"
        
        # Generate narrative content and events based on the selected scenario
        if scenario == 'major':
            # Get structured narrative with summary, details, and context
            result = utils.generate_major(
                org_name, api_key, itsm_tools, observability_tools, service_names
            )
            narrative = result['narrative']
            outage_summary = result['outage_summary']
            incident_details = result['incident_details']
            # Generate incident events and change events
            events = utils.generate_major_events(
                org_name, api_key, itsm_tools, observability_tools,
                outage_summary, service_names, incident_details
            )
            change_events = utils.generate_major_change_events(
                org_name, api_key, itsm_tools, observability_tools,
                outage_summary, service_names, incident_details
            )
        elif scenario == 'partial':
            result = utils.generate_partial(
                org_name, api_key, itsm_tools, observability_tools, service_names
            )
            narrative = result['narrative']
            outage_summary = result['outage_summary']
            incident_details = result['incident_details']
            events = utils.generate_partial_events(org_name, api_key, itsm_tools, observability_tools, outage_summary, service_names, incident_details)
        elif scenario == 'well':
            result = utils.generate_well(
                org_name, api_key, itsm_tools, observability_tools, service_names
            )
            narrative = result['narrative']
            outage_summary = result['outage_summary']
            incident_details = result['incident_details']
            events = utils.generate_well_events(org_name, api_key, itsm_tools, observability_tools, outage_summary, service_names, incident_details)
        else:
            narrative = "Invalid scenario selected."
            events = ""
        
        # Create a subdirectory for the organization (sanitize org name)
        org_folder = os.path.join(app.config['GENERATED_FOLDER'], sanitize_org(org_name))
        if not os.path.exists(org_folder):
            os.makedirs(org_folder)
        
        # Save narrative content to a file with a timestamp
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        narrative_filename = f"{scenario}_{timestamp}.txt"
        narrative_path = os.path.join(org_folder, narrative_filename)
        with open(narrative_path, 'w') as f:
            f.write(narrative)
        
        # Save events content to a separate file (JSON)
        events_filename = f"{scenario}_events_{timestamp}.json"
        events_path = os.path.join(org_folder, events_filename)
        with open(events_path, 'w') as f:
            f.write(events)
        # If major scenario, also save change events
        if scenario == 'major':
            change_filename = f"{scenario}_change_events_{timestamp}.json"
            change_path = os.path.join(org_folder, change_filename)
            try:
                with open(change_path, 'w') as cf:
                    cf.write(change_events)
            except NameError:
                # change_events not generated
                pass
        
        # Redirect to the preview page for this organization (listing all files)
        return redirect(url_for('preview_org', org=sanitize_org(org_name)))
        
    return render_template('index.html')

@app.route('/preview/<org>/', methods=['GET'])
def preview_org(org):
    # List all files for the organization subdirectory
    org_folder = os.path.join(app.config['GENERATED_FOLDER'], org)
    if not os.path.exists(org_folder):
        files = []
    else:
        files = os.listdir(org_folder)
    return render_template('preview.html', selected_org=org, files=files)

@app.route('/preview/', methods=['GET'])
def preview_orgs():
    # List all organization folders in the generated_files directory
    orgs = []
    base_dir = app.config['GENERATED_FOLDER']
    if os.path.exists(base_dir):
        for entry in os.listdir(base_dir):
            path = os.path.join(base_dir, entry)
            if os.path.isdir(path):
                orgs.append(entry)
    return render_template('preview.html', organizations=orgs)

@app.route('/preview/<org>/<filename>', methods=['GET', 'POST'])
def preview_file(org, filename):
    file_path = os.path.join(app.config['GENERATED_FOLDER'], org, filename)
    # Handle edits
    if request.method == 'POST':
        edited_content = request.form.get('edited_content')
        with open(file_path, 'w') as f:
            f.write(edited_content)
        return redirect(url_for('preview_file', org=org, filename=filename))
    # On GET, load and cleanup JSON if needed
    content = ''
    if filename.lower().endswith('.json'):
        try:
            # Use load_event_file to parse and clean malformed JSON array
            data = load_event_file(org, filename)
            # Format JSON for preview (do not overwrite original file)
            content = json.dumps(data, indent=2)
        except Exception:
            # Fallback to raw content
            with open(file_path, 'r') as f:
                content = f.read()
    else:
        with open(file_path, 'r') as f:
            content = f.read()
    return render_template('preview.html', selected_org=org, selected_file=filename, content=content)

@app.route('/download/<org>/<filename>')
def download(org, filename):
    directory = os.path.join(app.config['GENERATED_FOLDER'], org)
    return send_from_directory(directory, filename, as_attachment=True)

# New API endpoint for generation (supports multiple scenarios)
@app.route('/api/generate', methods=['POST'])
def api_generate():
    """
    Accepts a JSON body with:
      - org_name: string
      - scenarios: array of strings ["major","partial","well"]
      - itsm_tools, observability_tools, service_names: optional strings
    Uses OPENAI_API_KEY from environment; does not accept api_key in request.
    Generates narrative and events files for each scenario and returns their filenames.
    """
    data = request.get_json() or {}
    org_name = data.get('org_name')
    scenarios = data.get('scenarios')
    itsm_tools = data.get('itsm_tools')
    observability_tools = data.get('observability_tools')
    user_services = data.get('service_names')

    # Validate input
    if not org_name:
        return {"message": "Organization name is required."}, 400
    if not scenarios or not isinstance(scenarios, list):
        return {"message": "Request body must include a 'scenarios' array."}, 400

    # Read API key from environment
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"message": "Server misconfiguration: missing API key."}, 500

    # Ensure output directory exists
    org_folder = os.path.join(app.config['GENERATED_FOLDER'], sanitize_org(org_name))
    os.makedirs(org_folder, exist_ok=True)

    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    narratives = {}
    events_map = {}
    change_events_map = {}

    for scenario in scenarios:
        # Determine service_names for this scenario
        if not user_services:
            if scenario == 'major':
                service_names = "User Authentication, API Nodes, Payment Processing"
            elif scenario == 'partial':
                service_names = "API Nodes, Database"
            elif scenario == 'well':
                service_names = "Storage"
            else:
                # Skip unknown scenario
                continue
        else:
            service_names = user_services

        # Generate narrative (structured JSON) and events
        if scenario == 'major':
            structured = utils.generate_major(
                org_name, api_key, itsm_tools, observability_tools, service_names
            )
            narrative = structured['narrative']
            outage_summary = structured['outage_summary']
            incident_details = structured['incident_details']
            events = utils.generate_major_events(
                org_name, api_key, itsm_tools, observability_tools,
                outage_summary, service_names, incident_details
            )
            # Generate change events for major scenario
            change_events = utils.generate_major_change_events(
                org_name, api_key, itsm_tools, observability_tools,
                outage_summary, service_names, incident_details
            )
        elif scenario == 'partial':
            structured = utils.generate_partial(
                org_name, api_key, itsm_tools, observability_tools, service_names
            )
            narrative = structured['narrative']
            outage_summary = structured['outage_summary']
            incident_details = structured['incident_details']
            events = utils.generate_partial_events(
                org_name, api_key, itsm_tools, observability_tools,
                outage_summary, service_names, incident_details
            )
        elif scenario == 'well':
            structured = utils.generate_well(
                org_name, api_key, itsm_tools, observability_tools, service_names
            )
            narrative = structured['narrative']
            outage_summary = structured['outage_summary']
            incident_details = structured['incident_details']
            events = utils.generate_well_events(
                org_name, api_key, itsm_tools, observability_tools,
                outage_summary, service_names, incident_details
            )
        else:
            continue

        # Save narrative file
        narrative_filename = f"{scenario}_{timestamp}.txt"
        narrative_path = os.path.join(org_folder, narrative_filename)
        with open(narrative_path, 'w') as f:
            f.write(narrative)

        # Save events file
        events_filename = f"{scenario}_events_{timestamp}.json"
        events_path = os.path.join(org_folder, events_filename)
        with open(events_path, 'w') as f:
            f.write(events)
        # Save change events for major scenario
        if scenario == 'major':
            change_filename = f"{scenario}_change_events_{timestamp}.json"
            change_path = os.path.join(org_folder, change_filename)
            with open(change_path, 'w') as cf:
                cf.write(change_events)

        # Collect in-memory outputs
        narratives[scenario] = narrative
        events_map[scenario] = events
        if scenario == 'major':
            change_events_map[scenario] = change_events

    result = {
        "message": f"Scenarios generated for organization: {org_name}",
        "narratives": narratives,
        "events": events_map
    }
    # Include change events where applicable
    if change_events_map:
        result["change_events"] = change_events_map
    return result, 200

@app.route('/preview/<org>/<filename>/postman', methods=['GET'])
def export_postman(org, filename):
    """Export the events JSON as a Postman collection."""
    file_path = os.path.join(app.config['GENERATED_FOLDER'], org, filename)
    # Load and parse JSON
    try:
        with open(file_path, 'r') as f:
            raw = f.read()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = load_event_file(org, filename)
    except Exception as e:
        return f"Error reading file: {e}", 500
    if not isinstance(data, list):
        data = [data]
    # Build Postman collection
    collection = {
        "info": {
            "name": f"{org}_{filename} Postman Collection",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": []
    }
    for idx, ev in enumerate(data):
        # Prepare body, inject routing key variable
        body_obj = dict(ev)
        body_obj['routing_key'] = '{{routing_key}}'
        body_str = json.dumps(body_obj, indent=2)
        # Derive name
        name = None
        if isinstance(ev, dict) and isinstance(ev.get('payload'), dict):
            name = ev['payload'].get('summary')
        if not name:
            name = f"Event {idx+1}"
        # Append request item
        collection['item'].append({
            "name": name,
            "request": {
                "method": "POST",
                "header": [{"key": "Content-Type", "value": "application/json"}],
                "body": {"mode": "raw", "raw": body_str},
                "url": {"raw": PAGERDUTY_API_URL, "protocol": "https", "host": ["events.pagerduty.com"], "path": ["v2", "enqueue"]}
            }
        })
    # Return as downloadable JSON
    resp = make_response(json.dumps(collection, indent=2))
    resp.headers['Content-Type'] = 'application/json'
    resp.headers['Content-Disposition'] = f'attachment; filename={org}_{filename}_postman_collection.json'
    return resp

if __name__ == '__main__':
    app.run(debug=True, port=5001)