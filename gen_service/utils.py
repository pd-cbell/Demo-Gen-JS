import os
import re
import logging
import json
from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.chains import LLMChain

# Setup logging configuration
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Ensure API key is set via the environment variable
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logging.error("API key not found in environment variables. Please set OPENAI_API_KEY.")
    # Optionally raise an exception here

# Centralized LLM factory: read model, temperature, and token limits from environment
def get_llm(default_temp: float = 1.0):
    """
    Return a ChatOpenAI instance configured via env vars:
      - OPENAI_MODEL (default: o3-mini)
      - OPENAI_TEMP (default: default_temp)
      - OPENAI_MAX_TOKENS (default: 16384)
    """
    model_name = os.getenv("OPENAI_MODEL", "o3-mini")
    try:
        temp = float(os.getenv("OPENAI_TEMP", str(default_temp)))
    except ValueError:
        temp = default_temp
    try:
        max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", "16384"))
    except ValueError:
        max_tokens = 16384
    return ChatOpenAI(
        temperature=temp,
        model_name=model_name,
        model_kwargs={"max_completion_tokens": max_tokens},
        openai_api_key=api_key
    )

def strip_rtf(text):
    """
    Remove basic RTF control words from the text.
    """
    return re.sub(r'\\[a-zA-Z0-9]+\b', '', text)

def extract_outage_summary(narrative_text):
    """
    Extracts the outage summary from the narrative.
    Expects a section starting with "Outage Summary:" followed by a single line.
    """
    plain_text = strip_rtf(narrative_text)
    marker = "Outage Summary:"
    if marker in plain_text:
        start = plain_text.find(marker) + len(marker)
        remainder = plain_text[start:].strip()
        summary_line = remainder.splitlines()[0]
        return summary_line.strip()
    return ""

def extract_incident_details(narrative_text):
    """
    Extracts the detailed Incident Narrative from the narrative text.
    Assumes the narrative contains a section starting with "**Incident Narrative**"
    and ending at the next section marker (e.g., "**The Response**" or "**Talk Track**").
    """
    marker = "**Incident Narrative**"
    if marker in narrative_text:
        start = narrative_text.find(marker) + len(marker)
        # Define possible end markers
        end_markers = ["**The Response**", "**Talk Track**"]
        end = len(narrative_text)
        for m in end_markers:
            idx = narrative_text.find(m, start)
            if idx != -1 and idx < end:
                end = idx
        return narrative_text[start:end].strip()
    return ""

#########################
# HELPER: RETRY LOGIC
#########################

def run_chain_with_retry(chain, inputs, max_attempts=3):
    """
    Runs an LLMChain with provided inputs, retrying if the result is blank.
    """
    attempt = 0
    result = ""
    while attempt < max_attempts:
        result = chain.run(**inputs)
        if result.strip():
            return result
        attempt += 1
        logging.warning(f"Chain output blank on attempt {attempt}. Retrying...")
    return result

#########################
# INCIDENT NARRATIVE FUNCTIONS
#########################

def generate_major(organization, api_key, itsm_tools="ServiceNOW", observability_tools="NewRelic, Splunk", service_names="User Authentication, API Nodes, Payment Processing"):
    """
    Generate a MAJOR/novel incident narrative.
    The narrative includes a detailed demo story with an outage summary.
    """
    # Instruct the model to return a JSON object with narrative, outage_summary, and incident_details
    major_incident_template = ChatPromptTemplate.from_template("""
Your output must be a valid JSON object with exactly these keys:
  - narrative: string, the full prose narrative including all sections.
  - outage_summary: string, a one-line summary of the outage scenario.
  - incident_details: string, the detailed Incident Narrative section.

Context for the narrative (use these values in your story):
- ITSM tools: {itsm_tools}
- Observability tools: {observability_tools}
- Services impacted: {service_names}

Craft a structured and engaging demo story narrative for the organization "{organization}". Tailor it to a realistic scenario for a customer in your industry. Use the following sections internally:
1. Scenario Overview
2. Incident Narrative (detailed)
3. The Response
4. The Resolution
5. Demo Execution
6. Talk Track for the SC (20-Minute Demo Flow)

You do not need to label sections in the narrative field beyond providing the prose. Do not include any RTF. Return ONLY the JSON object.
""")
    # Instantiate LLM
    llm = get_llm()
    chain = LLMChain(llm=llm, prompt=major_incident_template, verbose=True)
    raw = chain.run(
        organization=organization,
        itsm_tools=itsm_tools,
        observability_tools=observability_tools,
        service_names=service_names
    ).strip()
    if raw.startswith("```") and raw.endswith("```"):
        raw = raw.strip("`").strip()
    try:
        data = json.loads(raw)
    except ValueError as e:
        logging.error(f"Failed to parse JSON from model output: {e}")
        raise
    return data

