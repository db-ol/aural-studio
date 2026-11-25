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
  for (const file of ['curriculum', 'input', 'advanced-listening', 'music', 'session']) {
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
    describe(value) { node.oninput({ target: { hasAttribute: name => name === 'data-description', value } }); },
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

for (const grade of [7, 8]) {
  test('Grade ' + grade + ' mock keeps examples private until review and saves all its tasks', async () => {
    const { world, area, click, choose, describe, result } = fixture();
    const set = world.Music.makeSet({ version: 2, grade, study: 1, seed: 42 });
    const parts = Array.from(world.Curriculum.parts(grade));
    const performances = [];
    world.Piano.play = async (ex, mode, options) => {
      performances.push([ex.type, mode, options.recording]);
      return true;
    };
    world.Trainer.start({ mode: 'mock', set });
    for (const [index, key] of parts.entries()) {
      await click('prompt');
      if (key === 'a' || key === 'b') {
        if (key === 'a') await click('prompt');
        await click('self');
        assert.doesNotMatch(area.innerHTML, /data-do="model"|data-do="note-0"/);
        await click('rate-2');
      } else if (key === 'd') {
        await click('tap');
        await click('tap');
        await click('finish-taps');
        assert.match(area.innerHTML, /6\/8 time/);
        await click('metre-' + set.d.metre);
      } else if (key === 'desc') {
        assert.doesNotMatch(area.innerHTML, /class="tr-observations"/);
        describe('I heard a quiet return < a louder middle.');
        await click('compare-description');
        assert.match(area.innerHTML, /class="tr-observations"/);
        assert.match(area.innerHTML, /&lt; a louder middle/);
        await click('rate-1');
      } else {
        set[key].questions.forEach((q, i) => choose(i, q.answer));
        await click('check-c');
      }
      if (index < parts.length - 1) {
        assert.match(area.innerHTML, /Answer recorded/);
        assert.doesNotMatch(area.innerHTML, /tr-evidence|data-do="review-|tr-marks/);
      } else {
        assert.match(area.innerHTML, /Your mock test review/);
        for (const part of parts) assert.ok(area.innerHTML.includes('data-do="review-' + part + '"'));
        assert.match(area.innerHTML, /class="tr-evidence"/);
      }
      await click('next');
    }
    assert.equal(result().grade, grade);
    assert.deepEqual(Array.from(result().items, item => item.key), parts);
    assert.equal(result().items.find(item => item.key === 'ch').score, 100);
    assert.deepEqual(performances.filter(x => x[0] === 'a').map(x => x[1]), ['prompt', 'extra']);
    assert.deepEqual(performances.filter(x => x[0] === 'b').map(x => x.slice(1)), [['prompt', undefined], ['accompaniment', false]]);
    if (grade === 8) {
      assert.equal(result().items.at(-1).description, 'I heard a quiet return < a louder middle.');
      assert.equal(result().items.at(-1).method, 'self');
    }
  });
}

test('accompanied singing waits for the cue and offers pitch, timing and individual target playback', async () => {
  const { world, area, click, result } = fixture();
  const set = world.Music.makeSet({ version: 2, grade: 8, study: 1, seed: 942 });
  const pitches = world.Music.pitches(set.b, 'bass');
  const beatTimes = world.Music.onsets(set.b);
  const playback = [];
  const input = world.AuralInput;
  let position, finishAccompaniment, gated;
  input.supported = () => true;
  input.startVoiceIn = seconds => { position = seconds; };
  input.record = async (_, __, waitForCue) => { gated = waitForCue; };
  input.finish = () => pitches.map((p, i) => ({ pitch: p + 12 + (i === 2 ? .9 : 0), time: beatTimes[i] + .65 }));
  world.Piano.play = (ex, mode, opts) => {
    playback.push([ex.type, mode, opts.clef, opts.index]);
    if (mode === 'accompaniment') {
      assert.equal(opts.recording, true);
      opts.onVoiceStart(4.25);
      return new Promise(resolve => { finishAccompaniment = resolve; });
    }
    return Promise.resolve(true);
  };
  world.Trainer.start({ key: 'b', set, clef: 'bass' });
  await click('prompt');
  assert.match(area.innerHTML, /start recording before you sing/);
  await click('mic');
  assert.match(area.innerHTML, /Listen for your entry/);
  assert.equal(gated, true);
  assert.equal(position, 4.25);
  finishAccompaniment(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(area.innerHTML, /accompaniment has finished/);
  await click('finish-mic');
  assert.match(area.innerHTML, /1 octave above/);
  assert.match(area.innerHTML, /\+90¢/);
  assert.match(area.innerHTML, />High</);
  assert.match(area.innerHTML, /Rhythm match 0%/);
  await click('pitch-b-2');
  await click('model');
  assert.deepEqual(playback.slice(-2), [['b', 'note', 'bass', 2], ['b', 'model', 'bass', undefined]]);
  await click('next');
  const item = result().items[0];
  assert.equal(item.method, 'auto');
  assert.equal(item.marks[2], 'high');
  assert.equal(item.heardPitches[2], pitches[2] + 12.9);
  assert.equal(item.octave, 12);
  assert.equal(item.rhythmScore, 0);
  const history = world.Trainer.reviewItem(item, set.b, 'bass');
  assert.match(history, /\+90¢/);
  assert.doesNotMatch(history, /data-do=/);
});

test('cancelling an accompanied answer invalidates its cues and completion', async () => {
  const { world, area, click } = fixture();
  const set = world.Music.makeSet({ version: 2, grade: 7, study: 2, seed: 3 });
  let complete, cues = 0, schedule;
  world.AuralInput.supported = () => true;
  world.AuralInput.record = async () => {};
  world.AuralInput.startVoiceIn = () => { cues++; };
  world.Piano.play = (_, mode, options) => {
    if (mode !== 'accompaniment') return Promise.resolve(true);
    schedule = options.onVoiceStart;
    return new Promise(resolve => { complete = resolve; });
  };
  world.Trainer.start({ key: 'b', set });
  await click('prompt');
  await click('mic');
  await click('cancel-mic');
  schedule(2);
  complete(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cues, 0);
  assert.match(area.innerHTML, /data-do="mic"/);
  assert.doesNotMatch(area.innerHTML, /data-do="rate-0"|data-do="finish-mic"/);
});

test('legacy pitch feedback recounts known marks without inventing detected pitches', () => {
  const { world } = fixture();
  const set = world.Music.makeSet();
  const detail = world.Trainer.reviewItem({key:'b', method:'auto', marks:['ok', 'low', 'missed']}, set.b);
  assert.match(detail, /1 of 3 target notes/);
  assert.match(detail, />Low</);
  assert.doesNotMatch(detail, /undefined|Heard|Rhythm match/);
  assert.equal(world.Trainer.reviewItem({key:'b', method:'auto', score:55}, set.b), '');
});
