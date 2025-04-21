import os
import json
import logging
import requests
import time
from flask import Flask, render_template, request, redirect, url_for, jsonify

PAGERDUTY_API_URL = "https://events.pagerduty.com/v2/enqueue"
GENERATED_FOLDER = 'generated_files'
NODE_EVENTS_URL = os.getenv('NODE_EVENTS_URL', 'http://127.0.0.1:5002/api/events')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def list_organizations():
    """Return a list of organization subdirectories."""
    orgs = []
    base_dir = GENERATED_FOLDER
    if os.path.exists(base_dir):
        for entry in os.listdir(base_dir):
            path = os.path.join(base_dir, entry)
            if os.path.isdir(path):
                orgs.append(entry)
    return orgs

def list_event_files(org):
    """Return a list of JSON event files for a given organization."""
    org_folder = os.path.join(GENERATED_FOLDER, org)
    files = []
    if os.path.exists(org_folder):
        for f in os.listdir(org_folder):
            if f.endswith("events.json") or "events_" in f:  # adjust as needed
                files.append(f)
    return files

def load_event_file(org, filename):
    """Load a JSON event file with cleanup for malformed data."""
    path = os.path.join(GENERATED_FOLDER, org, filename)
    with open(path, 'r') as f:
        content = f.read().strip()

    # Extract the JSON array by finding the first '[' and last ']'
    start_index = content.find("[")
    end_index = content.rfind("]")
    if start_index == -1 or end_index == -1:
        raise ValueError("File does not contain a valid JSON array.")
    content = content[start_index:end_index+1]

    try:
        data = json.loads(content)
        return data
    except json.JSONDecodeError as e:
        logging.error(f"JSON decode error in file {filename}: {e}")
        raise

def prepare_event_payload(event):
    """
    Remove scheduling metadata (timing_metadata and repeat_schedule) from the event.
    Also ensure that the 'custom_details' include the service_name.
    """
    new_event = event.copy()
    new_event.pop("timing_metadata", None)
    new_event.pop("repeat_schedule", None)
    return new_event

def send_event(payload, routing_key):
    """Send a single event payload to PagerDuty."""
    headers = {"Content-Type": "application/json"}
    # Add the routing key to the payload
    payload["routing_key"] = routing_key
    response = requests.post(PAGERDUTY_API_URL, headers=headers, json=payload)
    return response

