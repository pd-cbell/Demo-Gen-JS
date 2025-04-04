// frontend/src/pages/EventSender.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const EventSender = () => {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [routingKey, setRoutingKey] = useState('');
  const [progress, setProgress] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    // Fetch organizations from backend API
    axios.get('http://localhost:5000/api/organizations')
      .then((res) => setOrganizations(res.data.organizations))
      .catch((err) => console.error(err));
  }, []);

  const handleOrgChange = (e) => {
    setSelectedOrg(e.target.value);
    // Fetch event files for the selected organization
    axios.get(`http://localhost:5000/api/files/${e.target.value}`)
      .then((res) => setFiles(res.data.files))
      .catch((err) => console.error(err));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setProgress(true);
    axios.post('http://localhost:5000/api/events/send', {
      organization: selectedOrg,
      filename: selectedFile,
      routing_key: routingKey,
    })
    .then((res) => {
      setResults(res.data.results);
      setProgress(false);
    })
    .catch((err) => {
      console.error(err);
      setProgress(false);
    });
  };

  return (
    <div>
      <h1>Event Sender</h1>
      <form onSubmit={handleSubmit}>
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
            <option value="">Select a file</option>
            {files.map((file) => (
              <option key={file} value={file}>{file}</option>
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
        <button type="submit" className="btn btn-primary" disabled={progress}>
          Send Events
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
    </div>
  );
};

export default EventSender;