def generate_partial(organization, api_key, itsm_tools="ServiceNOW", observability_tools="NewRelic, Splunk", service_names="API Nodes, Database"):
    """
    Generate a PARTIALLY UNDERSTOOD incident narrative.
    This scenario is less severe and includes a partial outage summary.
    """
    # Instruct the model to return a JSON object with narrative, outage_summary, and incident_details
    partial_incident_template = ChatPromptTemplate.from_template("""
Your output must be a valid JSON object with exactly these keys:
  - narrative: string, full prose narrative of the partially understood incident.
  - outage_summary: string, one-line summary of the incident.
  - incident_details: string, the detailed Incident Narrative section.

Context for the narrative (use these values in your story):
- ITSM tools: {itsm_tools}
- Observability tools: {observability_tools}
- Services impacted: {service_names}

Craft a Partially Understood incident scenario for the organization "{organization}". It should be realistic but less severe (P3/P4), where root cause is uncertain. Focus on human-in-the-loop diagnosis and remediation. Do not include RTF. Return ONLY the JSON object.
""")
    # Instantiate LLM
    llm = get_llm()
    chain = LLMChain(llm=llm, prompt=partial_incident_template, verbose=True)
    raw = chain.run(
        organization=organization,
        itsm_tools=itsm_tools,
        observability_tools=observability_tools,
        service_names=service_names
    ).strip()
    if raw.startswith("```") and raw.endswith("```"):
        raw = raw.strip("`").strip()
    try:
        data = json.loads(raw)
    except ValueError as e:
        logging.error(f"Failed to parse JSON from model output: {e}")
        raise
    return data

def generate_well(organization, api_key, itsm_tools="ServiceNOW", observability_tools="NewRelic, Splunk", service_names="Storage"):
    """
    Generate a WELL-UNDERSTOOD incident narrative.
    This scenario reflects a low-severity incident that is resolved almost automatically.
    """
    # Instruct the model to return a JSON object with narrative, outage_summary, and incident_details
    well_incident_template = ChatPromptTemplate.from_template("""
Your output must be a valid JSON object with exactly these keys:
  - narrative: string, full prose narrative of the well-understood incident.
  - outage_summary: string, one-line summary of the incident.
  - incident_details: string, the detailed Incident Narrative section.

Context for the narrative (use these values in your story):
- ITSM tools: {itsm_tools}
- Observability tools: {observability_tools}
- Services impacted: {service_names}

Craft a Well-Understood incident scenario for the organization "{organization}". It should be low-severity, resolved automatically (zero-touch). Do not include RTF. Return ONLY the JSON object.
""")
    # Instantiate LLM
    llm = get_llm()
    chain = LLMChain(llm=llm, prompt=well_incident_template, verbose=True)
    raw = chain.run(
        organization=organization,
        itsm_tools=itsm_tools,
        observability_tools=observability_tools,
        service_names=service_names
    ).strip()
    if raw.startswith("```") and raw.endswith("```"):
        raw = raw.strip("`").strip()
    try:
        data = json.loads(raw)
    except ValueError as e:
        logging.error(f"Failed to parse JSON from model output: {e}")
        raise
    return data

