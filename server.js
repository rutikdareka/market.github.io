// server.js
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();

app.use(cors());

app.get('/api/stocks', async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  const apiUrl = `https://groww.in/v1/api/search/v3/query/global/st_query?from=0&query=${encodeURIComponent(query)}&size=6&web=true`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      }
    });
    const data = await response.json();
    res.json(data.hits || []);
  } catch (err) {
    res.status(500).json({ error: 'API fetch failed' });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
