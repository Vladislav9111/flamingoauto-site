// Retired insecure legacy endpoint. No credentials, environment details or data writes.
exports.handler = async () => ({
  statusCode: 410,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  body: JSON.stringify({ error: 'This endpoint has been retired' })
});
