import json
import utils
from langchain.prompts import ChatPromptTemplate
from langchain.chains import LLMChain

def generate_sop(event_payload: dict) -> str:
    """
    Generate a Standard Operating Procedure (SOP) for a given alert payload.
    """
    # Serialize the event payload for prompting
    payload_str = json.dumps(event_payload, indent=2)
    # Define the SOP prompt template
    sop_prompt = ChatPromptTemplate.from_template("""
You are a Site Reliability Engineer drafting a Standard Operating Procedure (SOP) for handling a specific alert. Given the following alert payload:

{alert_payload}

Please produce a clear, step-by-step SOP in Markdown format with the following sections (use headings):
- Triage
- Systems or Dashboards that would be reviewed
- Diagnostics that would be checked (e.g. Disk space, tablespace, running processes)
- Likely next steps
- Estimated Time Required in minutes (if multiple people needed, include total time in man-hours)                                                  

Return only the SOP text without any additional commentary or code fences.
""")
    # Instantiate a configured LLM (with temperature fallback)
    # Use default temperature settings
    llm = utils.get_llm()
    # Create the LLM chain for SOP generation
    chain = LLMChain(llm=llm, prompt=sop_prompt)
    # Generate SOP with retry logic
    sop_text = utils.run_chain_with_retry(chain, {"alert_payload": payload_str})
    return sop_text