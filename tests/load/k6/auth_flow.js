import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const signupDuration = new Trend('signup_duration', true);
const signinDuration = new Trend('signin_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export default function () {
  const email = `load_test_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;

  const signupStart = Date.now();
  const signupRes = http.post(
    `${BASE_URL}/auth/signup`,
    JSON.stringify({ email, password: 'LoadTest123!' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  signupDuration.add(Date.now() - signupStart);
  check(signupRes, {
    'signup 201': (r) => r.status === 201 || r.status === 200,
    'signup has token': (r) => JSON.parse(r.body || '{}')?.data?.access_token != null,
  }) || errorRate.add(1);

  sleep(0.5);

  const signinStart = Date.now();
  const signinRes = http.post(
    `${BASE_URL}/auth/signin`,
    JSON.stringify({ email, password: 'LoadTest123!' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  signinDuration.add(Date.now() - signinStart);
  const token = JSON.parse(signinRes.body || '{}')?.data?.access_token;
  check(signinRes, {
    'signin 200': (r) => r.status === 200,
    'signin has token': () => token != null,
  }) || errorRate.add(1);

  sleep(0.5);
}
