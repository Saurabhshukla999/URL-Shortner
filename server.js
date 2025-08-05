const express = require('express');
const mongoose = require('mongoose');
const validUrl = require('valid-url');
const dns = require('dns').promises;
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("MongoDB connection successful.");
}).catch(err => {
  console.error("MongoDB connection error:", err);
});

// URL Shortener Schema and Model
const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true }
});

const Url = mongoose.model('Url', urlSchema);

// Middleware to parse incoming request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve the static frontend files
app.use(express.static('public'));

// API endpoint to shorten a URL
app.post('/api/shorturl', async (req, res) => {
  const originalUrl = req.body.url;

  // 1. Validate the URL format using the valid-url package
  if (!validUrl.isWebUri(originalUrl)) {
    return res.json({ error: 'invalid url' });
  }

  // 2. Validate if the hostname is real using DNS lookup
  try {
    const hostname = new URL(originalUrl).hostname;
    await dns.lookup(hostname);
  } catch (err) {
    return res.json({ error: 'invalid url' });
  }

  try {
    // 3. Check if the URL already exists in the database
    let existingUrl = await Url.findOne({ original_url: originalUrl });
    if (existingUrl) {
      return res.json({
        original_url: existingUrl.original_url,
        short_url: existingUrl.short_url
      });
    }

    // 4. If not, get the total count of existing URLs to create a new short_url ID
    const count = await Url.countDocuments();
    const shortUrl = count + 1;

    const newUrl = new Url({
      original_url: originalUrl,
      short_url: shortUrl
    });

    // 5. Save the new URL to the database
    await newUrl.save();
    res.json({
      original_url: newUrl.original_url,
      short_url: newUrl.short_url
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// API endpoint to redirect to the original URL
app.get('/api/shorturl/:short_url', async (req, res) => {
  const shortUrl = req.params.short_url;

  try {
    // 1. Find the URL by its short_url ID
    const urlEntry = await Url.findOne({ short_url: shortUrl });

    // 2. If found, redirect to the original URL
    if (urlEntry) {
      return res.redirect(urlEntry.original_url);
    } else {
      // 3. If not found, return an error
      res.json({ error: 'No short URL found for the given input' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});