// 404 handler for unknown routes (mounted after all routes in app.js).

export function notFound(_req, res) {
  res.status(404).json({ error: 'not_found' });
}
