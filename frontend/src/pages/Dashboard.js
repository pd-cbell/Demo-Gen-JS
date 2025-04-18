import React, { useState } from 'react';
import axios from 'axios';
import { promptTemplates } from '../promptTemplates';

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

  // API key is now read by the server from its environment variable
  const [generationResult, setGenerationResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);

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
    };
    // Initialize progress steps UI
    const steps = [];
    selectedScenarios.forEach((scenario) => {
      if (promptTemplates[scenario]) {
        steps.push({
          id: `${scenario}-narrative`,
          title: `Generating ${scenario} narrative`,
          prompt: promptTemplates[scenario].narrative.replace('{organization}', formData.org_name),
        });
        steps.push({
          id: `${scenario}-events`,
          title: `Generating ${scenario} events`,
          prompt: promptTemplates[scenario].events.replace('{organization}', formData.org_name),
        });
      }
    });
    setProgressSteps(steps);
    setCurrentStep(0);
    setIsLoading(true);

    try {
      const response = await axios.post("http://localhost:5002/api/generate", payload);
      // Backend completed generation
      setGenerationResult(response.data.message || "Generation complete.");
      // Move to last step
      setCurrentStep(steps.length - 1);
    } catch (error) {
      console.error("Generation error:", error);
      const errMsg = error.response?.data?.message || "Error during generation.";
      setGenerationResult(errMsg);
    } finally {
      setIsLoading(false);
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
            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={!Object.values(scenarios).some(Boolean) || isLoading}
            >
              {isLoading ? 'Generating...' : 'Generate Scenario(s)'}
            </button>
          </form>
        </div>
      </div>
      {isLoading && progressSteps.length > 0 && (
        <div className="mt-3">
          <h4>Generation Progress</h4>
          <ul className="list-group">
            {progressSteps.map((step, idx) => (
              <li key={step.id} className={`list-group-item ${idx === currentStep ? 'list-group-item-info' : ''}`}>
                <details>
                  <summary>{step.title}</summary>
                  <pre className="mb-0">{step.prompt}</pre>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
      {generationResult && (
        <div className="mt-3 alert alert-info">
          {generationResult}
        </div>
      )}
    </div>
  );
}

export default Dashboard;