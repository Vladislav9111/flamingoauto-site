import { createHandler } from '../lib/lead-handler.mjs';

export { createHandler };
export default createHandler();
export const config = { path: '/api/lead', rateLimit: {
  windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain']
} };