#########################
# EVENT GENERATION FUNCTIONS
#########################

def generate_major_events(organization, api_key, itsm_tools, observability_tools, outage_summary, service_names, incident_details):
    """
    Generate a JSON array of demo events for a MAJOR incident scenario.
    
    Generate 10 unique events. For each unique event, include:
      - A "timing_metadata" field with a "schedule_offset" (in seconds).
      - A "repeat_schedule" array containing an object with "repeat_count" and "repeat_offset" (in seconds).
    Using these, the total events will be between 50 and 70 over a 420-second period.
    Ensure at least 10 unique events occur, with common failures (e.g., connection issues or iOS page load problems) repeating.
    Additionally, include one unique event whose payload.custom_details includes {{"major_failure": true}} and a schedule_offset between 120 and 180 seconds.
    Each event object should have the following structure:
    {{
       "payload": {{
            "summary": "<string>",
            "severity": "<string>",  // one of "info", "warning", "critical", or "error"
            "source": "<string>",
            "component": "<string>",
            "group": "<string>",
            "class": "<string>",
            "custom_details": {{ "service_name": "<string>", "<additional_context>": "<value>", ... }}
       }},
       "event_action": "<trigger or resolve>",
       "timing_metadata": {{ "schedule_offset": <number> }},
       "repeat_schedule": [ {{ "repeat_count": <number>, "repeat_offset": <number> }} ]
    }}
    Use the customer name {organization} and reference the major service names: {service_names}.
    Include the following context:
      Outage Summary: {outage_summary}
      Incident Details: {incident_details}
    Do not include explicit timestamp values.
    Output a properly formatted JSON array.
    """
    major_events_template = ChatPromptTemplate.from_template("""
Generate a JSON array of events for a MAJOR incident scenario for {organization}. The incident is critical.
Generate 10 unique events over a period of 420 seconds starting from T0. 
For each unique event, generate an event object with the following structure:
{{
  "payload": {{
      "summary": "<string>",
      "severity": "<string>",  // one of "info", "warning", "critical", or "error"
      "source": "<string>",
      "component": "<string>",
      "group": "<string>",
      "class": "<string>",
      "custom_details": {{ "service_name": "<string>", "<additional_context>": "<value>", ... }}
  }},
  "event_action": "<trigger or resolve>",
  "timing_metadata": {{ "schedule_offset": <number> }},
  "repeat_schedule": [ {{ "repeat_count": <number>, "repeat_offset": <number> }} ]
}}
Ensure that the repeats yield a total of between 50 and 70 events.
Among the 10 unique events, ensure one unique event has its payload.custom_details include {{ "major_failure": true }} and its timing_metadata.schedule_offset is between 120 and 180 seconds.
Use the customer name {organization} and reference the major service names: {service_names}.
Incident Details: {incident_details}
Outage Summary: {outage_summary}
Do not include explicit timestamp values.
Output a properly formatted JSON array.
""")
    # Instantiate LLM
    llm = get_llm()
    chain = LLMChain(llm=llm, prompt=major_events_template, verbose=True)
    inputs = {
        "organization": organization,
        "itsm_tools": itsm_tools,
        "observability_tools": observability_tools,
        "outage_summary": outage_summary,
        "service_names": service_names,
        "incident_details": incident_details
    }
    events_content = run_chain_with_retry(chain, inputs, max_attempts=3)
    events_content = events_content.strip()
    if events_content.startswith('```') and events_content.endswith('```'):
        events_content = events_content.strip('`').strip()
    return events_content

