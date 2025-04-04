require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
const generateRoutes = require('./routes/generate');
const eventRoutes = require('./routes/events');
app.use('/api/events', eventRoutes);
app.use('/api/generate', generateRoutes);

app.get('/', (req, res) => {
  res.send('PD Demo Generator v2 API is running');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});