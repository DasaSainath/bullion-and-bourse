const express = require('express');
const path = require('path');
const apiRouter = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// API routes (JSON)
app.use('/api', apiRouter);

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Bullion & Bourse running → http://localhost:${PORT}`);
});
