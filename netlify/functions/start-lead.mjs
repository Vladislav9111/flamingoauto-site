import { createStartHandler } from '../lib/lead-handler.mjs';

export { createStartHandler as createHandler };
export default createStartHandler();
export const config = { path: '/api/lead/start', rateLimit: {
  windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain']
} };
