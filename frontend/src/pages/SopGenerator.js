// frontend/src/pages/SopGenerator.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE from '../config';

const SopGenerator = () => {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [events, setEvents] = useState([]);
  const [jsonError, setJsonError] = useState(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState([]);
  // Blended SOP state
  const [isGeneratingBlended, setIsGeneratingBlended] = useState(false);
  const [blendedSop, setBlendedSop] = useState(null);

  useEffect(() => {
    // Fetch list of organizations
    axios.get(`${API_BASE}/organizations`)
      .then(res => setOrganizations(res.data.organizations || []))
      .catch(err => console.error('Error fetching organizations:', err));
  }, []);

  const fetchFiles = (org) => {
    axios.get(`${API_BASE}/files/${org}`)
      .then(res => setFiles(res.data.files || []))
      .catch(err => console.error('Error fetching files:', err));
  };

  const handleOrgSelect = (org) => {
    setSelectedOrg(org);
    setSelectedFile('');
    setEvents([]);
    setJsonError(null);
    setResults([]);
    setSelectedIndices([]);
    fetchFiles(org);
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setEvents([]);
    setJsonError(null);
    setResults([]);
    setSelectedIndices([]);
    setIsLoadingEvents(true);
    axios.get(`${API_BASE}/preview/${selectedOrg}/${file}`)
      .then(res => {
        try {
          const data = JSON.parse(res.data.content);
          // Normalize to array
          const arr = Array.isArray(data) ? data : [data];
          setEvents(arr);
        } catch (e) {
          setJsonError('Failed to parse JSON events file.');
        }
      })
      .catch(err => {
        console.error('Error loading file content:', err);
        setJsonError('Failed to load file content.');
      })
      .finally(() => setIsLoadingEvents(false));
  };

  const handleToggle = (idx) => (e) => {
    if (e.target.checked) {
      setSelectedIndices(prev => [...prev, idx]);
    } else {
      setSelectedIndices(prev => prev.filter(i => i !== idx));
    }
  };

  const handleGenerate = async () => {
    if (!selectedOrg || !selectedFile || selectedIndices.length === 0) return;
    setIsGenerating(true);
    setResults([]);
    try {
      const promises = selectedIndices.map(idx =>
        axios.post(`${API_BASE}/generate_sop`, {
          org_name: selectedOrg,
          filename: selectedFile,
          event_index: idx
        })
        .then(res => ({ idx, sopText: res.data.sop_text, sopFilename: res.data.sop_filename }))
        .catch(err => ({ idx, error: err.response?.data?.message || err.message }))
      );
      const respArr = await Promise.all(promises);
      setResults(respArr);
    } catch (e) {
      console.error('Error generating SOPs:', e);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Generate a blended SOP from multiple selected events
  const handleGenerateBlended = async () => {
    if (!selectedOrg || !selectedFile || selectedIndices.length < 2) return;
    setIsGeneratingBlended(true);
    setBlendedSop(null);
    try {
      const response = await axios.post(`${API_BASE}/generate_sop/blended`, {
        org_name: selectedOrg,
        filename: selectedFile,
        event_indices: selectedIndices
      });
      setBlendedSop({ sopText: response.data.sop_text });
    } catch (err) {
      console.error('Error generating blended SOP:', err);
      const errMsg = err.response?.data?.message || err.message;
      setBlendedSop({ error: errMsg });
    } finally {
      setIsGeneratingBlended(false);
    }
  };

  // Filter JSON event files
  const jsonFiles = files.filter(f => f.toLowerCase().endsWith('.json'));

  return (
    <div>
      <h1>SOP Generator</h1>
      {!selectedOrg && (
        <div>
          <h2>Organizations</h2>
          <ul className="list-group">
            {organizations.map(org => (
              <li key={org} className="list-group-item">
                <button className="btn btn-link" onClick={() => handleOrgSelect(org)}>
                  {org}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedOrg && !selectedFile && (
        <div>
          <h2>Select Event File for Organization: {selectedOrg}</h2>
          {jsonFiles.length > 0 ? (
            <ul className="list-group">
              {jsonFiles.map(file => (
                <li key={file} className="list-group-item">
                  <button className="btn btn-link" onClick={() => handleFileSelect(file)}>
                    {file}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No JSON event files available.</p>
          )}
          <button className="btn btn-secondary mt-3" onClick={() => setSelectedOrg('')}>
            Back to Organizations
          </button>
        </div>
      )}

      {selectedOrg && selectedFile && (
        <div>
          <h2>Events in File: {selectedFile}</h2>
          {isLoadingEvents && <p>Loading events...</p>}
          {jsonError && <p className="text-danger">{jsonError}</p>}
          {!isLoadingEvents && !jsonError && events.length > 0 && (
            <div>
              {events.map((event, idx) => (
                <div key={idx} className="mb-3 p-3 border rounded">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`event-${idx}`}
                      onChange={handleToggle(idx)}
                      checked={selectedIndices.includes(idx)}
                    />
                    <label className="form-check-label" htmlFor={`event-${idx}`}>
                      {event.payload?.summary || event.summary || `Event #${idx + 1}`}
                    </label>
                  </div>
                  <details className="mt-2">
                    <summary>View JSON Payload</summary>
                    <pre>{JSON.stringify(event, null, 2)}</pre>
                  </details>
                </div>
              ))}
              <button
                className="btn btn-warning"
                onClick={handleGenerate}
                disabled={isGenerating || selectedIndices.length === 0}
              >
                {isGenerating ? 'Generating SOPs...' : 'Generate SOP(s)'}
              </button>
              {selectedIndices.length > 1 && (
                <button
                  className="btn btn-secondary ml-2"
                  onClick={handleGenerateBlended}
                  disabled={isGeneratingBlended}
                >
                  {isGeneratingBlended ? 'Generating Blended SOP...' : 'Generate Blended SOP'}
                </button>
              )}
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-4">
              <h3>Generated SOPs</h3>
              {results.map(result => (
                <div key={result.idx} className="mb-4">
                  <h4>SOP for Event #{result.idx + 1}</h4>
                  {result.error ? (
                    <p className="text-danger">Error: {result.error}</p>
                  ) : (
                    <div>
                      <pre>{result.sopText}</pre>
                      <a
                        href={`${API_BASE}/download/${selectedOrg}/${result.sopFilename}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-link"
                      >
                        Download {result.sopFilename}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {blendedSop && (
            <div className="mt-4">
              <h3>Blended SOP</h3>
              {blendedSop.error ? (
                <p className="text-danger">Error: {blendedSop.error}</p>
              ) : (
                <div>
                  <pre>{blendedSop.sopText}</pre>
                </div>
              )}
            </div>
          )}

          <button className="btn btn-secondary mt-3" onClick={() => setSelectedFile('')}>
            Back to Files
          </button>
        </div>
      )}

      <div className="mt-3">
        <button className="btn btn-info" onClick={() => window.location.href = '/'}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default SopGenerator;
