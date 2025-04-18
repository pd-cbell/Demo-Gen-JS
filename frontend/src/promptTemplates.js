// frontend/src/promptTemplates.js
// Prompt template snippets for display in the UI.
export const promptTemplates = {
  major: {
    narrative: `Craft a structured and engaging demo story narrative for the organization "{organization}". This narrative should follow the outline:
1. Scenario Overview
2. Incident Narrative
3. The Response
4. The Resolution
5. Demo Execution
6. Talk Track for the SC (20‑Minute Demo Flow)
At the end, include a section starting with "Outage Summary:" followed by a single line summary.`,
    events: `Generate a JSON array of events for a MAJOR incident scenario for {organization}. Produce 10 unique events over 420 seconds, with repeats totaling between 50 and 70 events. Include one event with {"major_failure": true} between 120–180 seconds. Use the organization name and outage summary. Output a properly formatted JSON array.`,
  },
  partial: {
    narrative: `Craft a Partially Understood incident scenario for the organization "{organization}". Include:
1. Scenario Overview
2. Incident Narrative
3. Partial Resolution Strategy
4. Next Steps or Observations
At the end, include "Outage Summary:" with a single line summary.`,
    events: `Generate a JSON array of events for a PARTIALLY UNDERSTOOD incident scenario for {organization}. Produce 10 unique warning‑level events over 420 seconds with repeats totaling 50–70 events. Use the organization name and outage summary. Output a properly formatted JSON array.`,
  },
  well: {
    narrative: `Craft a Well‑Understood incident scenario for the organization "{organization}". Include:
1. Scenario Overview
2. Incident Narrative
3. Fully Automated Response
4. Zero‑Touch Resolution
At the end, include "Outage Summary:" with a single line summary.`,
    events: `Generate a JSON array of events for a WELL‑UNDERSTOOD incident scenario for {organization}. Produce 2–3 events over 420 seconds. Use the organization name and outage summary. Output a properly formatted JSON array.`,
  },
};