// frontend/src/pages/Diagnostics.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5002/api';

const Diagnostics = () => {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [txtFiles, setTxtFiles] = useState([]);
  const [selectedTxtFile, setSelectedTxtFile] = useState('');
  const [scenarioOptions, setScenarioOptions] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState('');
  const [diagnosticsData, setDiagnosticsData] = useState(null);
  const [diagnosticsFilename, setDiagnosticsFilename] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
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
    setFiles([]);
    setSelectedFiles([]);
    setDiagnosticsData(null);
    setDiagnosticsFilename('');
    setError('');
    fetchFiles(org);
  };

  // Derive scenario options from narrative (.txt) files
  useEffect(() => {
    const narrativeFiles = files.filter(f => f.toLowerCase().endsWith('.txt'));
    const opts = Array.from(new Set(narrativeFiles.map(f => f.split('_')[0])));
    setScenarioOptions(opts);
    if (opts.length > 0) {
      setSelectedScenario(opts[0]);
    } else {
      setSelectedScenario('');
    }
  }, [files]);

  // Derive narrative (.txt) files for selected scenario
  useEffect(() => {
    if (selectedScenario) {
      const matchingTxt = files.filter(f => f.startsWith(`${selectedScenario}_`) && f.toLowerCase().endsWith('.txt'));
      setTxtFiles(matchingTxt);
      setSelectedTxtFile(matchingTxt[0] || '');
    } else {
      setTxtFiles([]);
      setSelectedTxtFile('');
    }
  }, [files, selectedScenario]);

  const handleFileToggle = (file) => (e) => {
    if (e.target.checked) {
      setSelectedFiles(prev => [...prev, file]);
    } else {
      setSelectedFiles(prev => prev.filter(f => f !== file));
    }
  };

  const handleGenerate = () => {
    if (!selectedOrg || selectedFiles.length === 0) {
      setError('Please select at least one file.');
      return;
    }
    setIsGenerating(true);
    setError('');
    axios.post(`${API_BASE}/generate_diagnostics`, {
      org_name: selectedOrg,
      scenario: selectedScenario,
      narrative_file: selectedTxtFile,
      files: selectedFiles
    })
    .then(res => {
      setDiagnosticsData(res.data.diagnostics);
      setDiagnosticsFilename(res.data.diagnostics_filename);
    })
    .catch(err => {
      console.error('Error generating diagnostics:', err);
      setError(err.response?.data?.message || err.message);
    })
    .finally(() => setIsGenerating(false));
  };

  // Filter JSON files matching selected scenario
  const allJsonFiles = files.filter(f => f.toLowerCase().endsWith('.json'));
  const scenarioJsonFiles = selectedScenario
    ? allJsonFiles.filter(f => f.startsWith(`${selectedScenario}_`))
    : [];

  return (
    <div>
      <h1>Simulate Diagnostics</h1>
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

      {selectedOrg && !diagnosticsData && (
        <div>
          <h2>Select Scenario and Files for Organization: {selectedOrg}</h2>
          {/* Scenario selection */}
          {scenarioOptions.length > 0 && (
            <div className="mb-3">
              <label htmlFor="scenario-select">Scenario:</label>
              <select
                id="scenario-select"
                className="form-control"
                value={selectedScenario}
                onChange={e => setSelectedScenario(e.target.value)}
              >
                {scenarioOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}
          {/* Narrative file selection */}
          {selectedScenario && (
            txtFiles.length > 0 ? (
              <div className="mb-3">
                <label htmlFor="narrative-select">Narrative File:</label>
                <select
                  id="narrative-select"
                  className="form-control"
                  value={selectedTxtFile}
                  onChange={e => setSelectedTxtFile(e.target.value)}
                >
                  {txtFiles.map(file => (
                    <option key={file} value={file}>{file}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-danger">No narrative files for scenario '{selectedScenario}'.</p>
            )
          )}
          {/* Event files selection */}
          {selectedScenario && (
            scenarioJsonFiles.length > 0 ? (
              <div className="mb-3">
                <label>Select JSON Files:</label>
                <ul className="list-group">
                  {scenarioJsonFiles.map(file => (
                    <li key={file} className="list-group-item">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`file-${file}`}
                          onChange={handleFileToggle(file)}
                          checked={selectedFiles.includes(file)}
                        />
                        <label className="form-check-label" htmlFor={`file-${file}`}>
                          {file}
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>No JSON files available for scenario '{selectedScenario}'.</p>
            )
          )}
          {error && <p className="text-danger">{error}</p>}
          <button
            className="btn btn-primary mt-3"
            onClick={handleGenerate}
            disabled={isGenerating || selectedFiles.length === 0 || !selectedTxtFile}
          >
            {isGenerating ? 'Generating Diagnostics...' : 'Generate Diagnostics'}
          </button>
          <button
            className="btn btn-secondary mt-3 ml-2"
            onClick={() => setSelectedOrg('')}
          >
            Back to Organizations
          </button>
        </div>
      )}

      {diagnosticsData && (
        <div>
          <h2>Diagnostics Jobs</h2>
          {diagnosticsData.jobs && diagnosticsData.jobs.map(job => (
            <div key={job.index} className="mb-4">
              <h4>Job for Event #{job.index + 1}</h4>
              <pre>{job.yaml}</pre>
              <a
                href={`${API_BASE}/download/${selectedOrg}/${job.filename}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-link"
              >
                Download {job.filename}
              </a>
            </div>
          ))}
          <button
            className="btn btn-secondary mt-3 ml-2"
            onClick={() => {
              setDiagnosticsData(null);
              setSelectedFiles([]);
              setSelectedTxtFile('');
              setError('');
            }}
          >
            Back to File Selection
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

export default Diagnostics;