require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
// Use PORT env var or default to 5002 to avoid port conflicts on macOS
const port = process.env.PORT || 5002;

// Warn about missing environment variables but continue to boot
const requiredEnv = [
  'PD_API_URL',
  'PD_EVENTS_URL',
  'PD_USER_TOKEN',
  'PD_FROM_EMAIL',
  'MONGODB_URI',
  'BASE_URL',
  'WEBHOOK_PUBLIC_BASE_URL',
  'CRON_TIMEZONE',
];
requiredEnv.forEach((name) => {
  if (!process.env[name]) {
    console.warn(`Environment variable ${name} is not set.`);
  }
});

// Allow requests only from your frontend at http://localhost:3000
// Allow the demo UI (Flask or React) to call this API
const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:5000', 'http://localhost:5000'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};
app.use(cors(corsOptions));
// Preflight CORS support for specific API routes
app.options('/api/generate', cors(corsOptions));
app.options('/api/events/send', cors(corsOptions));
app.options('/api/generate_sop', cors(corsOptions));
app.options('/api/generate_sop/blended', cors(corsOptions));
// Preflight CORS for diagnostics
app.options('/api/generate_diagnostics', cors(corsOptions));
app.options('/api/generate_change_events', cors(corsOptions));
app.use(bodyParser.json());

// Routes
const generateRoutes = require('./routes/generate');
const eventRoutes = require('./routes/events');
const changeEventRoutes = require('./routes/change_events');
app.use('/api/events', eventRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/generate_change_events', changeEventRoutes);
// SOP generation proxy
const sopRoutes = require('./routes/sop');
app.use('/api/generate_sop', sopRoutes);
// Diagnostics proxy
const diagnosticsRoutes = require('./routes/diagnostics');
app.use('/api/generate_diagnostics', diagnosticsRoutes);
// Preview and file browsing routes
const previewRoutes = require('./routes/preview');
app.use('/api', previewRoutes);

app.get('/', (req, res) => {
  res.send('PD Demo Generator v2 API is running');
},);

// Listen on all network interfaces so the service is accessible from Docker mappings
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
