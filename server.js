import express from 'express';
import axios from 'axios';
import cheerio from 'cheerio';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send(`
    <h1>Lead Scraper (Free on Render)</h1>
    <p>Visit: /scrape?search=web+design+agencies+bangalore</p>
    <p>Results shown as JSON. Export to CSV in your browser.</p>
  `);
});

app.get('/scrape', async (req, res) => {
  const search = req.query.search || 'web design agencies bangalore';
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(search)}`;
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(data);
    const leads = [];
    
    $('.g').each((i, el) => {
      const title = $(el).find('h3').text().trim();
      const link = $(el).find('a').attr('href');
      const snippet = $(el).find('.VwiC3b').text().trim();
      if (title && link) {
        leads.push({ title, link, snippet, source: 'Google' });
      }
    });

    res.json({ success: true, search, total: leads.length, leads });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Scraper running on port ${port}`));
