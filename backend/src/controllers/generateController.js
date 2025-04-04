// src/controllers/generateController.js
const fs = require('fs');
const path = require('path');

const { ChatOpenAI } = require("langchain/chat_models");
const { ChatPromptTemplate } = require("langchain/prompts");
const { LLMChain } = require("langchain/chains");

// Helper: Remove basic RTF control words
function stripRTF(text) {
  return text.replace(/\\[a-zA-Z0-9]+\b/g, '');
}

// Helper: Extract outage summary from the narrative text
function extractOutageSummary(narrativeText) {
  const plainText = stripRTF(narrativeText);
  const marker = "Outage Summary:";
  if (plainText.includes(marker)) {
    const start = plainText.indexOf(marker) + marker.length;
    const remainder = plainText.substring(start).trim();
    const summaryLine = remainder.split('\n')[0];
    return summaryLine.trim();
  }
  return "";
}

// Helper: Run an LLMChain with retry logic
async function runChainWithRetry(chain, inputs, maxAttempts = 3) {
  let attempt = 0;
  let result = "";
  while (attempt < maxAttempts) {
    // Assuming chain.call returns an object with a 'text' property
    result = (await chain.call(inputs)).text;
    if (result.trim()) {
      return result;
    }
    attempt += 1;
    console.warn(`Chain output blank on attempt ${attempt}. Retrying...`);
  }
  return result;
}

// INCIDENT NARRATIVE FUNCTIONS

async function generateMajor(organization, apiKey, itsm_tools = "ServiceNOW", observability_tools = "NewRelic, Splunk") {
  const majorIncidentTemplate = ChatPromptTemplate.fromTemplate(`
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
  `);

  const llm = new ChatOpenAI({
    temperature: 1,
    modelName: "o1-mini",
    modelKwargs: { maxCompletionTokens: 8192 },
    openAIApiKey: apiKey
  });
  const chain = new LLMChain({ llm, prompt: majorIncidentTemplate, verbose: true });
  const content = await runChainWithRetry(chain, { organization });
  if (content) {
    const outageSummary = extractOutageSummary(content);
    console.log(`[MAJOR] Outage Summary: ${outageSummary}`);
  }
  return content;
}

async function generatePartial(organization, apiKey, itsm_tools = "ServiceNOW", observability_tools = "NewRelic, Splunk") {
  const partialIncidentTemplate = ChatPromptTemplate.fromTemplate(`
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
  `);

  const llm = new ChatOpenAI({
    temperature: 1,
    modelName: "o1-mini",
    modelKwargs: { maxCompletionTokens: 8192 },
    openAIApiKey: apiKey
  });
  const chain = new LLMChain({ llm, prompt: partialIncidentTemplate, verbose: true });
  const content = await runChainWithRetry(chain, { organization });
  if (content) {
    const outageSummary = extractOutageSummary(content);
    console.log(`[PARTIAL] Outage Summary: ${outageSummary}`);
  }
  return content;
}

async function generateWell(organization, apiKey, itsm_tools = "ServiceNOW", observability_tools = "NewRelic, Splunk") {
  const wellIncidentTemplate = ChatPromptTemplate.fromTemplate(`
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
  `);

  const llm = new ChatOpenAI({
    temperature: 1,
    modelName: "o1-mini",
    modelKwargs: { maxCompletionTokens: 8192 },
    openAIApiKey: apiKey
  });
  const chain = new LLMChain({ llm, prompt: wellIncidentTemplate, verbose: true });
  const content = await runChainWithRetry(chain, { organization });
  if (content) {
    const outageSummary = extractOutageSummary(content);
    console.log(`[WELL] Outage Summary: ${outageSummary}`);
  }
  return content;
}

// EVENT GENERATION FUNCTIONS

