import { Router } from 'express';
import { fetchMultiples } from '../services/multiples.js';

const router = Router();

router.get('/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase().replace(/[^A-Z.]/g, '');
  if (!ticker) return res.status(400).json({ error: 'Invalid ticker' });

  try {
    const data = await fetchMultiples(ticker);
    if (!data) return res.status(404).json({ error: `No historical EPS found for ${ticker}` });
    res.json(data);
  } catch (e: any) {
    console.error(`Multiples error ${ticker}:`, e.message);
    res.status(502).json({ error: e.message });
  }
});

export default router;
