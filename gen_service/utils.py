import os
import re
import logging
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

def generate_major(organization, api_key, itsm_tools="ServiceNOW", observability_tools="NewRelic, Splunk"):
    """
    Generate a MAJOR/novel incident narrative.
    The narrative includes a detailed demo story with an outage summary.
    """
    major_incident_template = ChatPromptTemplate.from_template("""
Craft a structured and engaging demo story narrative for the organization "{organization}". This narrative should be tailored to a realistic scenario for a customer in your industry, clearly reflecting their challenges. Use the following sections:

1. Scenario Overview: Define a high-impact incident for "{organization}" with a compelling hook.
2. Incident Narrative: Describe the trigger event, symptoms, diagnostic findings, and root cause.
3. The Response: Detail how PagerDuty solves the problem using detection, automation, mobilization, and communication.
4. The Resolution: Explain the speed of resolution, business impact, compliance benefits, and prevention measures.
5. Demo Execution: Highlight key features of the technical infrastructure.
6. Talk Track for the SC (20-Minute Demo Flow): Provide a structured walkthrough including introduction, scenario, results, and a closing call-to-action.

Output the final narrative as plain text. At the end, include a section starting with:

Outage Summary:
Followed by a single line summarizing the outage scenario.
""")
    llm_instance = ChatOpenAI(
        temperature=1,
        model_name="o1-mini",
        model_kwargs={"max_completion_tokens": 8192},
        openai_api_key=api_key
    )
    chain = LLMChain(llm=llm_instance, prompt=major_incident_template, verbose=True)
    content = chain.run(organization=organization)
    if content:
        outage_summary = extract_outage_summary(content)
        logging.info(f"[MAJOR] Outage Summary: {outage_summary}")
    return content

def generate_partial(organization, api_key, itsm_tools="ServiceNOW", observability_tools="NewRelic, Splunk"):
    """
    Generate a PARTIALLY UNDERSTOOD incident narrative.
    This scenario is less severe and includes a partial outage summary.
    """
    partial_incident_template = ChatPromptTemplate.from_template("""
Craft a **Partially Understood** incident scenario for the organization "{organization}". 
This incident should be realistic but less severe (e.g., P3 or P4), where the team has some clues but is uncertain about the root cause. 
Focus on how PagerDuty supports a human-in-the-loop approach for diagnosis or remediation.

Sections to include:
1. Scenario Overview  
2. Incident Narrative  
3. Partial Resolution Strategy  
4. Next Steps or Observations  

Output as plain text. At the end, include a section:
Outage Summary:
Followed by a single line summarizing the incident.
""")
    llm_instance = ChatOpenAI(
        temperature=1,
        model_name="o1-mini",
        model_kwargs={"max_completion_tokens": 8192},
        openai_api_key=api_key
    )
    chain = LLMChain(llm=llm_instance, prompt=partial_incident_template, verbose=True)
    content = chain.run(organization=organization)
    if content:
        outage_summary = extract_outage_summary(content)
        logging.info(f"[PARTIAL] Outage Summary: {outage_summary}")
    return content

def generate_well(organization, api_key, itsm_tools="ServiceNOW", observability_tools="NewRelic, Splunk"):
    """
    Generate a WELL-UNDERSTOOD incident narrative.
    This scenario reflects a low-severity incident that is resolved almost automatically.
    """
    well_incident_template = ChatPromptTemplate.from_template("""
Craft a **Well-Understood** incident scenario for the organization "{organization}". 
This should be a low-severity incident (e.g., P4 or lower) that is resolved almost instantly with automation. 
Show how runbooks and PagerDuty's automation ensure a zero-touch resolution.

Sections to include:
1. Scenario Overview  
2. Incident Narrative  
3. Fully Automated Response  
4. Zero-Touch Resolution  

Output as plain text. At the end, include a section:
Outage Summary:
Followed by a single line summarizing the incident.
""")
    llm_instance = ChatOpenAI(
        temperature=1,
        model_name="o1-mini",
        model_kwargs={"max_completion_tokens": 8192},
        openai_api_key=api_key
    )
    chain = LLMChain(llm=llm_instance, prompt=well_incident_template, verbose=True)
    content = chain.run(organization=organization)
    if content:
        outage_summary = extract_outage_summary(content)
        logging.info(f"[WELL] Outage Summary: {outage_summary}")
    return content

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
    llm_instance = ChatOpenAI(
        temperature=1,
        model_name="o1-mini",
        model_kwargs={"max_completion_tokens": 8192},
        openai_api_key=api_key
    )
    chain = LLMChain(llm=llm_instance, prompt=major_events_template, verbose=True)
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
    llm_instance = ChatOpenAI(
        temperature=1,
        model_name="o1-mini",
        model_kwargs={"max_completion_tokens": 8192},
        openai_api_key=api_key
    )
    chain = LLMChain(llm=llm_instance, prompt=partial_events_template, verbose=True)
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
    llm_instance = ChatOpenAI(
        temperature=1,
        model_name="o1-mini",
        model_kwargs={"max_completion_tokens": 8192},
        openai_api_key=api_key
    )
    chain = LLMChain(llm=llm_instance, prompt=well_events_template, verbose=True)
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