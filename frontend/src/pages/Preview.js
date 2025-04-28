// frontend/src/pages/Preview.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  // SOP generation state
  const [isGeneratingSop, setIsGeneratingSop] = useState(false);

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
    axios.get(`http://localhost:5002/api/preview/${selectedOrg}/${file}`)
      .then((res) => {
        setContent(res.data.content);
      })
      .catch((err) => console.error(err));
  };

  const handleSave = () => {
    axios.post(`http://localhost:5002/api/preview/${selectedOrg}/${selectedFile}`, { content })
      .then(() => alert('File saved successfully!'))
      .catch((err) => console.error(err));
  };
  
  // Generate SOP for the selected event JSON file
  const handleGenerateSop = async () => {
    if (!selectedOrg || !selectedFile) return;
    setIsGeneratingSop(true);
    try {
      const response = await axios.post('http://localhost:5002/api/generate_sop', {
        org_name: selectedOrg,
        filename: selectedFile,
        event_index: 0
      });
      const { sop_text, sop_filename } = response.data;
      // Refresh file list and select new SOP file
      fetchFiles(selectedOrg);
      setSelectedFile(sop_filename);
      // Load SOP content into editor
      setContent(sop_text);
    } catch (err) {
      console.error('Error generating SOP:', err);
      const errMsg = err.response?.data?.message || 'Error generating SOP.';
      alert(errMsg);
    } finally {
      setIsGeneratingSop(false);
    }
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
                  `http://localhost:5002/api/download/${selectedOrg}/${selectedFile}`,
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
                    `http://localhost:5002/api/postman/${selectedOrg}/${selectedFile}`,
                    '_blank'
                  )
                }
              >
                Export to Postman
              </button>
            )}
            {/* Generate SOP for JSON event files */}
            {selectedFile.toLowerCase().endsWith('.json') && (
              <button
                className="btn btn-warning ml-2"
                onClick={handleGenerateSop}
                disabled={isGeneratingSop}
              >
                {isGeneratingSop ? 'Generating SOP...' : 'Generate SOP'}
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