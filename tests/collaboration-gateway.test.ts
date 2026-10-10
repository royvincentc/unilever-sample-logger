import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/shared';

test('real consolidated handlers reject unauthenticated calls, including the cron worker', async () => {
  for (const route of ['collaboration', 'workspace', 'drive-settings', 'drive-checkpoints', 'drive-worker']) {
    let status = 200;
    let body: any;
    const response = { setHeader() {}, status(code: number) { status = code; return this; }, json(value: any) { body = value; } };
    await handler({ method: 'GET', query: { __route: route }, headers: {}, body: {} } as any, response as any);
    assert.equal(status, 401, `${route} must retain its authentication boundary`);
    assert.equal(typeof body.error, 'string');
  }
});
