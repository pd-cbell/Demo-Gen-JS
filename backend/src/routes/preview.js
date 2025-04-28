const express = require('express');
const fs = require('fs');
const path = require('path');


const router = express.Router();
const axios = require('axios');
// Base URL for the Python gen_service (export Postman collections)
const PYTHON_SERVICE_BASE = process.env.PYTHON_SERVICE_BASE_URL || 'http://localhost:5001';

// Directory containing generated files
// __dirname is backend/src/routes, so go up two levels to reach backend/generated_files
const generatedFilesDir = path.join(__dirname, '..', '..', 'generated_files');

// List organizations (subdirectories in generated_files)
router.get('/organizations', (req, res) => {
  fs.readdir(generatedFilesDir, { withFileTypes: true }, (err, entries) => {
    if (err) {
      console.error('Error reading organizations directory:', err);
      return res.status(500).json({ error: 'Failed to read organizations' });
    }
    const organizations = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    res.json({ organizations });
  });
});

// List files for a given organization
router.get('/files/:org', (req, res) => {
  const org = req.params.org;
  const orgDir = path.join(generatedFilesDir, org);
  fs.readdir(orgDir, (err, files) => {
    if (err) {
      console.error(`Error reading files for org ${org}:`, err);
      return res.status(500).json({ error: 'Failed to read files' });
    }
    res.json({ files });
  });
});

// Get file content
router.get('/preview/:org/:file', (req, res) => {
  const { org, file } = req.params;
  const filePath = path.join(generatedFilesDir, org, file);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading file ${filePath}:`, err);
      return res.status(500).json({ error: 'Failed to read file' });
    }
    res.json({ content: data });
  });
});

// Save updated file content
router.post('/preview/:org/:file', (req, res) => {
  const { org, file } = req.params;
  const content = req.body.content;
  const filePath = path.join(generatedFilesDir, org, file);
  fs.writeFile(filePath, content, 'utf8', (err) => {
    if (err) {
      console.error(`Error writing file ${filePath}:`, err);
      return res.status(500).json({ error: 'Failed to write file' });
    }
    res.json({ success: true });
  });
});

// Download file
router.get('/download/:org/:file', (req, res) => {
  const { org, file } = req.params;
  const filePath = path.join(generatedFilesDir, org, file);
  res.download(filePath, file, (err) => {
    if (err) {
      console.error(`Error downloading file ${filePath}:`, err);
    }
  });
});

// Export events JSON as a Postman collection, preserving routing_key and timing metadata
router.get('/postman/:org/:file', async (req, res) => {
  const { org, file } = req.params;
  const url = `${PYTHON_SERVICE_BASE}/preview/${org}/${file}/postman`;
  try {
    const response = await axios.get(url, { responseType: 'stream' });
    // Forward headers for content type and disposition
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    if (response.headers['content-disposition']) {
      res.set('Content-Disposition', response.headers['content-disposition']);
    }
    response.data.pipe(res);
  } catch (err) {
    console.error('Error exporting Postman collection:', err.response ? err.response.data : err.message);
    const status = err.response?.status || 500;
    return res.status(status).json({ error: 'Failed to export Postman collection' });
  }
});

module.exports = router;