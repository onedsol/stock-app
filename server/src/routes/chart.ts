import { Router } from 'express';
import { fetchChart, isChartRange } from '../services/yahoo.js';

const router = Router();

router.get('/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase().replace(/[^A-Z.]/g, '');
  if (!ticker) return res.status(400).json({ error: 'Invalid ticker' });

  const range = req.query.range ?? '1y';
  if (!isChartRange(range)) return res.status(400).json({ error: 'Invalid range' });

  try {
    const points = await fetchChart(ticker, range);
    res.json({ ticker, range, points });
  } catch (e: any) {
    console.error(`Chart error ${ticker}:`, e.message);
    res.status(502).json({ error: e.message });
  }
});

export default router;
