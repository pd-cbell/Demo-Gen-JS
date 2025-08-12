import express from 'express';

const app = express();
const port = Number(process.env.PORT) || 4000;

app.get('/', (_req, res) => {
  res.send('Hello from server');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
