import json
import logging
from langchain.prompts import ChatPromptTemplate
from langchain.chains import LLMChain
from utils import get_llm, run_chain_with_retry

def generate_custom(
    organization,
    api_key,
    itsm_tools="ServiceNOW",
    observability_tools="NewRelic, Splunk",
    service_names=None,
    symptom=None,
    blast_radius=None
):
    """
    Generate a custom incident narrative based on provided overrides.
    Falls back to defaults when fields are missing.
    Returns a dict with keys: narrative, outage_summary, incident_details.
    """
    # Set defaults
    default_services = "User Authentication, API Nodes, Payment Processing"
    service_names = service_names or default_services
    itsm_tools = itsm_tools or "ServiceNOW"
    observability_tools = observability_tools or "NewRelic, Splunk"
    symptom = symptom or "intermittent elevated error rates across services"
    blast_radius = blast_radius or "multiple critical systems"

    # Prompt for custom scenario generation
    prompt_template = ChatPromptTemplate.from_template("""
You are a Site-Reliability Storyteller tasked with crafting a **CUSTOM** incident scenario.

**Inputs**
- organization: {organization}
- symptom: {symptom}
- blast_radius: {blast_radius}
- core_services: {service_names}
- itsm_tools: {itsm_tools}
- observability_tools: {observability_tools}

**Task**
Write a concise incident narrative in **Markdown** with the exact bold headings below.
Incorporate the provided symptom and blast radius into the narrative.

**Format (keep headings verbatim)**
**Scenario Overview:** 1–2 paragraphs describing impact and scope.
**Incident Narrative:** numbered timeline bullets (`HH:MM TZ`) describing events.
**The Response:** how teams used PagerDuty to address the issue.
**The Resolution:** mitigation steps and next actions.
**Outage Summary:** one-sentence summary.

Return a **JSON** object with keys:
- narrative    # full Markdown narrative
- outage_summary
- incident_details   # only the Incident Narrative section
Do **NOT** wrap the JSON in code fences.
""")
    # Instantiate LLM chain
    llm = get_llm()
    chain = LLMChain(llm=llm, prompt=prompt_template, verbose=False)
    inputs = {
        "organization": organization,
        "symptom": symptom,
        "blast_radius": blast_radius,
        "service_names": service_names,
        "itsm_tools": itsm_tools,
        "observability_tools": observability_tools,
    }
    # Generate and parse output
    try:
        raw = run_chain_with_retry(chain, inputs, max_attempts=3).strip()
        # Strip code fences if present
        if raw.startswith('```') and raw.endswith('```'):
            raw = raw.strip('`').strip()
        data = json.loads(raw)
        return data
    except Exception as e:
        logging.error(f"Error generating custom scenario: {e}\nRaw output: {raw if 'raw' in locals() else ''}")
        raise