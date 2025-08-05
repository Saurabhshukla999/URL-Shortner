require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dns = require('dns');
const urlParser = require('url');

const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// URL Schema
const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true }
});

const Url = mongoose.model('Url', urlSchema);

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Serve static files from frontend directory
app.use(express.static('frontend'));

// Serve index.html from frontend directory
app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/frontend/index.html');
});

// Helper function to validate URL
const isValidUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (error) {
    return false;
  }
};

// Helper function to validate hostname using DNS
const validateHostname = (hostname) => {
  return new Promise((resolve) => {
    dns.lookup(hostname, (err) => {
      resolve(!err);
    });
  });
};

// POST route to create short URL
app.post('/api/shorturl', async (req, res) => {
  const { url } = req.body;
  
  // Check if URL format is valid
  if (!isValidUrl(url)) {
    return res.json({ error: 'invalid url' });
  }
  
  const parsedUrl = urlParser.parse(url);
  
  // Validate hostname with DNS lookup
  const isValidHostname = await validateHostname(parsedUrl.hostname);
  if (!isValidHostname) {
    return res.json({ error: 'invalid url' });
  }
  
  try {
    // Check if URL already exists in database
    let existingUrl = await Url.findOne({ original_url: url });
    
    if (existingUrl) {
      return res.json({
        original_url: existingUrl.original_url,
        short_url: existingUrl.short_url
      });
    }
    
    // Generate new short URL number
    const urlCount = await Url.countDocuments({});
    const shortUrl = urlCount + 1;
    
    // Create new URL document
    const newUrl = new Url({
      original_url: url,
      short_url: shortUrl
    });
    
    await newUrl.save();
    
    res.json({
      original_url: newUrl.original_url,
      short_url: newUrl.short_url
    });
    
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET route to redirect short URL
app.get('/api/shorturl/:short_url', async (req, res) => {
  const shortUrl = parseInt(req.params.short_url);
  
  if (isNaN(shortUrl)) {
    return res.status(400).json({ error: 'Wrong format' });
  }
  
  try {
    const urlDoc = await Url.findOne({ short_url: shortUrl });
    
    if (!urlDoc) {
      return res.status(404).json({ error: 'No short URL found for the given input' });
    }
    
    res.redirect(urlDoc.original_url);
    
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});