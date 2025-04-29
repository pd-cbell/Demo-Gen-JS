#!/usr/bin/env bash
set -euo pipefail

# Smoke test for PD Demo Generator (local development)
# Requires: curl, jq

# Check for dependencies
for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: '$cmd' is required but not installed." >&2
    exit 1
  fi
done

DEFAULT_URL="http://localhost:5002"
CONTAINER_URL="http://backend:5002"
# Determine which URL to use for backend API (localhost vs Docker network alias)
BASE_URL="$DEFAULT_URL"
if ! curl -s --connect-timeout 1 "$BASE_URL/" >/dev/null 2>&1; then
  echo "Could not reach $BASE_URL; falling back to $CONTAINER_URL"
  BASE_URL="$CONTAINER_URL"
fi
echo "Using backend URL: $BASE_URL"
ORG="SmokeOrg"
SCENARIO_PAYLOAD=$(cat <<EOF
{
  "org_name": "$ORG",
  "scenarios": ["major"],
  "itsm_tools": "ServiceNOW",
  "observability_tools": "NewRelic",
  "service_names": "Auth,Payments"
}
EOF
)

# Wait for backend to be ready
echo "Waiting for backend API to be available at $BASE_URL..."
for i in {1..10}; do
  if curl -s "$BASE_URL/" >/dev/null 2>&1; then
    echo "Backend is up"
    break
  fi
  echo -n "."
  sleep 2
done
echo
echo "[1/4] Testing /api/generate"
HTTP=$(curl -s -o /tmp/smoke_gen.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/generate" \
  -H "Content-Type: application/json" \
  -d "$SCENARIO_PAYLOAD")
if [ "$HTTP" -ne 200 ]; then
  echo "FAIL: /api/generate returned HTTP $HTTP" >&2
  exit 1
fi

# Validate response keys
for key in message scenarios narratives events change_events; do
  if ! jq -e ".${key}" /tmp/smoke_gen.json >/dev/null; then
    echo "FAIL: key '$key' missing in /api/generate response" >&2
    exit 1
  fi
done

echo "[2/4] Validating Major narrative and events"
# Check narrative
NARRATIVE=$(jq -r '.narratives.major' /tmp/smoke_gen.json)
if [[ "$NARRATIVE" != *"Outage Summary"* ]] || [[ "$NARRATIVE" != *"Incident Narrative"* ]]; then
  echo "FAIL: narrative missing headings" >&2
  exit 1
fi

# Parse events JSON
EVENTS_JSON=$(jq -r '.events.major' /tmp/smoke_gen.json)
if ! jq -e '.' <<<"$EVENTS_JSON" >/dev/null; then
  echo "FAIL: events.major is not valid JSON" >&2
  exit 1
fi
if ! jq -e 'type=="array" and length>0' <<<"$EVENTS_JSON" >/dev/null; then
  echo "FAIL: events.major is not a non-empty JSON array" >&2
  exit 1
fi

echo "[3/4] Testing inline SOP generation (/api/generate_sop/inline)"
# Use inline SOP endpoint with events array
HTTP=$(curl -s -o /tmp/smoke_sop.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/generate_sop/inline" \
  -H "Content-Type: application/json" \
  -d "{ \"events\": $EVENTS_JSON }")
if [ "$HTTP" -ne 200 ]; then
  echo "FAIL: /api/generate_sop/inline returned HTTP $HTTP" >&2
  exit 1
fi
# Extract SOP text
if ! jq -e '.sop_text' /tmp/smoke_sop.json >/dev/null; then
  echo "FAIL: sop_text missing in /api/generate_sop/inline response" >&2
  exit 1
fi
SOP=$(jq -r '.sop_text' /tmp/smoke_sop.json)
# Check for required headings
for heading in "### Overview" "### Triage" "### Escalation" "### Communication" "### Remediation" "### Verification"; do
  if [[ "$SOP" != *"$heading"* ]]; then
    echo "FAIL: SOP missing heading '$heading'" >&2
    exit 1
  fi
done

echo "[4/4] Testing event send (/api/events/send)"
# List files to find the events file
FILES=$(curl -s "$BASE_URL/api/files/$ORG" | jq -r '.files[]')
EVENT_FILE=$(grep '_events_.*\.json' <<<"$FILES" | grep -v change | head -n1)
if [ -z "$EVENT_FILE" ]; then
  echo "FAIL: no events file found for organization $ORG" >&2
  exit 1
fi
HTTP=$(curl -s -o /tmp/smoke_send.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/events/send" \
  -H "Content-Type: application/json" \
  -d "{ \"organization\": \"$ORG\", \"filename\": \"$EVENT_FILE\", \"routing_key\": \"TEST_KEY\" }")
if [ "$HTTP" -ne 200 ]; then
  echo "FAIL: /api/events/send returned HTTP $HTTP" >&2
  exit 1
fi
# Validate schedule_summary and results arrays
if ! jq -e '.schedule_summary | type == "array"' /tmp/smoke_send.json >/dev/null; then
  echo "FAIL: 'schedule_summary' is not an array in /api/events/send response" >&2
  exit 1
fi
if ! jq -e '.results | type == "array" and length > 0' /tmp/smoke_send.json >/dev/null; then
  echo "FAIL: 'results' is not a non-empty array in /api/events/send response" >&2
  exit 1
fi

echo "SMOKE TEST PASSED"
exit 0