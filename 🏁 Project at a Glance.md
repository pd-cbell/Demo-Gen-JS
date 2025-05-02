🏁 Project at a Glance
Demo-Gen-JS is a three-tier demo stack that fabricates incident stories, event payloads, and SOPs for PagerDuty pre-sales.


Layer	Tech	Port	Entrypoint
Frontend	React (CRA)	3000	frontend/ – dashboard, preview & event-sender UIs
API	Node 16 + Express	5002	backend/src/index.js & routes sub-dirs
Gen service	Python 3.10 + Flask + LangChain	5001	gen_service/app.py
Orchestrated by Docker Compose (docker-compose.yml).

📂 Repo Map (short)
bash
Copy
Edit
backend/
  src/index.js            # health route + router
  src/routes/             # generate.js, events.js, preview.js
  src/services/           # eventService.js (faker/lodash templates)

gen_service/
  readme.md               # detailed generator docs
  utils.py                # get_llm(), retry helpers
  generators/             # major / partial / well prompts
  sop_generator.py        # Markdown runbook builder
  app.py                  # Flask REST layer

frontend/
  README.md               # explains dashboard/event-sender UI
  src/…                   # CRA pages & components

tests/smoke_test.sh       # **bash** end-to-end smoke script
CODEBASE_SUMMARY.md       # one-page project map
README.md                 # root quick-start
🔧 Local Run & Smoke Test (Bash)
bash
Copy
Edit
docker compose up -d        # 3 services
bash tests/smoke_test.sh    # curls all major routes
Smoke script workflow ⬇︎

/health check on backend.

POST /api/generate for major | partial | well.

GET /api/preview/<org>/<file> → pipe to jq for JSON parse.

POST /api/generate_sop on first event.

POST /api/events/send (dry-run) then open /api/events/stream and read first SSE line.

Greps backend logs to confirm no "temperature" param when model starts with o3 or o4.

🛠 Key Rules & Conventions
LLM access — always call utils.get_llm(); it strips temperature for o3-* / o4-* models.

SOP bullets end with timing annotation:
— **Manual:** <N min>; **Saved with Ops Cloud:** <N min>
and each section closes with two summary lines showing totals.

Event JSON files must keep Lodash/Faker placeholders ({{ faker… }}) intact through preview and send.

🗝 Env Vars (.env)
ini
Copy
Edit
OPENAI_API_KEY=sk-…
OPENAI_MODEL=o3-mini          # default
OPENAI_TEMP=1.0               # ignored for o3/o4 models
OPENAI_MAX_TOKENS=16384
PAGERDUTY_KEY=…               # optional for live send
🤖 Typical Codex Tasks
Bug fix
“Change deprecated faker.datatype.uuid() to faker.string.uuid() in eventService.js; ensure smoke_test.sh passes.”

Prompt tweak
“Update generators/major.incident to include CUJ impact table.”

Feature
“Add /api/generate_change_events route mirroring existing generators.”

Infra
“Bind-mount ./gen_service in docker-compose for hot-reload.”

✅ Fast Sanity Checks
bash
Copy
Edit
curl -s http://localhost:5002/health
bash tests/smoke_test.sh   # should exit 0
When coding:
• Make focused edits via oboe.edit_file.
• Keep code style & env-var rules.
• Re-run bash tests/smoke_test.sh before commit.