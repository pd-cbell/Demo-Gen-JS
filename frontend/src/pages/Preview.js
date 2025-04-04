// frontend/src/pages/Preview.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Preview = () => {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    // Fetch list of organizations
    axios.get('http://localhost:5000/api/organizations')
      .then((res) => setOrganizations(res.data.organizations))
      .catch((err) => console.error(err));
  }, []);

  const fetchFiles = (org) => {
    axios.get(`http://localhost:5000/api/files/${org}`)
      .then((res) => setFiles(res.data.files))
      .catch((err) => console.error(err));
  };

  const handleOrgSelect = (org) => {
    setSelectedOrg(org);
    fetchFiles(org);
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    // Fetch file content from backend
    axios.get(`http://localhost:5000/api/preview/${selectedOrg}/${file}`)
      .then((res) => setContent(res.data.content))
      .catch((err) => console.error(err));
  };

  const handleSave = () => {
    // Save updated content to backend
    axios.post(`http://localhost:5000/api/preview/${selectedOrg}/${selectedFile}`, { content })
      .then(() => alert('File saved successfully!'))
      .catch((err) => console.error(err));
  };

  return (
    <div>
      <h1>Generated Files Browser</h1>
      {!selectedOrg && (
        <div>
          <h2>Organizations</h2>
          <ul className="list-group">
            {organizations.map((org) => (
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
          <h2>Files for Organization: {selectedOrg}</h2>
          <ul className="list-group">
            {files.map((file) => (
              <li key={file} className="list-group-item">
                <button className="btn btn-link" onClick={() => handleFileSelect(file)}>
                  {file}
                </button>
              </li>
            ))}
          </ul>
          <button className="btn btn-secondary mt-3" onClick={() => setSelectedOrg('')}>
            Back to Organizations
          </button>
        </div>
      )}
      {selectedOrg && selectedFile && (
        <div>
          <h2>
            Editing File: {selectedFile} (Organization: {selectedOrg})
          </h2>
          <textarea
            className="form-control"
            rows="15"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          ></textarea>
          <div className="mt-3">
            <button className="btn btn-success" onClick={handleSave}>
              Save Changes
            </button>
            <button
              className="btn btn-primary ml-2"
              onClick={() =>
                window.open(
                  `http://localhost:5000/api/download/${selectedOrg}/${selectedFile}`,
                  '_blank'
                )
              }
            >
              Download
            </button>
          </div>
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

export default Preview;