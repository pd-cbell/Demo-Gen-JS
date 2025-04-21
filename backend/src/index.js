require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
// Use PORT env var or default to 5002 to avoid port conflicts on macOS
const port = process.env.PORT || 5002;

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
app.use(bodyParser.json());

// Routes
const generateRoutes = require('./routes/generate');
const eventRoutes = require('./routes/events');
app.use('/api/events', eventRoutes);
app.use('/api/generate', generateRoutes);
// Preview and file browsing routes
const previewRoutes = require('./routes/preview');
app.use('/api', previewRoutes);

app.get('/', (req, res) => {
  res.send('PD Demo Generator v2 API is running');
},);

// Listen on the IPv4 loopback interface to avoid IPv6-only binding issues
app.listen(port, '127.0.0.1', () => {
  console.log(`Server is running on http://127.0.0.1:${port}`);
});