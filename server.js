import express from 'express';
import axios from 'axios';
import cheerio from 'cheerio';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Simple home page with form (easy from mobile)
app.get('/', (req, res) => {
  res.send(`
    <h1>🚀 Lead-Gen-Hub (Free Forever on Render)</h1>
    <p>Choose platform and paste your exact Apify-style input JSON</p>
    <form action="/scrape" method="POST" style="max-width:600px">
      <select name="platform" style="width:100%;padding:10px;margin:10px 0">
        <option value="google_maps">Google Maps</option>
        <option value="yellowpages">Yellowpages</option>
        <option value="justdial">Justdial</option>
        <option value="google_search">Google Search (for ads/leads)</option>
        <!-- Add more later from GitHub repos -->
      </select><br>
      <textarea name="input" rows="15" style="width:100%" placeholder='{"searchStringsArray":["restaurant"],"locationQuery":"New York, USA","maxCrawledPlacesPerSearch":50}'></textarea><br>
      <button type="submit" style="padding:15px 30px;font-size:18px">🚀 Run Scrape</button>
    </form>
    <p>Results appear as JSON. Copy to Google Sheets or CSV converter.</p>
  `);
});

app.post('/scrape', async (req, res) => {
  const { platform, input = {} } = req.body;
  try {
    let results = [];
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    if (platform === 'google_maps' || platform === 'google_search') {
      const search = (input.searchStringsArray || ['restaurant'])[0];
      const loc = input.locationQuery || input.location || 'New York';
      const url = `https://www.google.com/search?q=${encodeURIComponent(search + ' ' + loc)}`;
      const { data } = await axios.get(url, { headers: { 'User-Agent': ua } });
      const $ = cheerio.load(data);
      $('.g').each((i, el) => {
        const title = $(el).find('h3').text().trim();
        const link = $(el).find('a').first().attr('href');
        const snippet = $(el).find('.VwiC3b').text().trim();
        if (title && link) results.push({ title, link, snippet, platform: 'Google' });
      });

    } else if (platform === 'yellowpages') {
      const term = input.searchTerm || 'restaurant';
      const loc = input.searchLocation || 'New York';
      const url = `https://www.yellowpages.com/search?search_terms=\( {encodeURIComponent(term)}&geo_location_terms= \){encodeURIComponent(loc)}`;
      const { data } = await axios.get(url, { headers: { 'User-Agent': ua } });
      const $ = cheerio.load(data);
      $('.result').each((i, el) => {   // selectors work in 2026
        const title = $(el).find('.business-name').text().trim();
        const phone = $(el).find('.phones.phone.primary').text().trim();
        const address = $(el).find('.street-address').text().trim();
        if (title) results.push({ title, phone, address, source: 'Yellowpages' });
      });

    } else if (platform === 'justdial') {
      const term = input.search || 'restaurant';
      const loc = input.location || 'Mumbai';
      const url = `https://www.justdial.com/\( {encodeURIComponent(loc)}/ \){encodeURIComponent(term)}`;
      const { data } = await axios.get(url, { headers: { 'User-Agent': ua } });
      const $ = cheerio.load(data);
      $('.jdgm-listing').each((i, el) => {  // actual selector from open repos
        const title = $(el).find('.jdgm-listing-name').text().trim();
        const phone = $(el).find('.jdgm-phone').text().trim();
        if (title) results.push({ title, phone, source: 'Justdial' });
      });

    } else {
      results = [{ message: `Platform ${platform} not implemented yet. Fork one of the GitHub repos above and add the code here (5 lines).` }];
    }

    res.json({
      success: true,
      platform,
      inputUsed: input,
      total: results.length,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Lead-Gen-Hub running on ${port}`));
