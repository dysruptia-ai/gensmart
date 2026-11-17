/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Request headers of safeFetch. requestOnce connects through safeLookup, which refuses loopback
 * addresses, so the header building is tested as a pure function (buildRequestHeaders), together
 * with the redirect filter (headersForRedirect).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequestHeaders, DEFAULT_USER_AGENT, headersForRedirect } from './safe-url';

describe('safeFetch request headers', () => {
  test('no User-Agent from the caller → the default one is sent', () => {
    const h = buildRequestHeaders({ Accept: 'image/*' }, false);
    assert.equal(h['User-Agent'], DEFAULT_USER_AGENT);
    assert.equal(DEFAULT_USER_AGENT, 'GenSmart/1.0 (+https://gensmart.co)');
    assert.equal(h['Accept'], 'image/*');
    assert.equal(h['Accept-Encoding'], 'gzip, deflate, br');
    assert.equal(buildRequestHeaders({}, true)['Accept-Encoding'], 'identity');
  });

  test("the caller's own User-Agent is kept (any case), never duplicated", () => {
    for (const key of ['User-Agent', 'user-agent', 'USER-AGENT']) {
      const h = buildRequestHeaders({ [key]: 'MiBot/2' }, false);
      const uaKeys = Object.keys(h).filter((k) => k.toLowerCase() === 'user-agent');
      assert.deepEqual(uaKeys, [key]);
      assert.equal(h[key], 'MiBot/2');
    }
  });

  test('Content-Length for a body; caller Accept-Encoding respected', () => {
    const h = buildRequestHeaders({ 'accept-encoding': 'br' }, true, 'ñ');
    assert.equal(h['Content-Length'], '2');
    assert.equal(h['Accept-Encoding'], undefined);
    assert.equal(h['accept-encoding'], 'br');
  });

  test('cross-origin redirect: User-Agent kept, custom headers and credentials dropped', () => {
    const from = new URL('https://a.example.com/x');
    const to = new URL('https://cdn.example.net/y');
    const sent = { 'User-Agent': 'MiBot/2', Authorization: 'Bearer secreto', 'X-Api-Key': 'k', Accept: 'image/*' };
    assert.deepEqual(headersForRedirect(sent, from, to, false), { 'User-Agent': 'MiBot/2', Accept: 'image/*' });
    // Same origin keeps everything.
    assert.deepEqual(headersForRedirect(sent, from, new URL('https://a.example.com/z'), false), sent);
    // Without a caller User-Agent, the next hop gets the default again from buildRequestHeaders.
    const next = buildRequestHeaders(headersForRedirect({ Authorization: 'Bearer s' }, from, to, false), false);
    assert.equal(next['User-Agent'], DEFAULT_USER_AGENT);
    assert.equal(next['Authorization'], undefined);
  });
});
