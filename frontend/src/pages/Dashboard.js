import React, { useState } from 'react';
import axios from 'axios';

function Dashboard() {
  const [scenarios, setScenarios] = useState({
    major: false,
    partial: false,
    well: false,
  });

  const [formData, setFormData] = useState({
    org_name: '',
    itsm_tools: '',
    observability_tools: '',
    service_names: '',
  });

  const [apiKey, setApiKey] = useState('');
  const [generationResult, setGenerationResult] = useState('');

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setScenarios({
      ...scenarios,
      [name]: checked,
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const selectedScenarios = Object.entries(scenarios)
      .filter(([_, isSelected]) => isSelected)
      .map(([scenarioName]) => scenarioName);

    const payload = {
      ...formData,
      scenarios: selectedScenarios,
      apiKey: apiKey,
    };

    try {
      const response = await axios.post("http://localhost:5000/api/generate", payload);
      // Assume the backend returns a message and/or file paths in response.data.message
      setGenerationResult(response.data.message || "Generation complete.");
    } catch (error) {
      console.error("Generation error:", error);
      setGenerationResult("Error during generation.");
    }
  };

  return (
    <div className="container mt-4">
      <div className="row">
        {/* Left Column: Scenarios */}
        <div className="col-md-3 mb-3">
          <h5 className="mb-3">Scenarios</h5>
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="majorScenario"
              name="major"
              checked={scenarios.major}
              onChange={handleCheckboxChange}
            />
            <label className="form-check-label" htmlFor="majorScenario">
              Major
            </label>
          </div>
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="partialScenario"
              name="partial"
              checked={scenarios.partial}
              onChange={handleCheckboxChange}
            />
            <label className="form-check-label" htmlFor="partialScenario">
              Partial
            </label>
          </div>
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="wellScenario"
              name="well"
              checked={scenarios.well}
              onChange={handleCheckboxChange}
            />
            <label className="form-check-label" htmlFor="wellScenario">
              Well
            </label>
          </div>
        </div>
        {/* Right Column: Form Fields */}
        <div className="col-md-9">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="org_name" className="form-label">
                Organization Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                id="org_name"
                name="org_name"
                value={formData.org_name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="itsm_tools" className="form-label">
                ITSM Tools
              </label>
              <input
                type="text"
                className="form-control"
                id="itsm_tools"
                name="itsm_tools"
                value={formData.itsm_tools}
                onChange={handleInputChange}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="observability_tools" className="form-label">
                Observability Tools
              </label>
              <input
                type="text"
                className="form-control"
                id="observability_tools"
                name="observability_tools"
                value={formData.observability_tools}
                onChange={handleInputChange}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="service_names" className="form-label">
                Service Name(s) <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                id="service_names"
                name="service_names"
                value={formData.service_names}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="api_key_global" className="form-label">
                OpenAI API Key
              </label>
              <input
                type="password"
                className="form-control"
                id="api_key_global"
                placeholder="Enter your OpenAI API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary w-100">
              Generate Scenario(s)
            </button>
          </form>
        </div>
      </div>
      {generationResult && (
        <div className="mt-3 alert alert-info">
          {generationResult}
        </div>
      )}
    </div>
  );
}

export default Dashboard;