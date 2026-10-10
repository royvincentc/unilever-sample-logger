const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { spawnSync } = require('node:child_process');
const { entrypoints } = require('../tools/check-vercel-functions.cjs');
const config = require('../vercel.json');
const root = path.join(__dirname, '..');
const names = ['collaboration', 'workspace', 'drive-settings', 'drive-checkpoints', 'drive-worker'];

function gateway(dependencies) {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, 'api/shared.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  }});
  return exports.default;
}

test('deployment stays within Hobby function budget and excludes private handlers', () => {
  const functions = entrypoints(path.join(root, 'api'));
  assert.equal(functions.length, 10);
  assert.ok(functions.includes('shared.ts'));
  assert.ok(!functions.some(file => /Handler/.test(file)));
});

test('all public collaboration URLs route to their original handlers, including cron', async () => {
  const modules = ['_collaborationHandler', '_workspaceHandler', '_driveSettingsHandler', '_driveCheckpointsHandler', '_driveWorkerHandler'];
  for (const [index, name] of names.entries()) {
    const rewrite = config.rewrites.find(rule => rule.source === `/api/${name}`);
    assert.ok(rewrite, `Missing ${name} rewrite`);
    const url = new URL(rewrite.destination, 'https://fixture.invalid');
    assert.equal(url.pathname, '/api/shared');
    assert.equal(url.searchParams.get('__route'), name);
    const req = { method: name === 'drive-worker' ? 'GET' : 'POST', query: { __route: name, workspace: 'team', id: 'resource', download: 'snapshot' }, body: { operation: 'unchanged' }, headers: { authorization: 'Bearer original' } };
    const res = { setHeader(key, value) { assert.equal(key, 'Cache-Control'); assert.equal(value, 'no-store'); } };
    let called = false;
    const handle = gateway({ [`./${modules[index]}.js`]: { __esModule: true, default: async (actualReq, actualRes) => {
      called = true; assert.equal(actualReq, req); assert.equal(actualRes, res);
      assert.equal(actualReq.headers.authorization, 'Bearer original');
      assert.equal(actualReq.query.workspace, 'team'); assert.equal(actualReq.query.download, 'snapshot');
      assert.equal(actualReq.body.operation, 'unchanged'); assert.ok(!('__route' in actualReq.query));
    } }});
    await handle(req, res); assert.ok(called);
  }
  assert.equal(config.crons[0].path, '/api/drive-worker');
});

test('gateway rejects absent, duplicate and inherited route names before loading handlers', async () => {
  for (const route of [undefined, ['workspace', 'drive-worker'], '__proto__', 'constructor', 'unrecognized']) {
    let status;
    await gateway({})({ query: { __route: route } }, { setHeader() {}, status(value) { status = value; return this; }, json(body) { assert.equal(body.error, 'Unknown collaboration endpoint.'); } });
    assert.equal(status, 404);
  }
});

test('Firebase and JWKS verification work without CommonJS require-of-ESM support', () => {
  const result = spawnSync(process.execPath, ['--no-experimental-require-module', '-e', `
    require('firebase-admin/auth');
    const assert = require('node:assert/strict');
    const crypto = require('node:crypto');
    const jwks = require('jwks-rsa');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture', alg: 'RS256', use: 'sig' };
    const client = jwks({ jwksUri: 'https://fixture.invalid/unused', getKeysInterceptor: async () => [jwk] });
    client.getSigningKey('fixture').then(key => {
      const body = Buffer.from('local cryptographic verification');
      const signature = crypto.sign('RSA-SHA256', body, privateKey);
      assert.ok(crypto.verify('RSA-SHA256', body, key.getPublicKey(), signature));
    }).catch(error => { console.error(error); process.exitCode = 1; });
  `], { cwd: root, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
