import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const TOKEN = __ENV.TOKEN || '';
const QUERIES = [
  'India BaaS backend platform',
  'PostgreSQL realtime subscriptions',
  'WhatsApp OTP authentication',
  'vector search embedding',
  'DPDP compliance India',
];

export default function () {
  const query = QUERIES[Math.floor(Math.random() * QUERIES.length)];
  const res = http.post(
    `${BASE_URL}/ai/collections/docs/search`,
    JSON.stringify({ query, limit: 5 }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
    },
  );
  check(res, { 'search 200/404': (r) => r.status === 200 || r.status === 404 });
  sleep(0.5);
}
