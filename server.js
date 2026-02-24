import express from 'express';
import axios from 'axios';
import { load } from 'cheerio';   // ← THIS FIXED LINE (no more default export error)
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// === DEFAULTS FROM RENDER ENV VARS (you already set these) ===
const DEFAULT_LOCATION = process.env.DEFAULT_LOCATION || 'United States';
const DEFAULT_SEARCH = process.env.DEFAULT_SEARCH || 'restaurant';
const DEFAULT_MAX_LEADS = parseInt(process.env.MAX_RESULTS) || 50;

console.log('🚀 Lead-Gen-Hub n8n-Ready | Defaults:', { DEFAULT_LOCATION, DEFAULT_MAX_LEADS });

app.get('/', (req, res) => {
  res.send(`
    <h1>🚀 Lead-Gen-Hub – n8n Ready (Free Forever)</h1>
    <p>Use POST /scrape from n8n HTTP Request node</p>
    <p>Or test here manually</p>
  `);
});

app.post('/scrape', async (req, res) => {
  const startTime = Date.now();
  let { platforms, maxLeadsPerPlatform = DEFAULT_MAX_LEADS, search = DEFAULT_SEARCH, location = DEFAULT_LOCATION, input = {} } = req.body;

  // Support single platform as string or array
  if (typeof platforms === 'string') platforms = [platforms];
  if (!Array.isArray(platforms)) platforms = ['google_maps'];

  const resultsByPlatform = {};
  let totalLeads = 0;
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  for (const platform of platforms) {
    let results = [];
    const maxThisPlatform = Math.min(maxLeadsPerPlatform, 100); // safety

    try {
      const finalSearch = search || input.searchStringsArray?.[0] || input.search || input.searchTerm || DEFAULT_SEARCH;
      const finalLocation = location || input.locationQuery || input.location || input.searchLocation || DEFAULT_LOCATION;

      if (platform === 'google_maps' || platform === 'google_search') {
        const url = `https://www.google.com/search?q=${encodeURIComponent(finalSearch + ' ' + finalLocation)}`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': ua }, timeout: 15000 });
        const $ = load(data);
        $('.g').each((i, el) => {
          if (results.length >= maxThisPlatform) return false;
          const title = $(el).find('h3').text().trim();
          const link = $(el).find('a').attr('href');
          const snippet = $(el).find('.VwiC3b, .V3FYCf').text().trim();
          if (title && link) {
            results.push({ title, link: link.startsWith('http') ? link : 'https://google.com' + link, snippet, source: 'Google', location: finalLocation });
          }
        });
      } 
      else if (platform === 'yellowpages') {
        const url = `https://www.yellowpages.com/search?search_terms=\( {encodeURIComponent(finalSearch)}&geo_location_terms= \){encodeURIComponent(finalLocation)}`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': ua }, timeout: 15000 });
        const $ = load(data);
        $('.result').each((i, el) => {
          if (results.length >= maxThisPlatform) return false;
          const title = $(el).find('.business-name').text().trim();
          const phone = $(el).find('.phones.phone.primary').text().trim();
          const address = $(el).find('.street-address').text().trim();
          if (title) results.push({ title, phone, address, source: 'Yellowpages', location: finalLocation });
        });
      } 
      else if (platform === 'justdial') {
        const url = `https://www.justdial.com/\( {encodeURIComponent(finalLocation)}/ \){encodeURIComponent(finalSearch)}`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': ua }, timeout: 15000 });
        const $ = load(data);
        $('.jdgm-listing, .result').each((i, el) => {
          if (results.length >= maxThisPlatform) return false;
          const title = $(el).find('.jdgm-listing-name, .store-name').text().trim();
          const phone = $(el).find('.jdgm-phone, .phone').text().trim();
          if (title) results.push({ title, phone, source: 'Justdial', location: finalLocation });
        });
      } 
      else {
        results = [{ error: `Platform ${platform} not implemented yet` }];
      }

      resultsByPlatform[platform] = results;
      totalLeads += results.length;

    } catch (e) {
      resultsByPlatform[platform] = [{ error: e.message }];
    }
  }

  res.json({
    success: true,
    platforms: platforms,
    maxLeadsPerPlatform,
    searchUsed: search,
    locationUsed: location,
    totalLeads,
    durationMs: Date.now() - startTime,
    results: resultsByPlatform
  });
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`✅ Lead-Gen-Hub n8n-Ready on port ${port}`);
});
