require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// CORS_ORIGIN=* (e.g. Codespaces) → reflect request origin (supports credentials + all hosts)
// CORS_ORIGIN=https://a.com,https://b.com → allowlist
// unset → localhost dev default
const rawCorsOrigin = process.env.CORS_ORIGIN;
const corsOrigin = (!rawCorsOrigin || rawCorsOrigin === '*')
  ? true
  : rawCorsOrigin.split(',').map(o => o.trim());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/tasks',    require('./routes/tasks'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/export',   require('./routes/export'));
app.use('/api/capacity', require('./routes/capacity'));
app.use('/api/import',  require('./routes/import'));
app.use('/api/stats',   require('./routes/stats'));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