async function generateMajorEvents(organization, apiKey, itsm_tools, observability_tools, outage_summary, service_names, incident_details) {
  const majorEventsTemplate = ChatPromptTemplate.fromTemplate(`
Generate a JSON array of events for a MAJOR incident scenario for {organization}. The incident is critical.
Generate 10 unique events over a period of 420 seconds starting from T0. 
For each unique event, generate an event object with the following structure:
{
  "payload": {
      "summary": "<string>",
      "severity": "<string>",  // one of "info", "warning", "critical", or "error"
      "source": "<string>",
      "component": "<string>",
      "group": "<string>",
      "class": "<string>",
      "custom_details": { "service_name": "<string>", "<additional_context>": "<value>", ... }
  },
  "event_action": "<trigger or resolve>",
  "timing_metadata": { "schedule_offset": <number> },
  "repeat_schedule": [ { "repeat_count": <number>, "repeat_offset": <number> } ]
}
Ensure that the repeats yield a total of between 50 and 70 events.
Among the 10 unique events, ensure one unique event has its payload.custom_details include { "major_failure": true } and its timing_metadata.schedule_offset is between 120 and 180 seconds.
Use the customer name {organization} and reference the major service names: {service_names}.
Incident Details: {incident_details}
Outage Summary: {outage_summary}
Do not include explicit timestamp values.
Output a properly formatted JSON array.
  `);

  const llm = new ChatOpenAI({
    temperature: 1,
    modelName: "o1-mini",
    modelKwargs: { maxCompletionTokens: 8192 },
    openAIApiKey: apiKey
  });
  const chain = new LLMChain({ llm, prompt: majorEventsTemplate, verbose: true });
  const inputs = {
    organization,
    itsm_tools,
    observability_tools,
    outage_summary,
    service_names,
    incident_details
  };
  let events_content = await runChainWithRetry(chain, inputs);
  events_content = events_content.trim();
  if (events_content.startsWith('```') && events_content.endsWith('```')) {
    events_content = events_content.replace(/```/g, '').trim();
  }
  return events_content;
}

async function generatePartialEvents(organization, apiKey, itsm_tools, observability_tools, outage_summary, service_names, incident_details) {
  const partialEventsTemplate = ChatPromptTemplate.fromTemplate(`
Generate a JSON array of events for a PARTIALLY UNDERSTOOD incident scenario for {organization}. The incident is moderate, with each event having a severity of "warning".
Generate 10 unique events over a period of 420 seconds starting from T0. 
For each unique event, generate an event object with the following structure:
{
  "payload": {
      "summary": "<string>",
      "severity": "warning",
      "source": "<string>",
      "component": "<string>",
      "group": "<string>",
      "class": "<string>",
      "custom_details": { "service_name": "<string>", "<additional_context>": "<value>", ... }
  },
  "event_action": "<trigger or resolve>",
  "timing_metadata": { "schedule_offset": <number> },
  "repeat_schedule": [ { "repeat_count": <number>, "repeat_offset": <number> } ]
}
Ensure that the repeats yield a total of between 50 and 70 events.
Use the customer name {organization} and reference the service names: {service_names}.
Incident Details: {incident_details}
Outage Summary: {outage_summary}
Do not include explicit timestamp values.
Output a properly formatted JSON array.
  `);

  const llm = new ChatOpenAI({
    temperature: 1,
    modelName: "o1-mini",
    modelKwargs: { maxCompletionTokens: 8192 },
    openAIApiKey: apiKey
  });
  const chain = new LLMChain({ llm, prompt: partialEventsTemplate, verbose: true });
  const inputs = {
    organization,
    itsm_tools,
    observability_tools,
    outage_summary,
    service_names,
    incident_details
  };
  let events_content = await runChainWithRetry(chain, inputs);
  events_content = events_content.trim();
  if (events_content.startsWith('```') && events_content.endsWith('```')) {
    events_content = events_content.replace(/```/g, '').trim();
  }
  return events_content;
}

