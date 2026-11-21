import express from 'express';
import path from 'node:path';
import cors from 'cors';
import quoteRouter from './routes/quote.js';
import secRouter from './routes/sec.js';
import chartRouter from './routes/chart.js';
import multiplesRouter from './routes/multiples.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/quote', quoteRouter);
app.use('/api/sec',   secRouter);
app.use('/api/chart', chartRouter);
app.use('/api/multiples', multiplesRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true, version: process.env.APP_VERSION ?? 'dev' }));

// Production: serve the built Vue client from the same origin (no CORS needed).
const STATIC_DIR = process.env.STATIC_DIR;
if (STATIC_DIR) {
  app.use(express.static(STATIC_DIR));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));
}

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
