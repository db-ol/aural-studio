import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const scope = 'https://music.example/piano/aural/';
const root = new URL('../', import.meta.url);
const local = path => new URL(path, root);

test('install, refresh and read the complete practice site offline at a subpath', async () => {
  const handlers = new Map();
  const cached = new Map();
  const names = new Set(['aural-studio:' + scope + ':old', 'aural-studio:https://music.example/other/:v1']);
  const cache = {
    async addAll(requests) {
      for (const request of requests) {
        assert.ok(request.url.startsWith(scope), request.url);
        const body = await readFile(local(request.url.slice(scope.length)));
        cached.set(request.url, new Response(body));
      }
    },
    async match(url) { return cached.get(url)?.clone(); },
    async put(url, response) { cached.set(url, response); }
  };
  let online = false;
  let claimed = false;
  const globals = {
    self: {
      registration: { scope },
      clients: { claim() { claimed = true; } },
      addEventListener(type, handler) { handlers.set(type, handler); }
    },
    caches: {
      async open(name) { names.add(name); return cache; },
      async keys() { return [...names]; },
      async delete(name) { return names.delete(name); }
    },
    fetch: async () => {
      if (online) return new Response('Updated content');
      throw new TypeError('Offline');
    },
    URL, Request, Response
  };
  vm.runInNewContext(await readFile(local('sw.js'), 'utf8'), globals);
  const lifecycle = type => new Promise((resolve, reject) => {
    handlers.get(type)({ waitUntil: promise => promise.then(resolve, reject) });
  });
  const request = (path, method = 'GET') => {
    let result;
    handlers.get('fetch')({
      request: new Request(new URL(path, scope), { method }),
      respondWith(promise) { result = promise; }
    });
    return result;
  };

  await lifecycle('install');
  await lifecycle('activate');
  assert.ok(claimed);
  assert.ok(!names.has('aural-studio:' + scope + ':old'));
  assert.ok(names.has('aural-studio:https://music.example/other/:v1'));
  const page = await (await request('./?offline')).text();
  assert.match(page, /<!doctype html>/i);
  assert.match(page, /rel="manifest"[^>]*manifest\.webmanifest/);
  assert.match(page, /rel="apple-touch-icon"[^>]*apple-touch-icon\.png/);
  assert.equal(request('../scales/'), undefined);
  assert.equal(request('index.html', 'POST'), undefined);
  assert.equal(request('https://outside.example/resource'), undefined);

  const manifest = await (await request('manifest.webmanifest')).json();
  assert.equal(new URL(manifest.start_url, scope).href, scope);
  assert.equal(new URL(manifest.scope, scope).href, scope);
  for (const icon of manifest.icons) {
    const bytes = Buffer.from(await (await request(icon.src)).arrayBuffer());
    assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
    assert.equal(bytes.readUInt32BE(16) + 'x' + bytes.readUInt32BE(20), icon.sizes);
  }
  for (const [url, response] of cached) {
    const pathname = new URL(url).pathname;
    let refs = [];
    const body = () => response.clone().text();
    if (pathname.endsWith('.html')) {
      refs = [...(await body()).matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)=["']([^"']+)/gi)];
    } else if (pathname.endsWith('.css')) {
      refs = [...(await body()).matchAll(/url\(\s*["']?([^)'"]+)/gi)];
    } else if (pathname.endsWith('.js')) {
      refs = [...(await body()).matchAll(/\b(?:from\s*|import\s*\(?\s*)["']([^"']+)/g)];
    }
    for (const [, ref] of refs) {
      const asset = new URL(ref, url);
      if (asset.href.startsWith(scope)) {
        asset.search = '';
        assert.ok(cached.has(asset.href), 'Missing offline dependency ' + ref + ' in ' + pathname);
      }
    }
  }
  online = true;
  assert.equal(await (await request('js/app.js')).text(), 'Updated content');
  online = false;
  assert.equal(await (await request('js/app.js?v=2')).text(), 'Updated content');
});
