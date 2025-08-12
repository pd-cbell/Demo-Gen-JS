// frontend/src/pages/Preview.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE from '../config';
import SimpleMDE from 'react-simplemde-editor';
// EasyMDE CSS (peer of react-simplemde-editor)
import 'easymde/dist/easymde.min.css';
// Removed JSON tree editor; using text editor for all file types
// import ReactJson from 'react18-json-view';

const Preview = () => {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [content, setContent] = useState('');
  const [jsonData, setJsonData] = useState(null);
  const [jsonError, setJsonError] = useState(null);

  useEffect(() => {
    // Fetch list of organizations
    axios.get(`${API_BASE}/organizations`)
      .then((res) => setOrganizations(res.data.organizations))
      .catch((err) => console.error(err));
  }, []);

  const fetchFiles = (org) => {
    axios.get(`${API_BASE}/files/${org}`)
      .then((res) => setFiles(res.data.files))
      .catch((err) => console.error(err));
  };

  const handleOrgSelect = (org) => {
    setSelectedOrg(org);
    fetchFiles(org);
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    axios.get(`${API_BASE}/preview/${selectedOrg}/${file}`)
      .then((res) => {
        setContent(res.data.content);
      })
      .catch((err) => console.error(err));
  };

  const handleSave = () => {
    axios.post(`${API_BASE}/preview/${selectedOrg}/${selectedFile}`, { content })
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
            <SimpleMDE
              value={content}
              onChange={(value) => setContent(value)}
              options={{
                spellChecker: false,
                placeholder: "Edit content here...",
              }}
            />
          <div className="mt-3">
            <button className="btn btn-success" onClick={handleSave}>
              Save Changes
            </button>
            <button
              className="btn btn-primary ml-2"
              onClick={() =>
                window.open(
                  `${API_BASE}/download/${selectedOrg}/${selectedFile}`,
                  '_blank'
                )
              }
            >
              Download
            </button>
            {/* Export events JSON as Postman collection */}
            {selectedFile.toLowerCase().endsWith('.json') && (
              <button
                className="btn btn-info ml-2"
                onClick={() =>
                  window.open(
                    `${API_BASE}/postman/${selectedOrg}/${selectedFile}`,
                    '_blank'
                  )
                }
              >
                Export to Postman
              </button>
            )}
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
