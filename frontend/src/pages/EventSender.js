// frontend/src/pages/EventSender.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE from '../config';

const EventSender = () => {
  /**
   * Convert a machine filename like 'major_events_20250421T160430824Z.json'
   * into a human-readable label like 'Major Events 4-21-25T824Z'.
   */
  const formatFileLabel = (file) => {
    // Remove extension
    const name = file.replace(/\.[^.]+$/, '');
    const parts = name.split('_');
    if (parts.length < 3) return file;
    // Scenario is first part
    const scenario = parts[0];
    // Middle parts represent type (e.g., ['events'] or ['change','events'])
    const typeParts = parts.slice(1, parts.length - 1);
    // Timestamp token is last part
    const ts = parts[parts.length - 1];
    // Parse timestamp: YYYYMMDDThhmmssSSSZ
    const [datePart, timePartZ] = ts.split('T');
    if (!datePart || !timePartZ) return file;
    // Extract date components
    const year = parseInt(datePart.slice(0, 4), 10);
    const month = parseInt(datePart.slice(4, 6), 10);
    const day = parseInt(datePart.slice(6, 8), 10);
    const shortYear = year % 100;
    // Extract milliseconds (last 3 digits before 'Z')
    const msMatch = timePartZ.match(/(\d+)Z$/);
    const msAll = msMatch ? msMatch[1] : timePartZ;
    const ms = msAll.slice(-3);
    // Build label parts
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const scenarioLabel = cap(scenario);
    const typeLabel = typeParts.map(cap).join(' ');
    const dateLabel = `${month}-${day}-${shortYear}`;
    return `${scenarioLabel} ${typeLabel} ${dateLabel}T${ms}Z`;
  };
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  // Sending state
  const [routingKey, setRoutingKey] = useState('');
  const [progress, setProgress] = useState(false);
  const [scheduleSummary, setScheduleSummary] = useState([]);
  const [results, setResults] = useState([]);
  // Optional change events
  const [changeRoutingKey, setChangeRoutingKey] = useState('');
  const [changeSelectedFile, setChangeSelectedFile] = useState('');
  const [changeScheduleSummary, setChangeScheduleSummary] = useState([]);
  const [changeResults, setChangeResults] = useState([]);
  const [changeProgress, setChangeProgress] = useState(false);

  useEffect(() => {
    // Fetch organizations from backend API
    axios.get(`${API_BASE}/organizations`)
      .then((res) => setOrganizations(res.data.organizations))
      .catch((err) => console.error(err));
  }, []);
  // Clear form and results when organization changes
  useEffect(() => {
    setSelectedFile('');
    setRoutingKey('');
    setProgress(false);
    setScheduleSummary([]);
    setResults([]);
    setChangeSelectedFile('');
    setChangeRoutingKey('');
    setChangeProgress(false);
    setChangeScheduleSummary([]);
    setChangeResults([]);
  }, [selectedOrg]);

  const handleOrgChange = (e) => {
    setSelectedOrg(e.target.value);
    // Fetch event files for the selected organization
    axios.get(`${API_BASE}/files/${e.target.value}`)
      .then((res) => setFiles(res.data.files))
      .catch((err) => console.error(err));
  };
  // Handle change event file selection
  const handleChangeFileSelect = (e) => setChangeSelectedFile(e.target.value);

  /**
   * Handle the unified send of incident and optional change events in parallel via SSE.
   */
  const handleSend = (e) => {
    e.preventDefault();
    // Reset state
    setProgress(true);
    setScheduleSummary([]);
    setResults([]);
    setChangeScheduleSummary([]);
    setChangeResults([]);
    // Determine streams to open
    let activeStreams = 0;
    let finishedStreams = 0;
    const checkDone = () => {
      finishedStreams++;
      if (finishedStreams >= activeStreams) {
        setProgress(false);
      }
    };
    // Incident events stream
    if (selectedFile) {
      activeStreams++;
      const params = new URLSearchParams({
        organization: selectedOrg,
        filename: selectedFile,
        routing_key: routingKey,
      });
      const source = new EventSource(
        `${API_BASE}/events/stream?${params.toString()}`
      );
      source.addEventListener('schedule', (e) => {
        try {
          setScheduleSummary(JSON.parse(e.data));
        } catch {}
      });
      source.addEventListener('result', (e) => {
        try { setResults((prev) => [...prev, JSON.parse(e.data)]); } catch {}
      });
      source.addEventListener('end', () => { source.close(); checkDone(); });
      source.addEventListener('error', () => { source.close(); checkDone(); });
    }
    // Change events stream (optional)
    if (changeSelectedFile) {
      activeStreams++;
      const params = new URLSearchParams({
        organization: selectedOrg,
        filename: changeSelectedFile,
        routing_key: changeRoutingKey,
      });
      const source = new EventSource(
        `${API_BASE}/events/stream?${params.toString()}`
      );
      source.addEventListener('schedule', (e) => {
        try {
          setChangeScheduleSummary(JSON.parse(e.data));
        } catch {}
      });
      source.addEventListener('result', (e) => {
        try { setChangeResults((prev) => [...prev, JSON.parse(e.data)]); } catch {}
      });
      source.addEventListener('end', () => { source.close(); checkDone(); });
      source.addEventListener('error', () => { source.close(); checkDone(); });
    }
    // If no streams, just clear progress
    if (activeStreams === 0) {
      setProgress(false);
    }
  };
  
  // Submit change events via SSE
  const handleChangeSubmit = (e) => {
    e.preventDefault();
    setChangeProgress(true);
    setChangeScheduleSummary([]);
    setChangeResults([]);
    const params = new URLSearchParams({
      organization: selectedOrg,
      filename: changeSelectedFile,
      routing_key: changeRoutingKey,
    });
    const source = new EventSource(
      `${API_BASE}/events/stream?${params.toString()}`
    );
    source.addEventListener('schedule', (e) => {
      try {
        const data = JSON.parse(e.data);
        setChangeScheduleSummary(data);
      } catch (err) {
        console.error('Error parsing schedule data:', err);
      }
    });
    source.addEventListener('result', (e) => {
      try {
        const result = JSON.parse(e.data);
        setChangeResults((prev) => [...prev, result]);
      } catch (err) {
        console.error('Error parsing result data:', err);
      }
    });
    source.addEventListener('end', () => {
      setChangeProgress(false);
      source.close();
    });
    source.addEventListener('error', (err) => {
      console.error('EventSource failed:', err);
      setChangeProgress(false);
      source.close();
    });
  };

  return (
    <div>
      <h1>Event Sender</h1>
      <form onSubmit={handleSend}>
        <div className="form-group">
          <label>Organization</label>
          <select className="form-control" value={selectedOrg} onChange={handleOrgChange}>
            <option value="">Select Organization</option>
            {organizations.map((org) => (
              <option key={org} value={org}>{org}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Event File</label>
          <select className="form-control" value={selectedFile} onChange={(e) => setSelectedFile(e.target.value)}>
            <option value="">Select an event file</option>
            {files
              .filter((file) => {
                const f = file.toLowerCase();
                return f.endsWith('.json') && f.includes('events') && !f.includes('change');
              })
              .map((file) => (
                <option key={file} value={file}>{formatFileLabel(file)}</option>
              ))}
          </select>
        </div>
        <div className="form-group">
          <label>PagerDuty Routing Key</label>
          <input
            type="text"
            className="form-control"
            value={routingKey}
            onChange={(e) => setRoutingKey(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={progress || !selectedFile}>
          {progress ? 'Sending Events...' : 'Send Events'}
        </button>
      </form>
      {progress && (
        <div className="mt-4">
          <div className="progress">
            <div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: '100%' }}></div>
          </div>
          <p>Sending events... Please wait.</p>
        </div>
      )}
      {/* Schedule summary */}
      {!progress && scheduleSummary.length > 0 && (
        <div className="mt-4">
          <h3>Schedule Summary</h3>
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Summary</th>
                <th>Total Sends</th>
                <th>Repeat Count</th>
                <th>Initial Delay (s)</th>
                <th>Next Offset (s)</th>
              </tr>
            </thead>
            <tbody>
              {scheduleSummary.map((ev, idx) => (
                <tr key={idx}>
                  <td>{ev.summary}</td>
                  <td>{ev.total_sends}</td>
                  <td>{ev.total_repeats}</td>
                  <td>{ev.initial_offset}</td>
                  <td>{ev.next_offset != null ? ev.next_offset : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {results.length > 0 && (
        <div className="mt-4">
          <h3>Results:</h3>
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>Summary</th>
                <th>Status Code</th>
                <th>Response</th>
                <th>Attempt</th>
              </tr>
            </thead>
            <tbody>
              {results.map((res, idx) => (
                <tr key={idx}>
                  <td>{res.summary}</td>
                  <td>{res.status_code}</td>
                  <td>{JSON.stringify(res.response)}</td>
                  <td>{res.attempt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selectedOrg && (
        <>
          {/* Change Events Section */}
          <hr />
          <h2 className="mt-4">Change Events</h2>
          <form onSubmit={handleChangeSubmit}>
        <div className="form-group">
          <label>Change Event File</label>
          <select
            className="form-control"
            value={changeSelectedFile}
            onChange={handleChangeFileSelect}
          >
            <option value="">Select a change event file</option>
            {files
              .filter((file) => {
                const f = file.toLowerCase();
                return f.endsWith('.json') && f.includes('change_events');
              })
              .map((file) => (
                <option key={file} value={file}>{formatFileLabel(file)}</option>
              ))}
          </select>
        </div>
        <div className="form-group">
          <label>Change Event Routing Key</label>
          <input
            type="text"
            className="form-control"
            value={changeRoutingKey}
            onChange={(e) => setChangeRoutingKey(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-secondary" disabled={changeProgress || !changeSelectedFile}>
          {changeProgress ? 'Sending Change Events...' : 'Send Change Events'}
        </button>
      </form>
      {changeProgress && (
        <div className="mt-4">
          <div className="progress">
            <div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: '100%' }}></div>
          </div>
          <p>Sending change events... Please wait.</p>
        </div>
      )}
      {!changeProgress && changeScheduleSummary.length > 0 && (
        <div className="mt-4">
          <h3>Change Schedule Summary</h3>
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Summary</th>
                <th>Total Sends</th>
                <th>Repeat Count</th>
                <th>Initial Delay (s)</th>
                <th>Next Offset (s)</th>
              </tr>
            </thead>
            <tbody>
              {changeScheduleSummary.map((ev, idx) => (
                <tr key={idx}>
                  <td>{ev.summary}</td>
                  <td>{ev.total_sends}</td>
                  <td>{ev.total_repeats}</td>
                  <td>{ev.initial_offset}</td>
                  <td>{ev.next_offset != null ? ev.next_offset : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {changeResults.length > 0 && (
        <div className="mt-4">
          <h3>Change Results:</h3>
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>Summary</th>
                <th>Status Code</th>
                <th>Response</th>
                <th>Attempt</th>
              </tr>
            </thead>
            <tbody>
              {changeResults.map((res, idx) => (
                <tr key={idx}>
                  <td>{res.summary}</td>
                  <td>{res.status_code}</td>
                  <td>{JSON.stringify(res.response)}</td>
                  <td>{res.attempt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default EventSender;
