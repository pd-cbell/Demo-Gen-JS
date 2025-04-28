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
You are a **Staff Site Reliability Engineer** coaching an on-call engineer who has just been paged. Apply expert SRE best-practices and pragmatic automation thinking.

You are provided a PagerDuty alert payload:

```json
{alert_payload}
```

Generate a runbook / SOP in **Markdown** (no code-block fences in the output) using **exactly** these section headings and in this order:

### Overview  
### Triage  
* In **Triage**, list each check as **Command → Purpose → Validation**.  
  *Example: `traceroute api.example.com` → detect network hops → expect <50ms total; or `SELECT tablespace_name, pct_free FROM dba_free_space` → ensure >15% free.*  
* Flag which of the checks could be automated via PagerDuty Workflows or Process Automation.  
### Escalation  
### Communication  
### Remediation  
### Verification   

**Formatting & Content Rules**

* Start every bullet with an imperative verb (e.g., “Check…”, “Run…”, “Query…”).  
* For **every bullet** in all sections, append `— **Manual:** <N min>; **Saved with Ops Cloud:** <N min>` to quantify current effort vs. time saved when the step is automated with PagerDuty Operations Cloud. Infer which steps could be automated using PagerDuty workflows and Rundeck.
* Use **Escalation** to state clear SEV thresholds and the next team/rotation to page.  
* In **Communication**, describe stakeholder updates (status page, Slack channel, exec briefing) and recommended cadence.  
* Under **Remediation**, include a table with columns **Manual Step | Automatable Step | Tool / Script Suggestion** and propose concrete automation candidates (e.g., “Terraform rollback plan”, “Rundeck job”, “Kubernetes failover script”).  
* In **Verification**, outline how to confirm recovery with health‑checks or synthetic tests.    
* Clearly mark automation opportunities whenever a manual step could be scripted.  
* At the end of **each major section** (Triage, Escalation, Communication, Remediation, Verification) append two lines:  
  `**Estimated manual time:** <N min>`  
  `**Estimated time saved with PagerDuty Ops Cloud:** <N min>`  
  Use the Ops‑Cloud figure to reflect how much faster the step would be if all feasible automations (Event‑Driven Automations, Rundeck jobs, Workflow Actions) were in place.
  
Return only the Markdown SOP text, no additional commentary.
""")
    # Instantiate a configured LLM (with temperature fallback)
    # Use default temperature settings
    llm = utils.get_llm()
    # Create the LLM chain for SOP generation
    chain = LLMChain(llm=llm, prompt=sop_prompt)
    # Generate SOP with retry logic
    sop_text = utils.run_chain_with_retry(chain, {"alert_payload": payload_str})
    return sop_text