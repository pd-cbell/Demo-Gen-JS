const axios = require('axios');

/**
 * Controller to handle diagnostics generation by proxying to the Python gen_service.
 * Expects JSON body with:
 *   - org_name: string
 *   - narrative_file: filename of the narrative (.txt) under generated_files/{org}
 *   - files: array of event filenames under generated_files/{org}
 */
exports.handleGenerateDiagnostics = async (req, res) => {
  try {
    const { org_name, files, narrative_file } = req.body;
    // Validate required parameters
    if (!org_name || !narrative_file || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: 'org_name, narrative_file, and files array are required.' });
    }
    // Derive scenario from narrative_file prefix
    const scenario = narrative_file.split('_')[0];
    // Prepare payload for Python service
    const payload = { org_name, scenario, narrative_file, files };
    // Python diagnostics endpoint URL (can override via env var)
    const diagServiceURL = process.env.PYTHON_DIAGNOSTIC_URL || 'http://localhost:5001/api/generate_diagnostics';
    // Forward request to Python service
    const response = await axios.post(diagServiceURL, payload);
    // Return diagnostics data and filename
    return res.json(response.data);
  } catch (error) {
    console.error('Error generating diagnostics:', error.response ? error.response.data : error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || 'Internal server error';
    return res.status(status).json({ message });
  }
};