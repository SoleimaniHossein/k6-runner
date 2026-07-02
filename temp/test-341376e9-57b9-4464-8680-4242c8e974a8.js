import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  "vus": 1,
  "duration": "30s"
};

export default function() {
  const url = 'http://localhost:5555/';
  const payload = null;
  const headers = {"Content-Type":"application/json"};
  const res = http.get(url, { headers });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
