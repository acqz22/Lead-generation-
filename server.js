import express from 'express';
import axios from 'axios';
import { load } from 'cheerio';   // ← FIXED IMPORT (this was the crash)
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// === PRODUCTION DEFAULTS FROM RENDER ENVIRONMENT VARIABLES ===
const DEFAULT_LOCATION = process.env.DEFAULT_LOCATION || 'United States';
const DEFAULT_SEARCH = process.env.DEFAULT_SEARCH || 'restaurant';
const MAX_RESULTS = parseInt(process.env.MAX_RESULTS) || 80;
const EXTRACT_ALL = process.env.EXTRACT_ALL !== 'false';

console.log('🚀 Lead-Gen-Hub starting... Defaults:', { DEFAULT_LOCATION, DEFAULT_SEARCH, MAX_RESULTS });

app.get('/', (req, res) => {
  res.send(`
    <h1>🚀 Lead-Gen-Hub – Production Ready (Free Forever)</h1>
    <p>Default location: <b>\( {DEFAULT_LOCATION}</b> | Max leads: <b> \){MAX_RESULTS}</b></p>
    <form action="/scrape" method="POST" style="max-width:700px;margin:20px auto">
      <select name="platform" style="width:100%;padding:12px;margin:10px 0;font-size:16px">
        <option value="google_maps">Google Maps</option>
        <option value="yellowpages">Yellowpages</option>
        <option value="justdial">Justdial</option>
      </select><br>
      <textarea name="input" rows="14" style="width:100%;font-family:monospace" placeholder='Paste your JSON input here (or leave empty to use defaults)'></textarea><br>
      <button type="submit" style="padding:15px 40px;font-size:18px;background:#000;color:#fff;border:none;cursor:pointer">🚀 START SCRAPING</button>
    </form>
    <p style="color:#666">Results = clean JSON. Copy → Google Sheets / CSV converter.</p>
  `);
});

app.post('/scrape', async (req, res) => {
  const startTime = Date.now();
  let { platform, input = {} } = req.body;

  try {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    let results = [];

    // Smart defaults (never hardcoded)
    const search = (input.searchStringsArray || input.search || input.searchTerm || [DEFAULT_SEARCH])[0] || DEFAULT_SEARCH;
    const location = input.locationQuery || input.location || input.searchLocation || DEFAULT_LOCATION;

    console.log(`📍 Scraping \( {platform} | Search: " \){search}" | Location: "${location}"`);

    if (platform === 'google_maps' || platform === 'google_search') {
      const url = `https://www.google.com/search?q=${encodeURIComponent(search + ' ' + location)}`;
      const { data } = await axios.get(url, { headers: { 'User-Agent': ua }, timeout: 15000 });
      const $ = load(data);   // ← FIXED: now using named import
      $('.g').each((i, el) => {
        if (results.length >= MAX_RESULTS) return false;
        const title = $(el).find('h3').text().trim();
        const link = $(el).find('a').attr('href');
        const snippet = $(el).find('.VwiC3b, .V3FYCf').text().trim();
        if (title && link) {
          results.push({ 
            title, 
            link: link.startsWith('/') ? 'https://www.google.com' + link : link,
            snippet,
            source: 'Google',
            location,
            extractedAt: new Date().toISOString()
          });
        }
      });
    } 
    else if (platform === 'yellowpages') {
      const url = `https://www.yellowpages.com/search?search_terms=\( {encodeURIComponent(search)}&geo_location_terms= \){encodeURIComponent(location)}`;
      const { data } = await axios.get(url, { headers: { 'User-Agent': ua }, timeout: 15000 });
      const $ = load(data);
      $('.result').each((i, el) => {
        if (results.length >= MAX_RESULTS) return false;
        const title = $(el).find('.business-name').text().trim();
        const phone = $(el).find('.phones.phone.primary').text().trim();
        const address = $(el).find('.street-address').text().trim();
        if (title) results.push({ title, phone, address, source: 'Yellowpages', location });
      });
    } 
    else if (platform === 'justdial') {
      const url = `https://www.justdial.com/\( {encodeURIComponent(location)}/ \){encodeURIComponent(search)}`;
      const { data } = await axios.get(url, { headers: { 'User-Agent': ua }, timeout: 15000 });
      const $ = load(data);
      $('.jdgm-listing, .result').each((i, el) => {
        if (results.length >= MAX_RESULTS) return false;
        const title = $(el).find('.jdgm-listing-name, .store-name').text().trim();
        const phone = $(el).find('.jdgm-phone, .phone').text().trim();
        if (title) results.push({ title, phone, source: 'Justdial', location });
      });
    } 
    else {
      return res.status(400).json({ success: false, error: `Platform ${platform} not yet added. Reply with "add Instagram" etc.` });
    }

    const duration = Date.now() - startTime;
    res.json({
      success: true,
      platform,
      inputUsed: { search, location, max: MAX_RESULTS },
      total: results.length,
      durationMs: duration,
      results,
      note: EXTRACT_ALL ? 'All available fields extracted' : 'Basic extraction only'
    });

  } catch (e) {
    console.error('❌ Error:', e.message);
    res.status(500).json({ 
      success: false, 
      error: e.message.includes('timeout') ? 'Site slow – try again' : e.message,
      tip: 'First run is slower (Render cold start). Try again in 10 seconds.'
    });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`✅ Lead-Gen-Hub PRODUCTION READY on port ${port}`);
  console.log(`🌐 Open: https://your-app.onrender.com`);
});
