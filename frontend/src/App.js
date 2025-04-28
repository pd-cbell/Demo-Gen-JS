// frontend/src/app.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import EventSender from './pages/EventSender';
import Preview from './pages/Preview';
import SopGenerator from './pages/SopGenerator';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <Router>
      <nav
        style={{
          padding: '1rem',
          backgroundColor: '#006400',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              marginRight: '1rem',
              padding: '0.5rem 1rem',
              textDecoration: 'none',
              backgroundColor: isActive ? '#66BB6A' : 'transparent',
              color: isActive ? '#00008B' : '#ffffff',
              borderRadius: '4px'
            })}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/event-sender"
            style={({ isActive }) => ({
              marginRight: '1rem',
              padding: '0.5rem 1rem',
              textDecoration: 'none',
              backgroundColor: isActive ? '#66BB6A' : 'transparent',
              color: isActive ? '#00008B' : '#ffffff',
              borderRadius: '4px'
            })}
          >
            Event Sender
          </NavLink>
          <NavLink
            to="/preview"
            style={({ isActive }) => ({
              padding: '0.5rem 1rem',
              textDecoration: 'none',
              backgroundColor: isActive ? '#66BB6A' : 'transparent',
              color: isActive ? '#00008B' : '#ffffff',
              borderRadius: '4px'
            })}
          >
            Preview
          </NavLink>
          <NavLink
            to="/sop-generator"
            style={({ isActive }) => ({
              padding: '0.5rem 1rem',
              textDecoration: 'none',
              backgroundColor: isActive ? '#66BB6A' : 'transparent',
              color: isActive ? '#00008B' : '#ffffff',
              borderRadius: '4px'
            })}
          >
            SOP Generator
          </NavLink>
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffffff' }}>
          PD Demo Agent
        </div>
      </nav>
      <div className="container mt-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/event-sender" element={<EventSender />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="/sop-generator" element={<SopGenerator />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;