import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '2m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    errors: ['rate<0.005'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const TOKEN = __ENV.TOKEN || '';

export default function () {
  const res = http.get(
    `${BASE_URL}/rest/public/users?limit=10&select=id,email`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );
  check(res, { 'query 200': (r) => r.status === 200 }) || errorRate.add(1);
  sleep(0.1);
}
