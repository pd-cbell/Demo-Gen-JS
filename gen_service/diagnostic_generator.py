import json
import logging
from langchain.prompts import ChatPromptTemplate
from langchain.chains import LLMChain
from utils import get_llm

def generate_diagnostics(org_name, events, scenario=None, narrative=None):
    """
    Generate multiple Rundeck diagnostic job YAML specs, one per key event.
    1) Use LLM to select exactly 5 key event indices from 'events'.
    2) For each key event, generate a full job spec YAML.
    Inputs:
      - org_name: string
      - scenario: string
      - narrative: full narrative text
      - events: list of event payload dicts
    Returns:
      dict { jobs: [ { index: int, yaml: string } ] }
    """
    # Simplify events for prompts
    simple_events = []
    for idx, ev in enumerate(events):
        summary = ev.get('payload', {}).get('summary') if isinstance(ev, dict) else ''
        simple_events.append({'index': idx, 'summary': summary})

    llm = get_llm()
    # Step 1: Select key events
    select_prompt = ChatPromptTemplate.from_template(
        """
You are a Site Reliability Diagnostics Assistant.
Given the incident scenario and narrative below, and this list of events:
{events}
Select exactly 5 event indices (0-based) that are most critical for diagnostics.
Return only a JSON array of the indices, for example: [0, 3, 5, 7, 9].
Do not include any other text.
"""
    )
    select_chain = LLMChain(llm=llm, prompt=select_prompt, verbose=False)
    try:
        select_raw = select_chain.run(
            events=json.dumps(simple_events),
            scenario=scenario or '',
            narrative=narrative or ''
        ).strip()
        # Expect a JSON array
        key_indices = json.loads(select_raw)
        if not isinstance(key_indices, list):
            raise ValueError("Expected a JSON array of indices")
    except Exception as err:
        logging.error(f"Key event selection failed: {err}")
        key_indices = list(range(min(5, len(simple_events))))

    jobs = []
    # Static YAML wrapper header
    wrapper_header = [
        'defaultTab: nodes',
        f'description: {scenario}',
        'executionEnabled: true',
        f'group: {org_name}',
        'loglevel: INFO',
        "maxMultipleExecutions: '0'",
        'multipleExecutions: true',
        f'name: CodePipeline-Orchestration Diagnostics — {scenario}',
        'nodeFilterEditable: false',
        'options:',
        '  - description: PagerDuty API token',
        '    hidden: true',
        '    label: API Token',
        '    name: api_token',
        '    secure: true',
        '    storagePath: keys/project/PDT-Bell/pdt-bell-labs-key',
        '    valueExposed: true',
        '  - label: PD Incident ID',
        '    name: pd_incident_id',
        '  - label: PD User',
        '    name: pd_user',
        '    value: rundeck@example.com',
        'plugins:',
        '  ExecutionLifecycle:',
        '    Send Incident Output to Pagerduty: {}',
        'runnerSelector:',
        '  runnerFilterMode: LOCAL',
        '  runnerFilterType: LOCAL_RUNNER',
        'scheduleEnabled: true',
        'schedules: []',
    ]

    for idx in key_indices:
        # Prepare event-specific inputs
        ev = simple_events[idx]
        # Step 2: Generate commands block for this event
        job_prompt = ChatPromptTemplate.from_template(
            """
You are a Site Reliability Diagnostics Assistant.
Generate the YAML list items under 'sequence.commands:' for a Rundeck job focusing on event index {event_index}: "{event_summary}".
Use the incident narrative below to shape the diagnostics and customOutput table.
Return only the YAML list items (each beginning with '-'), correctly indented.

narrative: |
{narrative}
"""
        )
        job_chain = LLMChain(llm=llm, prompt=job_prompt, verbose=False)
        try:
            cmds_raw = job_chain.run(
                event_index=idx,
                event_summary=ev['summary'],
                narrative=narrative or ''
            ).strip()
        except Exception as err:
            logging.error(f"Commands generation failed for event {idx}: {err}")
            cmds_raw = ''

        # Assemble full YAML for this job
        lines = wrapper_header.copy()
        lines.append('sequence:')
        lines.append('  commands:')
        for line in cmds_raw.splitlines():
            lines.append(f'    {line}')
        lines.append('  keepgoing: false')
        lines.append('  strategy: node-first')
        lines.append("tags: 'automated,aws,diagnostics'")
        lines.append('id: ""')
        lines.append('uuid: ""')

        job_yaml = '\n'.join(lines)
        jobs.append({'index': idx, 'yaml': job_yaml})

    return {'jobs': jobs}