def event_sender():
    if request.method == 'POST':
        org = request.form.get('organization')
        filename = request.form.get('filename')
        routing_key = request.form.get('routing_key')
        
        # Load the event file
        try:
            events = load_event_file(org, filename)
        except Exception as e:
            logging.error(f"Error loading event file: {e}")
            return f"Error loading file: {e}", 500
        # Build schedule summary for UI
        schedule_summary = []
        for ev in events:
            summary = ev.get('payload', {}).get('summary', '')
            timing = ev.get('timing_metadata', {}) or {}
            initial_offset = timing.get('schedule_offset', 0)
            repeat_schedule = ev.get('repeat_schedule', []) or []
            total_repeats = sum(int(r.get('repeat_count', 0)) for r in repeat_schedule)
            total_sends = 1 + total_repeats
            # Next event offset after initial
            next_offset = None
            if repeat_schedule and repeat_schedule[0].get('repeat_offset') is not None:
                next_offset = repeat_schedule[0].get('repeat_offset')
            schedule_summary.append({
                'summary': summary,
                'initial_offset': initial_offset,
                'total_repeats': total_repeats,
                'total_sends': total_sends,
                'next_offset': next_offset,
            })
        # Process and send each event with delays and repeats
        results = []
        for event in events:
            # Retrieve timing metadata and repeat schedule
            timing = event.get("timing_metadata", {})
            schedule_offset = timing.get("schedule_offset", 0)
            repeat_schedule = event.get("repeat_schedule", [])
            
            # Delay sending based on schedule_offset
            if schedule_offset:
                logging.info(f"Delaying event send by {schedule_offset} seconds for event: {event.get('payload', {}).get('summary', 'N/A')}")
                time.sleep(schedule_offset)
            
            # Prepare payload after delay
            payload = prepare_event_payload(event)
            
            # Send the initial event
            try:
                response = send_event(payload, routing_key)
                results.append({
                    "summary": event.get("payload", {}).get("summary", "N/A"),
                    "attempt": "0",
                    "status_code": response.status_code,
                    "response": response.text,
                    "error": None
                })
            except Exception as e:
                logging.error(f"Error sending event (initial): {e}")
                results.append({
                    "summary": event.get("payload", {}).get("summary", "N/A"),
                    "attempt": "0",
                    "status_code": None,
                    "response": None,
                    "error": str(e)
                })
            
            # Process each repeat schedule entry
            # Process repeat schedules
            for repeat in repeat_schedule:
                repeat_count = repeat.get("repeat_count", 0)
                repeat_offset = repeat.get("repeat_offset", 0)
                for i in range(repeat_count):
                    if repeat_offset:
                        logging.info(f"Waiting {repeat_offset} seconds before repeat attempt {i+1} for event: {event.get('payload', {}).get('summary', 'N/A')}")
                        time.sleep(repeat_offset)
                    try:
                        resp = send_event(payload, routing_key)
                        results.append({
                            "summary": event.get("payload", {}).get("summary", "N/A"),
                            "attempt": f"{i+1}",
                            "status_code": resp.status_code,
                            "response": resp.text,
                            "error": None
                        })
                    except Exception as e:
                        logging.error(f"Error sending event (repeat {i+1}): {e}")
                        results.append({
                            "summary": event.get("payload", {}).get("summary", "N/A"),
                            "attempt": f"{i+1}",
                            "status_code": None,
                            "response": None,
                            "error": str(e)
                        })
        # Render results with schedule summary
        return render_template("event_sender_results.html",
                               results=results,
                               schedule_summary=schedule_summary)
    
    # For GET, render a form that lets the user select organization, event file, and enter a routing key.
    organizations = list_organizations()
    return render_template("event_sender.html", organizations=organizations)

# Route to load event files for a given organization (for use in AJAX or similar)

def get_files(org):
    files = list_event_files(org)
    return json.dumps(files)
    
def event_sender_summary():
    # Return schedule summary without sending events
    org = request.form.get('organization')
    filename = request.form.get('filename')
    try:
        events = load_event_file(org, filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 400
    schedule_summary = []
    for ev in events:
        summary = ev.get('payload', {}).get('summary', '')
        timing = ev.get('timing_metadata', {}) or {}
        initial_offset = timing.get('schedule_offset', 0)
        repeat_schedule = ev.get('repeat_schedule', []) or []
        total_repeats = sum(int(r.get('repeat_count', 0)) for r in repeat_schedule)
        total_sends = 1 + total_repeats
        next_offset = None
        if repeat_schedule and repeat_schedule[0].get('repeat_offset') is not None:
            next_offset = repeat_schedule[0].get('repeat_offset')
        schedule_summary.append({
            'summary': summary,
            'initial_offset': initial_offset,
            'total_repeats': total_repeats,
            'total_sends': total_sends,
            'next_offset': next_offset,
        })
    return jsonify({'schedule_summary': schedule_summary})

def event_sender_send():
    """Proxy event sending to the Node backend asynchronously."""
    org = request.form.get('organization')
    filename = request.form.get('filename')
    routing_key = request.form.get('routing_key')
    payload = {'organization': org, 'filename': filename, 'routing_key': routing_key}
    try:
        # Call Node API to send events in parallel
        response = requests.post(f"{NODE_EVENTS_URL}/send", json=payload)
        data = response.json()
        return jsonify(data)
    except Exception as e:
        logging.error(f"Error proxying send to Node backend: {e}")
        return jsonify({'error': str(e)}), 500