async function generateWellEvents(organization, apiKey, itsm_tools, observability_tools, outage_summary, service_names, incident_details) {
  const wellEventsTemplate = ChatPromptTemplate.fromTemplate(`
Generate a JSON array of events for a WELL-UNDERSTOOD incident scenario for {organization}. The incident is low-severity and resolved almost automatically.
Generate between 2 and 3 events over a period of 420 seconds starting from T0. 
For each event, generate an event object with the following structure:
{
  "payload": {
      "summary": "<string>",
      "severity": "<string>",  // one of "info", "warning", "critical", or "error"
      "source": "<string>",
      "component": "<string>",
      "group": "<string>",
      "class": "<string>",
      "custom_details": { "service_name": "<string>", "<additional_context>": "<value>", ... }
  },
  "event_action": "<trigger or resolve>",
  "timing_metadata": { "schedule_offset": <number> }
}
Use the customer name {organization} and reference the provided well-known service name: {service_names}.
Incident Details: {incident_details}
Outage Summary: {outage_summary}
Do not include explicit timestamp values.
Output a properly formatted JSON array.
  `);

  const llm = new ChatOpenAI({
    temperature: 1,
    modelName: "o1-mini",
    modelKwargs: { maxCompletionTokens: 8192 },
    openAIApiKey: apiKey
  });
  const chain = new LLMChain({ llm, prompt: wellEventsTemplate, verbose: true });
  const inputs = {
    organization,
    itsm_tools,
    observability_tools,
    outage_summary,
    service_names,
    incident_details
  };
  let events_content = await runChainWithRetry(chain, inputs);
  events_content = events_content.trim();
  if (events_content.startsWith('```') && events_content.endsWith('```')) {
    events_content = events_content.replace(/```/g, '').trim();
  }
  return events_content;
}

// Main controller function that handles the generation endpoint
exports.handleGenerate = async (req, res) => {
  try {
    const {
      org_name,
      scenarios = [],
      apiKey,
      itsm_tools,
      observability_tools,
      service_names,
    } = req.body;

    if (!org_name || !apiKey) {
      return res.status(400).json({ message: 'Organization name and API key are required.' });
    }

    const results = {};

    // For each selected scenario, generate narrative and events using LangChain
    for (const scenario of scenarios) {
      if (scenario === 'major') {
        const narrative = await generateMajor(org_name, apiKey, itsm_tools, observability_tools);
        const outage_summary = extractOutageSummary(narrative);
        const events = await generateMajorEvents(org_name, apiKey, itsm_tools, observability_tools, outage_summary, service_names, narrative);
        results[scenario] = { narrative, events };
      } else if (scenario === 'partial') {
        const narrative = await generatePartial(org_name, apiKey, itsm_tools, observability_tools);
        const outage_summary = extractOutageSummary(narrative);
        const events = await generatePartialEvents(org_name, apiKey, itsm_tools, observability_tools, outage_summary, service_names, narrative);
        results[scenario] = { narrative, events };
      } else if (scenario === 'well') {
        const narrative = await generateWell(org_name, apiKey, itsm_tools, observability_tools);
        const outage_summary = extractOutageSummary(narrative);
        const events = await generateWellEvents(org_name, apiKey, itsm_tools, observability_tools, outage_summary, service_names, narrative);
        results[scenario] = { narrative, events };
      }
    }

    // Write files to a local directory (e.g., /generated_files/<org_name>)
    const orgDir = path.join(__dirname, '../../generated_files', org_name);
    if (!fs.existsSync(orgDir)) {
      fs.mkdirSync(orgDir, { recursive: true });
    }

    // Save narrative and events for each scenario
    for (const [scenarioName, content] of Object.entries(results)) {
      const narrativeFilename = `${scenarioName}_narrative.txt`;
      const eventsFilename = `${scenarioName}_events.json`;
      fs.writeFileSync(path.join(orgDir, narrativeFilename), content.narrative, 'utf-8');
      fs.writeFileSync(path.join(orgDir, eventsFilename), content.events, 'utf-8');
    }

    return res.json({
      message: `Scenarios generated for organization: ${org_name}`,
      scenarios: Object.keys(results),
    });
  } catch (error) {
    console.error('Error generating scenarios:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};