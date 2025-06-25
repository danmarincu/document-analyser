const express = require('express');
const cors = require('cors');
const path = require('path');
//require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Validate required environment variables
const requiredEnvVars = ['API_ENDPOINT', 'API_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Error: Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please create a .env file with the required variables.');
  process.exit(1);
}

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Serve static files from the public directory BEFORE the API proxy
app.use(express.static(path.join(__dirname, 'public')));

// API proxy middleware - only catch routes that start with /api
app.use('/api', async (req, res) => {
  const apiPath = req.url; // This will be the path after /api
  const targetUrl = process.env.API_ENDPOINT + apiPath;
  
  console.log('Proxying request:', {
    originalUrl: req.originalUrl,
    apiPath,
    targetUrl
  });
  
  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.API_KEY,
        ...req.headers
      },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('API proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy request to API' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    statusCode: 200,
    message: 'ok',
    api_endpoint: process.env.API_ENDPOINT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running in a container on the exposed PORT: ${port}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('API Endpoint:', process.env.API_ENDPOINT);
});