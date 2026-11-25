import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture() {
  const node = { contains: () => false, focus() {}, scrollIntoView() {}, classList: { remove() {}, add() {} } };
  node.querySelector = () => node;
  const area = { innerHTML: '', querySelector: () => node };
  const document = { getElementById: () => area, addEventListener() {}, querySelector: () => node };
  let result;
  const world = {
    document, performance, setInterval, clearInterval, setTimeout, clearTimeout,
    window: null, PointerEvent: class {},
    Piano: { stop() {}, play: async () => true },
    App: { lang: 'en', t: (en, zh) => world.App.lang === 'en' ? en : zh, complete(value) { result = value; } }
  };
  world.window = world;
  vm.createContext(world);
  for (const file of ['input', 'music', 'session']) {
    vm.runInContext(fs.readFileSync(new URL('../js/' + file + '.js', import.meta.url), 'utf8'), world);
  }
  return {
    world, area,
    async click(action) {
      assert.ok(area.innerHTML.includes('data-do="' + action + '"'), 'Expected control ' + action);
      const control = { dataset: { do: action } };
      node.onclick({ detail: 0, target: { closest: () => control } });
      await new Promise(resolve => setImmediate(resolve));
    },
    choose(q, value) { node.onchange({ target: { dataset: { q }, value } }); },
    result: () => result
  };
}

test('full mock with self review, no microphone, linked listening questions and deferred feedback', async () => {
  const { world, area, click, choose, result } = fixture();
  const set = world.Music.makeSet();
  world.Trainer.start({ mode: 'mock', set });
  assert.match(area.innerHTML, /Melody recall/);
  assert.doesNotMatch(area.innerHTML, /data-do="self"/);
  for (const next of ['a', 'b']) {
    if (next === 'b') await click('clef-bass');
    await click('prompt');
    await click('self');
    await click('rate-2');
    assert.match(area.innerHTML, /Answer recorded/);
    assert.doesNotMatch(area.innerHTML, /class="tr-marks"/);
    await click('next');
  }
  await click('prompt');
  set.c.questions.forEach((q, i) => choose(i, q.answer));
  await click('check-c');
  assert.doesNotMatch(area.innerHTML, /class="tr-evidence"/);
  await click('next');
  await click('prompt');
  await click('tap');
  await click('tap');
  await click('finish-taps');
  await click('metre-' + set.d.metre);
  assert.match(area.innerHTML, /Your mock test review/);
  assert.match(area.innerHTML, /class="tr-evidence"/);
  for (const part of ['a', 'b', 'c', 'd']) assert.ok(area.innerHTML.includes('data-do="review-' + part + '"'));
  await click('next');
  assert.equal(result().items.map(item => item.key).join(''), 'abcd');
  assert.equal(result().items[0].method, 'self');
  assert.equal(result().items[2].score, 100);
  assert.equal(result().items[3].metreScore, 100);
});

test('a late playback result cannot reveal answers in the next exercise', async () => {
  const { world, area, click } = fixture();
  let resolve;
  world.Piano.play = () => new Promise(done => { resolve = done; });
  world.Trainer.start({ key: 'a' });
  await click('prompt');
  world.Trainer.start({ key: 'b' });
  resolve(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(area.innerHTML, /Sight singing/);
  assert.doesNotMatch(area.innerHTML, /data-do="self"/);
});

test('microphone claps advance to metre and late permission cannot overwrite another question', async () => {
  const { world, area, click, result } = fixture();
  const set = world.Music.makeSet();
  const input = world.AuralInput;
  let onClap, grant;
  input.supported = () => true;
  input.record = (_, callback) => { onClap = callback; return new Promise(resolve => { grant = resolve; }); };
  world.Trainer.start({ key: 'd', set });
  await click('prompt');
  await click('mic');
  assert.match(area.innerHTML, /Opening microphone/);
  grant();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(area.innerHTML, /Clap into the microphone/);
  world.Music.onsets(set.d).forEach(time => onClap(time + 3));
  await click('finish-mic');
  await click('metre-' + set.d.metre);
  await click('next');
  assert.equal(result().items[0].rhythmScore, 100);
  world.Trainer.start({ key: 'a' });
  await click('prompt');
  await click('mic');
  await click('cancel-mic');
  world.Trainer.start({ key: 'b' });
  grant();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(area.innerHTML, /Sight singing/);
  assert.doesNotMatch(area.innerHTML, /Your microphone is listening/);
});

test('microphone replay releases its URL, discards a retried take and keeps audio out of saved results', async () => {
  const { world, area, click, result } = fixture();
  const set = world.Music.makeSet();
  let deliver;
  const released = [];
  world.URL = { createObjectURL: () => 'blob:exercise', revokeObjectURL: url => released.push(url) };
  world.Audio = class { async play() {} pause() {} load() {} removeAttribute() {} };
  world.AuralInput.supported = () => true;
  world.AuralInput.record = async () => {};
  world.AuralInput.finish = callback => {
    deliver = callback;
    return set.b.notes.map((pitch, i) => ({ pitch, time: i * .6 }));
  };
  world.Trainer.start({ key: 'b', set });
  for (let i = 0; i < 2; i++) {
    await click('prompt');
    await click('mic');
    await click('finish-mic');
    deliver(new Blob(['my local take']));
    assert.match(area.innerHTML, /data-do="take-b"/);
    await click('take-b');
    if (i === 0) {
      await click('retry');
      deliver(new Blob(['old take']));
      assert.doesNotMatch(area.innerHTML, /data-do="take-b"/);
    } else {
      await click('model');
      await click('next');
    }
  }
  assert.deepEqual(released, ['blob:exercise', 'blob:exercise']);
  assert.equal(result().items[0].score, 100);
  assert.ok(!JSON.stringify(result()).includes('blob:exercise'));
  assert.ok(!Object.hasOwn(result().items[0], 'take'));
});

test('mock recording replay is held for the final review and A allows a single extra hearing', async () => {
  const { world, area, click, choose } = fixture();
  const set = world.Music.makeSet();
  let deliver;
  const modes = [];
  world.Piano.play = async (_, mode) => { modes.push(mode); return true; };
  world.URL = { createObjectURL() {}, revokeObjectURL() {} };
  world.Audio = class {};
  world.AuralInput.supported = () => true;
  world.AuralInput.record = async () => {};
  world.AuralInput.finish = callback => {
    deliver = callback;
    return set.a.notes.map((pitch, i) => ({ pitch, time: world.Music.onsets(set.a)[i] }));
  };
  world.Trainer.start({ mode: 'mock', set });
  await click('prompt');
  await click('prompt');
  assert.deepEqual(modes, ['prompt', 'model']);
  await click('mic');
  await click('finish-mic');
  await click('next');
  deliver(new Blob(['first answer']));
  assert.doesNotMatch(area.innerHTML, /data-do="take-a"/);
  await click('prompt');
  await click('self');
  await click('rate-2');
  await click('next');
  await click('prompt');
  set.c.questions.forEach((q, i) => choose(i, q.answer));
  await click('check-c');
  await click('next');
  await click('prompt');
  await click('tap');
  await click('tap');
  await click('finish-taps');
  assert.doesNotMatch(area.innerHTML, /data-do="take-a"/);
  await click('metre-' + set.d.metre);
  assert.match(area.innerHTML, /data-do="take-a"/);
});
