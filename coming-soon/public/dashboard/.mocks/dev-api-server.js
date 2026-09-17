import express from 'express';
const app = express();
app.use(express.json());
app.get('/api/config/pricing', (req, res) => {
  res.json({ success: true, pricing: {} });
});
app.get('/api/simplebeacon/billing/session', (req, res) => {
  res.json({ success: false });
});
app.get('/api/:rest(*)', (req, res) => {
  res.json({ ok: true });
});
const port = process.env.PORT || 53900;
app.listen(port, () => console.log('Dev API mock listening on', port));