def generate_partial_events(organization, api_key, itsm_tools, observability_tools, outage_summary, service_names, incident_details):
    """
    Generate a JSON array of demo events for a PARTIALLY UNDERSTOOD incident scenario.
    
    Generate 10 unique events with a repeat schedule so that the total events number between 50 and 70 over 420 seconds.
    Each event should have a severity of "warning".
    Use the customer name {organization} and reference the service names: {service_names}.
    Incident Details: {incident_details}
    Outage Summary: {outage_summary}
    Do not include explicit timestamp values.
    Output a properly formatted JSON array.
    """
    partial_events_template = ChatPromptTemplate.from_template("""
Generate a JSON array of events for a PARTIALLY UNDERSTOOD incident scenario for {organization}. The incident is moderate, with each event having a severity of "warning".
Generate 10 unique events over a period of 420 seconds starting from T0. 
For each unique event, generate an event object with the following structure:
{{
  "payload": {{
      "summary": "<string>",
      "severity": "warning",
      "source": "<string>",
      "component": "<string>",
      "group": "<string>",
      "class": "<string>",
      "custom_details": {{ "service_name": "<string>", "<additional_context>": "<value>", ... }}
  }},
  "event_action": "<trigger or resolve>",
  "timing_metadata": {{ "schedule_offset": <number> }},
  "repeat_schedule": [ {{ "repeat_count": <number>, "repeat_offset": <number> }} ]
}}
Ensure that the repeats yield a total of between 50 and 70 events.
Use the customer name {organization} and reference the service names: {service_names}.
Incident Details: {incident_details}
Outage Summary: {outage_summary}
Do not include explicit timestamp values.
Output a properly formatted JSON array.
""")
    # Instantiate LLM
    llm = get_llm()
    chain = LLMChain(llm=llm, prompt=partial_events_template, verbose=True)
    inputs = {
        "organization": organization,
        "itsm_tools": itsm_tools,
        "observability_tools": observability_tools,
        "outage_summary": outage_summary,
        "service_names": service_names,
        "incident_details": incident_details
    }
    events_content = run_chain_with_retry(chain, inputs, max_attempts=3)
    events_content = events_content.strip()
    if events_content.startswith('```') and events_content.endswith('```'):
        events_content = events_content.strip('`').strip()
    return events_content

def generate_well_events(organization, api_key, itsm_tools, observability_tools, outage_summary, service_names, incident_details):
    """
    Generate a JSON array of demo events for a WELL-UNDERSTOOD incident scenario.
    
    Generate between 2 and 3 events for the well-known incident.
    Each event must include a "timing_metadata" field with a "schedule_offset" (in seconds) starting from T0.
    Use the customer name {organization} and reference the provided well-known service name: {service_names}.
    Incident Details: {incident_details}
    Outage Summary: {outage_summary}
    Do not include explicit timestamp values.
    Output a properly formatted JSON array.
    """
    well_events_template = ChatPromptTemplate.from_template("""
Generate a JSON array of events for a WELL-UNDERSTOOD incident scenario for {organization}. The incident is low-severity and resolved almost automatically.
Generate between 2 and 3 events over a period of 420 seconds starting from T0. 
For each event, generate an event object with the following structure:
{{
  "payload": {{
      "summary": "<string>",
      "severity": "<string>",  // one of "info", "warning", "critical", or "error"
      "source": "<string>",
      "component": "<string>",
      "group": "<string>",
      "class": "<string>",
      "custom_details": {{ "service_name": "<string>", "<additional_context>": "<value>", ... }}
  }},
  "event_action": "<trigger or resolve>",
  "timing_metadata": {{ "schedule_offset": <number> }}
}}
Use the customer name {organization} and reference the provided well-known service name: {service_names}.
Incident Details: {incident_details}
Outage Summary: {outage_summary}
Do not include explicit timestamp values.
Output a properly formatted JSON array.
""")
    # Instantiate LLM
    llm = get_llm()
    chain = LLMChain(llm=llm, prompt=well_events_template, verbose=True)
    inputs = {
        "organization": organization,
        "itsm_tools": itsm_tools,
        "observability_tools": observability_tools,
        "outage_summary": outage_summary,
        "service_names": service_names,
        "incident_details": incident_details
    }
    events_content = run_chain_with_retry(chain, inputs, max_attempts=3)
    events_content = events_content.strip()
    if events_content.startswith('```') and events_content.endswith('```'):
        events_content = events_content.strip('`').strip()
    return events_content