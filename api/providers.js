// Vercel serverless function: GET /api/providers
import { providersInfo } from '../server/app.js';

export default function handler(req, res) {
  res.status(200).json(providersInfo());
}
