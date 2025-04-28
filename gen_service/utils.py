import os
import re
import logging
import json
from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.chains import LLMChain
import datetime
from faker import Faker
faker = Faker()

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
    # Try instantiating ChatOpenAI, fallback if the model does not support temperature
    try:
        return ChatOpenAI(
            temperature=temp,
            model_name=model_name,
            model_kwargs={"max_completion_tokens": max_tokens},
            openai_api_key=api_key
        )
    except TypeError as err:
        logging.warning(f"Model {model_name} does not support 'temperature' parameter: {err}. Retrying without temperature.")
        # Retry without temperature parameter
        return ChatOpenAI(
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
    Generate a **MAJOR** (P1) incident narrative that infers industry & systems from the organization name and avoids generic service labels.
    """
    major_incident_template = ChatPromptTemplate.from_template("""
You are a Site‑Reliability Storyteller.

**Inputs**
- organization: {organization}
- industry: Infer from the organization name
- core_systems: Infer typical critical systems for that industry and based on {service_names}
- itsm_tools: {itsm_tools}
- observability_tools: {observability_tools}

**Task**
Write a P1 **major** incident in **Markdown** with the exact bold headings below.  
❗️Do **NOT** use generic placeholders like “Service A/B”. Use system names that would plausibly exist in the inferred industry (e.g., “Banner‑SIS‑DBWriter”, “Canvas‑Edge‑API”).

**Format (keep headings verbatim)**  
**Scenario Overview:** 1–2 short paragraphs on impact and urgency.  
**Incident Narrative:** numbered timeline bullets (`HH:MM TZ`) describing symptoms and discovery.  
**The Response:** how teams collaborated and how PagerDuty accelerated context & escalation.  
**The Resolution:** mitigation taken, permanent‑fix path, remaining risk.  
**Demo Execution:** which PagerDuty/DataDog/ServiceNow views you’ll show and why.  
**Talk Track for the SC (20‑Minute Demo Flow):** timeline bullets.  
**Outage Summary:** single sentence.

Return a **JSON** object with keys:  
- narrative  
- outage_summary  
- incident_details   # ONLY the Incident Narrative section

Do **NOT** wrap the JSON in code fences.
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
    # Instruct the model to return a structured partial-incident narrative with clear sections
    partial_incident_template = ChatPromptTemplate.from_template("""
You are a Site-Reliability Storyteller.

**Inputs**
- organization: {organization}
- industry: Infer based on the organization name  # e.g. "Higher-Education"
- core_systems: Infer based on the realistic systems for industry and {service_names}  # e.g. "Banner SIS, Canvas LMS, Husky Card Gateway"
- itsm_tools: {itsm_tools}      # keep as-is
- observability_tools: {observability_tools}

**Task**
Write a P3 *partially understood* incident in **Markdown** with the exact bold headings below.
❗️Do **NOT** invent generic names like “Service A/B”.  Pick systems typical for the supplied *industry* and weave them naturally into the story (e.g. “Banner-DB-Writer”, “Canvas-Edge-API”).

**Format (keep headings verbatim)**  
**Scenario Overview:** 1 short paragraph (business impact in plain English).  
**Incident Narrative:** 3-6 bullet points, each a time-stamped fact (e.g. “13:07 ET – Banner-DB latency crossed 800 ms”).  
**The Response:** steps teams took (names roles you’d find at a university: DBA, Network Engineer, Ed-Tech Lead). The focus should be from the perspective of how PagerDuty enhances troubleshooting, response and coordination. 
**The Resolution:** what mitigated the issue & what remains unknown and how PagerDuty played a role in solving the problem.  
**Demo Execution:** how PagerDuty leverages AI and Automation to reduce escalations, improve resolution time and unlock continuous improvement. 
**Talk Track for the SC (15-Minute Demo Flow):** timeline bullets.  
**Outage Summary:** single sentence.

Return a **JSON** object with keys:
- narrative   # full Markdown above
- outage_summary
- incident_details  # ONLY the Incident-Narrative section text

Do **NOT** wrap the JSON in code fences.
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
    Generate a **WELL-UNDERSTOOD** (P5) incident narrative that infers industry & realistic systems from the organization name and avoids generic placeholders.
    The incident resolves automatically via automation.
    """
    # Instruct the model to return a structured well-understood narrative with clear sections
    well_incident_template = ChatPromptTemplate.from_template("""
You are a Site-Reliability Storyteller.

**Inputs**
- organization: {organization}
- industry: Infer from the organization name
- core_systems: Infer typical systems for the industry and {service_names}
- itsm_tools: {itsm_tools}
- observability_tools: {observability_tools}

**Task**
Write a P5 **well-understood** incident in **Markdown** with the exact bold headings below.  
❗️Do **NOT** use generic placeholders like “Service A/B”. Use system names that would plausibly exist (e.g., “Canvas-Edge-API”, “Payment-Gateway-Worker”).

**Format (keep headings verbatim)**  
**Scenario Overview:** 1 short paragraph on the low-severity incident and business context.  
**Incident Narrative:** 2-3 timeline bullets (`HH:MM TZ`) showing automated detection, diagnosis, and fix.  
**The Response:** describe the zero-touch remediation (PagerDuty Runbook Automation, Feature-Flag rollback, etc.).  
**The Resolution:** confirm restoration and any follow-up guardrails.  
**Demo Execution:** which PagerDuty / Automation / AIOps views you’ll click.  
**Talk Track for the SC (10-Minute Demo Flow):** timeline bullets.  
**Outage Summary:** single sentence.

Return a **JSON** object with keys:  
- narrative  
- outage_summary  
- incident_details   # ONLY the Incident Narrative section

Do **NOT** wrap the JSON in code fences.
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
    Generate **8–10 unique events** for a MAJOR incident scenario, with a total event count between **50 and 70**.
    Each event’s custom_details must include "metric_name", "current_value", "threshold", and "service_name".
    """
    major_events_template = ChatPromptTemplate.from_template("""
Generate a JSON **array** of events for a **MAJOR** incident at {organization}.

**Rules**
1. Use only these observability tools for `"source"`: {observability_tools}.
2. Create **8–10 unique alert objects** spanning 420 s (`timing_metadata.schedule_offset` 0‑420).
3. Mix severities: "warning", "critical", and "error" across the alerts.
4. Every alert must be a believable symptom (e.g., "Payment‑API 5xx rate", "SIS‑DB connections").
5. Provide `"repeat_schedule"` so the total events land **between 50 and 70**.
6. `payload.custom_details` MUST include  
   `"metric_name"`, `"current_value"`, `"threshold"`, and `"service_name"` and service_name must use a value from {service_names}.
7. Include *one* special alert whose `custom_details` also contains `"major_failure": true`, '"CUJ Impacted": true' and a `schedule_offset` between 120s and 180s with a severity of Error.

Return only the JSON array — no code fences.
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
    # Generate raw JSON array string (may include placeholder tokens)
    raw = run_chain_with_retry(chain, inputs, max_attempts=3).strip()
    # Strip markdown fences if present
    if raw.startswith('```') and raw.endswith('```'):
        raw = raw.strip('`').strip()
    # Parse the JSON array
    try:
        events = json.loads(raw)
    except Exception as e:
        logging.error(f"Failed to parse JSON major events: {e}\nRaw output: {raw}")
        raise
    # Swap payload.summary with custom_details.description so description drives the alert title
    for ev in events:
        ev_payload = ev.setdefault('payload', {})
        cd = ev_payload.setdefault('custom_details', {})
        if 'description' in cd:
            # Swap summary and description
            old_summary = ev_payload.get('summary', '')
            ev_payload['summary'] = cd['description']
            cd['description'] = old_summary
        # Inject faker placeholder metadata into custom_details
        cd['event_id'] = '{{ faker.datatype.uuid() }}'
        cd['hostname'] = '{{ faker.internet.domainName() }}'
        cd['ip_address'] = '{{ faker.internet.ip() }}'
        cd['cluster_name'] = '{{ faker.commerce.department() + "-cluster" }}'
        ev_payload['custom_details'] = cd
    # Return the augmented JSON with placeholders intact
    return json.dumps(events, indent=2)

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
Use only the provided observability tools as sources: {observability_tools}.
Do not include events or sources from ITSM tools: {itsm_tools}.
Generate 4 to 5 unique events over a period of 420 seconds starting from T0. 
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
Ensure that the repeats yield a total of between 20 and 25 events and that there is variability in number sent for each alert.
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
    # Generate raw JSON array string (may include placeholder tokens)
    raw = run_chain_with_retry(chain, inputs, max_attempts=3).strip()
    # Strip markdown fences if present
    if raw.startswith('```') and raw.endswith('```'):
        raw = raw.strip('`').strip()
    # Parse the JSON array
    try:
        events = json.loads(raw)
    except Exception as e:
        logging.error(f"Failed to parse JSON partial events: {e}\nRaw output: {raw}")
        raise
    # Inject faker placeholder metadata into each event's custom_details
    for ev in events:
        ev_payload = ev.setdefault('payload', {})
        cd = ev_payload.setdefault('custom_details', {})
        # If a description field is present, swap it with the summary to drive alert titles
        if 'description' in cd:
            old_summary = ev_payload.get('summary', '')
            ev_payload['summary'] = cd.get('description', old_summary)
            cd['description'] = old_summary
        # Inject placeholder metadata into custom_details
        cd['event_id'] = '{{ faker.datatype.uuid() }}'
        cd['hostname'] = '{{ faker.internet.domainName() }}'
        cd['ip_address'] = '{{ faker.internet.ip() }}'
        cd['cluster_name'] = '{{ faker.commerce.department() + "-cluster" }}'
        ev_payload['custom_details'] = cd
    # Return the augmented JSON with placeholders intact
    return json.dumps(events, indent=2)

def generate_partial_change_events(organization, api_key, itsm_tools, observability_tools, outage_summary, service_names, incident_details):
    """
    Generate a JSON array with exactly one PagerDuty Change Event API v2 object representing the root cause
    of a PARTIALLY UNDERSTOOD incident scenario.
    """
    # Prompt for a single change event reflecting the root cause
    change_events_template = ChatPromptTemplate.from_template("""
Generate **one** PagerDuty Change Event (API v2 JSON) that MINUTES EARLIER introduced a config drift.

**Context**
- organization: {organization}
- system changed: Infer based on service provided, industry and core_system identified in events
- change type: infra-as-code deploy, DB parameter tweak, feature-flag flip, etc.
- ⚠️  **The change event must NOT reference any outage, incident, symptoms, or alerts.**  
  It should read like a routine operational change recorded by a CI/CD or ITSM system.

**Required keys**
routing_key, event_action="trigger", payload.summary (≤90 chars), payload.timestamp="{{ timestamp(-2700, -900) }}", payload.source (e.g. “GitLab CI Pipeline #8172”),
payload.custom_details: {{"change_ticket": "<SN CHG-ID>", "environment": "<prod|stage>", "author": "<name>"}}

Return a JSON array with that single object, no code fences.
""")
    llm = get_llm()
    chain = LLMChain(llm=llm, prompt=change_events_template, verbose=True)
    inputs = {
        "organization": organization,
        "itsm_tools": itsm_tools,
        "observability_tools": observability_tools,
        "service_names": service_names,
        "outage_summary": outage_summary,
        "incident_details": incident_details
    }
    # Generate and retry if blank
    raw = run_chain_with_retry(chain, inputs, max_attempts=3).strip()
    # Strip markdown fences if present
    if raw.startswith('```') and raw.endswith('```'):
        raw = raw.strip('`').strip()
    # Parse JSON output
    try:
        change_events = json.loads(raw)
    except Exception as e:
        logging.error(f"Failed to parse JSON partial change events: {e}\nRaw output: {raw}")
        raise
    # Inject placeholder tokens for timestamp and custom details
    for ev in change_events:
        ev_payload = ev.setdefault('payload', {})
        # Use a timestamp placeholder between 30m and 60s before now
        ev_payload['timestamp'] = '{{ timestamp(-1800, -60) }}'
        cd = ev_payload.setdefault('custom_details', {})
        cd['change_ticket'] = "{{ 'CHG' + faker.datatype.number({ min: 10000, max: 999999 }) }}"
        cd['environment'] = "{{ faker.helpers.arrayElement(['production','staging','development','testing']) }}"
        ev_payload['custom_details'] = cd
    return json.dumps(change_events, indent=2)
  
def generate_well_change_events(organization, api_key, itsm_tools, observability_tools, outage_summary, service_names, incident_details):
    """
    Generate a JSON array with exactly one PagerDuty Change Event API v2 object representing the automated remediation
    or configuration change for a WELL-UNDERSTOOD incident scenario.
    """
    # Prompt for a single change event reflecting the automated remediation action
    change_events_template = ChatPromptTemplate.from_template("""
Generate **ONE** PagerDuty Change Event (API v2 JSON) that represents the automated remediation for a WELL-UNDERSTOOD incident.

**Context**
- organization: {organization}
- remediation source: choose a realistic automation job (PagerDuty Runbook, GitLab CI, AWS SSM Automation, etc.)
- ⚠️ The change description must NOT mention any outage, incident, or symptoms. It should look like a routine self-healing tweak.

**Required keys**
routing_key, event_action="trigger", payload.summary (≤90 chars), payload.timestamp="{{ timestamp(-900, -60) }}", payload.source,
payload.custom_details: {{"automation_job_id": "<job-ID>", "environment": "<prod|stage>", "author": "<automation-system>"}}

Return a JSON array with that single object, no code fences.
""")
    llm = get_llm()
    chain = LLMChain(llm=llm, prompt=change_events_template, verbose=True)
    inputs = {
        "organization": organization,
        "itsm_tools": itsm_tools,
        "observability_tools": observability_tools,
        "service_names": service_names,
        "outage_summary": outage_summary,
        "incident_details": incident_details
    }
    # Generate and retry if blank
    raw = run_chain_with_retry(chain, inputs, max_attempts=3).strip()
    # Strip markdown fences if present
    if raw.startswith('```') and raw.endswith('```'):
        raw = raw.strip('`').strip()
    # Parse JSON output
    try:
        change_events = json.loads(raw)
    except Exception as e:
        logging.error(f"Failed to parse JSON well change events: {e}\nRaw output: {raw}")
        raise
    # Inject placeholder tokens for timestamp and custom details
    for ev in change_events:
        ev_payload = ev.setdefault('payload', {})
        # Use a timestamp placeholder between 30m and 60s before now
        ev_payload['timestamp'] = '{{ timestamp(-1800, -60) }}'
        cd = ev_payload.setdefault('custom_details', {})
        cd['automation_job_id'] = '{{ faker.datatype.uuid() }}'
        cd['action_type'] = "{{ faker.helpers.arrayElement(['autoscale','hotfix_deploy','config_rollback']) }}"
        ev_payload['custom_details'] = cd
    return json.dumps(change_events, indent=2)

def generate_well_events(organization, api_key, itsm_tools, observability_tools, outage_summary, service_names, incident_details):
    """
    Generate 2–3 unique events for a WELL-UNDERSTOOD incident scenario, with 4–6 total events after repeats.
    Each event’s custom_details must include "metric_name", "current_value", "threshold", and "service_name".
    """
    well_events_template = ChatPromptTemplate.from_template("""
Generate a JSON **array** of events for a **WELL-UNDERSTOOD** incident at {organization}.

**Rules**
1. Use only these observability tools for `"source"`: {observability_tools}.
2. Create **2–3 unique alert objects** spanning 120 s (`timing_metadata.schedule_offset` 0-120).
3. Use severities "info" or "warning"—no critical/error in a P5 scenario.
4. Each alert must be a realistic symptom that automation handled (e.g., "Cache-Hit-Ratio below threshold", "S3-Latency above 300 ms").
5. Provide `"repeat_schedule"` so the total events land **between 4 and 6**.
6. `payload.custom_details` MUST include  
   `"metric_name"`, `"current_value"`, `"threshold"`, and `"service_name"` (value from {service_names}).

Return only the JSON array — no code fences.
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
    # Generate raw JSON array string (may include placeholder tokens)
    raw = run_chain_with_retry(chain, inputs, max_attempts=3).strip()
    # Strip markdown fences if present
    if raw.startswith('```') and raw.endswith('```'):
        raw = raw.strip('`').strip()
    # Parse the JSON array
    try:
        events = json.loads(raw)
    except Exception as e:
        logging.error(f"Failed to parse JSON well events: {e}\nRaw output: {raw}")
        raise
    # Enhance each event: swap description into summary, inject faker placeholders
    for ev in events:
        ev_payload = ev.setdefault('payload', {})
        # Ensure custom_details exists
        cd = ev_payload.setdefault('custom_details', {})
        # Swap summary and description if description field is present
        if 'description' in cd:
            old_summary = ev_payload.get('summary', '')
            ev_payload['summary'] = cd.get('description', old_summary)
            cd['description'] = old_summary
        # Inject placeholder metadata
        cd['event_id'] = '{{ faker.datatype.uuid() }}'
        cd['hostname'] = '{{ faker.internet.domainName() }}'
        cd['ip_address'] = '{{ faker.internet.ip() }}'
        cd['cluster_name'] = '{{ faker.commerce.department() + "-cluster" }}'
        ev_payload['custom_details'] = cd
    # Return the augmented JSON with placeholders intact
    return json.dumps(events, indent=2)

def generate_major_change_events(organization, api_key, itsm_tools, observability_tools, outage_summary, service_names, incident_details):
    """
    Generate **three** PagerDuty Change Event (API v2 JSON) that occurred minutes before the incident and introduced the fault.
    """
    change_events_template = ChatPromptTemplate.from_template("""
Generate **three** PagerDuty Change Event (API v2 JSON) that occurred minutes before the incident and introduced the fault.

**Context**
- organization: {organization}
- change source: choose a realistic CI/CD run or ServiceNow change
- changes impact a realistic change on a realistic application related to {service_names}
- ⚠️ The change description must NOT mention any outage, incident, or symptoms. It should look like a routine production change.

**Required keys**
routing_key, event_action="trigger", payload.summary (≤90 chars), payload.timestamp="{{ timestamp(-2700, -900) }}", payload.source,
payload.custom_details: {{"change_ticket": "<SN CHG‑ID>", "environment": "<prod|stage>", "author": "<name>"}}

Return a JSON array with that single object, no code fences.
""")
    llm = get_llm()
    chain = LLMChain(llm=llm, prompt=change_events_template, verbose=True)
    inputs = {
        "organization": organization,
        "itsm_tools": itsm_tools,
        "observability_tools": observability_tools,
        "service_names": service_names,
        "outage_summary": outage_summary,
        "incident_details": incident_details
    }
    # Generate and retry if blank
    # Generate raw JSON array string (may contain placeholders)
    raw = run_chain_with_retry(chain, inputs, max_attempts=3).strip()
    # Strip markdown fences if present
    if raw.startswith('```') and raw.endswith('```'):
        raw = raw.strip('`').strip()
    # Parse JSON output to overlay placeholder tokens
    try:
        events = json.loads(raw)
    except Exception as e:
        logging.error(f"Failed to parse JSON change events: {e}\nRaw output: {raw}")
        raise
    # Replace actual values with template placeholders for backend resolution
    for ev in events:
        # Use template placeholder for timestamp between 30m and 60s before send time
        ev_payload = ev.setdefault('payload', {})
        ev_payload['timestamp'] = '{{ timestamp(-1800, -60) }}'
        # Inject faker placeholders into custom_details
        cd = ev_payload.setdefault('custom_details', {})
        cd['build_number'] = '{{ faker.datatype.number({ min: 10000, max: 99999 }) }}'
        cd['change_ticket'] = "{{ 'CHG' + faker.datatype.number({ min: 10000, max: 999999 }) }}"
        cd['environment'] = "{{ faker.helpers.arrayElement(['production','staging','development','testing']) }}"
        # Inject faker placeholders into link href and text
        links = ev.get('links')
        if isinstance(links, list) and links:
            link = links[0]
            link['href'] = "{{ faker.internet.url() }}"
            link['text'] = "{{ 'View Change ' + ('CHG' + faker.datatype.number({ min: 10000, max: 999999 })) }}"
    # Return the augmented JSON with placeholders
    return json.dumps(events, indent=2)