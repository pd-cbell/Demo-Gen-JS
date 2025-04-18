// frontend/src/pages/Preview.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SimpleMDE from 'react-simplemde-editor';
// EasyMDE CSS (peer of react-simplemde-editor)
import 'easymde/dist/easymde.min.css';
import ReactJson from 'react18-json-view';

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
    axios.get('http://localhost:5002/api/organizations')
      .then((res) => setOrganizations(res.data.organizations))
      .catch((err) => console.error(err));
  }, []);

  const fetchFiles = (org) => {
    axios.get(`http://localhost:5002/api/files/${org}`)
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
    axios.get(`http://localhost:5002/api/preview/${selectedOrg}/${file}`)
      .then((res) => {
        if (file.toLowerCase().endsWith('.json')) {
          const raw = res.data.content || '';
          setContent(raw);
          // Sanitize JSON: extract array between first '[' and last ']'
          let toParse = raw;
          const start = raw.indexOf('[');
          const end = raw.lastIndexOf(']');
          if (start !== -1 && end !== -1 && end > start) {
            toParse = raw.slice(start, end + 1);
          }
          try {
            const parsed = JSON.parse(toParse);
            setJsonData(parsed);
            setJsonError(null);
          } catch (e) {
            console.error('Failed to parse JSON content', e);
            setJsonData(null);
            setJsonError(e.message || 'Invalid JSON');
          }
        } else {
          setContent(res.data.content);
          setJsonData(null);
          setJsonError(null);
        }
      })
      .catch((err) => console.error(err));
  };

  const handleSave = () => {
    // Determine content to save based on file type
    const isJson = selectedFile.toLowerCase().endsWith('.json');
    const updatedContent = isJson
      ? (jsonError ? content : JSON.stringify(jsonData, null, 2))
      : content;
    axios.post(`http://localhost:5002/api/preview/${selectedOrg}/${selectedFile}`, { content: updatedContent })
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
          {selectedFile.toLowerCase().endsWith('.json') ? (
            jsonError ? (
              <div>
                <div className="alert alert-danger">
                  Error parsing JSON: {jsonError}
                </div>
                <textarea
                  className="form-control"
                  rows={20}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            ) : (
              <div className="json-editor">
                <ReactJson
                  src={jsonData}
                  onEdit={(edit) => setJsonData(edit.updated_src)}
                  onAdd={(add) => setJsonData(add.updated_src)}
                  onDelete={(del) => setJsonData(del.updated_src)}
                  enableClipboard={false}
                  name={false}
                  collapsed={false}
                  displayDataTypes={false}
                  displayObjectSize={false}
                />
              </div>
            )
          ) : (
            <SimpleMDE
              value={content}
              onChange={(value) => setContent(value)}
              options={{
                spellChecker: false,
                placeholder: "Edit content here...",
              }}
            />
          )}
          <div className="mt-3">
            <button className="btn btn-success" onClick={handleSave}>
              Save Changes
            </button>
            <button
              className="btn btn-primary ml-2"
              onClick={() =>
                window.open(
                  `http://localhost:5002/api/download/${selectedOrg}/${selectedFile}`,
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