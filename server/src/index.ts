import express from 'express';
import cors from 'cors';
import quoteRouter from './routes/quote.js';
import secRouter from './routes/sec.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/quote', quoteRouter);
app.use('/api/sec',   secRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
