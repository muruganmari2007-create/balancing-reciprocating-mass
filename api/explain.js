// Vercel serverless function: POST /api/explain  { question, provider }
import { explain, errorResponse } from '../server/app.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  try {
    const { question, provider } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    res.status(200).json(await explain(question, provider));
  } catch (err) {
    const { status, body } = errorResponse(err);
    res.status(status).json(body);
  }
}
