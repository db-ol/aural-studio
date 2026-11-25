import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const musicSource = readFileSync(new URL('../js/music.js', import.meta.url), 'utf8');
const audioSource = readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8');

function harness(extra = {}) {
  let seed = 7;
  const math = Object.create(Math);
  math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const scope = vm.createContext({ Math: math, setTimeout, clearTimeout, ...extra });
  vm.runInContext(musicSource, scope);
  return scope;
}

test('memory and sight exercises stay inside the Grade 5 pitch and key limits', () => {
  const { Music } = harness();
  const memoryKeys = new Set(), sightKeys = new Set(), sightPitches = new Set();
  for (let i = 0; i < 2500; i++) {
    const { a, b } = Music.makeSet();
    memoryKeys.add(a.key.en);
    sightKeys.add(b.key.en);
    sightPitches.add(b.notes.join(','));
    assert.equal(a.notes.length, a.beats.length);
    assert.equal(a.beats.reduce((sum, d) => sum + d, 0) % a.metre, 0);
    assert.ok(Math.max(...a.notes) - Math.min(...a.notes) <= 12);
    assert.ok(Math.abs(a.signature) <= 3);
    assert.ok(!b.isMinor && Math.abs(b.signature) <= 2);
    assert.equal(b.notes.length, 6);
    assert.equal(b.notes[0], b.tonic);
    assert.equal(b.notes[5], b.tonic);
    assert.ok(b.notes.every(n => n >= b.tonic - 5 && n <= b.tonic + 7));
    const home = b.positions[0];
    for (let j = 1; j < b.positions.length; j++) {
      const n = b.positions[j], prev = b.positions[j - 1];
      assert.ok(Math.abs(n - prev) <= 2 || (prev === home - 3 && n === home));
    }
    assert.deepEqual(Music.pitches(b, 'bass'), b.notes.map(n => n - 12));
    assert.equal(Music.onsets(a)[0], 0);
  }
  assert.equal(memoryKeys.size, 14);
  assert.equal(sightKeys.size, 5);
  assert.ok(sightPitches.size > 200);
});

test('both listening tasks use the same piece and its opening unaccompanied melody', () => {
  const { Music } = harness();
  const features = new Set(), styles = new Set(), metres = new Set();
  for (let i = 0; i < 120; i++) {
    const { b, c, d } = Music.makeSet();
    assert.equal(c.piece, d.piece);
    assert.equal(c.piece.length, d.metre * 4);
    assert.equal(d.beats.reduce((sum, n) => sum + n, 0), d.metre * 2);
    assert.equal(d.notes.length, d.beats.length);
    let at = 0;
    d.notes.forEach((pitch, i) => {
      assert.ok(c.piece.events.some(e => e.at === at && pitch === e.pitch));
      at += d.beats[i];
    });
    assert.ok(c.piece.events.every(e => e.duration > 0 && e.volume > 0));
    assert.ok(Music.score(b, 'bass', 'zh').includes('低音谱号'));
    assert.ok(Music.score(b, 'treble', 'en').includes('Treble'));
    assert.ok(!Music.score(b).includes('NaN'));
    for (const q of c.questions) {
      assert.ok(q.options[q.answer].en && q.options[q.answer].zh);
      assert.ok(q.evidence.en && q.evidence.zh);
    }
    features.add(c.questions[0].topic.en);
    styles.add(c.questions[1].options[c.questions[1].answer].en);
    metres.add(d.metre);
  }
  assert.equal(features.size, 5);
  assert.equal(styles.size, 4);
  assert.deepEqual([...metres].sort(), [2, 3, 4]);
});

test('the accessible staff uses key spelling and follows the selected clef octave', () => {
  const { Music } = harness();
  const b = {
    type: 'b', key: { en: 'B♭ major', zh: 'B♭ 大调' }, signature: -2,
    positions: [27, 29, 30, 28, 29, 27], notes: [58, 62, 63, 60, 62, 58]
  };
  assert.match(Music.score(b), /B♭3, D4, E♭4, C4, D4, B♭3/);
  assert.match(Music.score(b, 'bass', 'zh'), /B♭2、D3、E♭3、C3、D3、B♭2/);
});

test('saved recipes reproduce every note and answer choice without advancing the study deck', () => {
  const { Music } = harness();
  const control = harness().Music;
  const original = Music.makeSet();
  const saved = JSON.parse(JSON.stringify(original.recipe));
  control.makeSet();
  assert.deepEqual(Music.makeSet(saved), original);
  const studyOrder = [saved.study];
  for (let i = 0; i < 7; i++) {
    const expected = control.makeSet();
    const generated = Music.makeSet();
    assert.equal(JSON.stringify(expected), JSON.stringify(generated));
    studyOrder.push(generated.recipe.study);
  }
  assert.equal(new Set(studyOrder).size, 8);
  for (const recipe of [null, 'invalid', { ...saved, version: 2 }, { ...saved, seed: -1 },
    { ...saved, seed: 2 ** 32 }, { ...saved, study: 8 }, { ...saved, study: .5 }]) {
    const fresh = Music.makeSet(recipe);
    assert.deepEqual(fresh, Music.makeSet(fresh.recipe));
  }
});

function fakeContext(extra = {}) {
  const oscillators = [];
  function param() {
    return { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  }
  const node = { connect() {}, disconnect() {} };
  class AudioContext {
    state = 'running';
    currentTime = 1;
    destination = node;
    createPeriodicWave() { return {}; }
    createBiquadFilter() { return { ...node, frequency: param(), Q: param() }; }
    createGain() { return { ...node, gain: param() }; }
    createOscillator() {
      const osc = { ...node, frequency: {}, setPeriodicWave() { this.pitched = true; },
        start(time) { this.at = time; }, stop(time) { this.until = time; } };
      oscillators.push(osc);
      return osc;
    }
  }
  const scope = harness({ AudioContext, ...extra });
  vm.runInContext(audioSource, scope);
  async function play(ex, mode = 'prompt', options) {
    oscillators.length = 0;
    const completed = scope.Piano.play(ex, mode, options);
    const marker = oscillators.at(-1);
    const notes = oscillators.slice(0, -1).map(({ at, until, frequency, pitched }) =>
      ({ at, until, hz: frequency.value, pitched }));
    assert.ok(notes.every(n => n.until > n.at && Number.isFinite(n.hz)));
    marker.onended();
    assert.equal(await completed, true);
    return notes;
  }
  return { ...scope, play };
}

test('prompts schedule the starting reference, two bar count and required repetitions', async () => {
  const { Music, Piano, play } = fakeContext();
  const { a, b, c, d } = Music.makeSet();
  const played = await play(a);
  assert.equal(played.filter(n => !n.pitched).length, a.metre * 2);
  assert.equal(played.filter(n => n.pitched).length, 5 + a.notes.length * 2);
  const extract = await play(d);
  assert.equal(extract.length, d.notes.length * 2);
  assert.deepEqual(extract.slice(0, d.notes.length).map(n => n.hz), extract.slice(d.notes.length).map(n => n.hz));
  assert.equal((await play(b)).length, 5);
  assert.equal((await play(b, 'model')).length, 6);
  const high = await play(b, 'note', { index: 2 });
  const low = await play(b, 'note', { index: 2, clef: 'bass' });
  assert.ok(Math.abs(low[0].hz * 2 - high[0].hz) < 1e-8);
  assert.equal((await play(c)).length, c.piece.events.length);
  const cancelled = Piano.play(a);
  Piano.stop();
  assert.equal(await cancelled, false);
});

test('advanced memory plays all voices, while accompanied singing plays the other part alone', async () => {
  const writes = [];
  const audioSession = {get type() { return 'play-and-record'; }, set type(mode) { writes.push(mode); }};
  const { Music, play } = fakeContext({
    navigator: {audioSession}, AdvancedListening: { make: (_, __, base) => base }
  });
  const midi = note => Math.round(69 + 12 * Math.log2(note.hz / 440));
  for (const grade of [7, 8]) {
    const {a,b} = Music.makeSet({version: 2, seed: 42, study: 3, grade});
    const ensembleSize = [a, ...a.otherVoices].reduce((sum, voice) => sum + voice.notes.length, 0);
    const memory = await play(a);
    assert.equal(memory.filter(note => !note.pitched).length, a.metre * 2);
    assert.equal(memory.filter(note => note.pitched).length, 5 + 2 * ensembleSize);
    assert.equal((await play(a, 'extra')).length, ensembleSize);
    assert.deepEqual((await play(a,'model')).map(midi), [...a.notes]);
    assert.equal((await play(b)).filter(note => !note.pitched).length, b.metre);
    for (const clef of ['treble','bass']) {
      let delay;
      writes.length = 0;
      const accompaniment = await play(b, 'accompaniment', {
        clef, recording: true, onVoiceStart: seconds => { delay = seconds; }
      });
      assert.deepEqual(writes, []);
      assert.equal(accompaniment.filter(note => !note.pitched).length, b.metre * 2);
      const first = accompaniment[0].at + 2 + 2 * b.metre * 60 / b.bpm;
      assert.ok(Math.abs(1 + delay - first) < 1e-9);
      const sung = accompaniment.filter(note => note.at >= first - 1e-9);
      const shift = clef === 'bass' ? -12 : 0;
      assert.deepEqual(sung.map(midi), [...b.otherVoices[0].notes].map(pitch => pitch + shift));
      assert.deepEqual((await play(b, 'model', {clef})).map(midi), [...Music.pitches(b,clef)]);
    }
  }
});

test('an advanced listening program follows its own event times and selected playback mode', async () => {
  const {play} = fakeContext();
  const prompt = {bpm: 120, length: 4, events: [
    {pitch: 60, at: 0, duration: 1, volume: .7}, {pitch: 67, at: 2, duration: .5, volume: .6}
  ]};
  const model = {bpm: 120, length: 1, events: [prompt.events[0]]};
  const task = {type: 'cad', programs: {prompt, model}};
  const heard = await play(task);
  assert.equal(heard.length, 2);
  assert.ok(Math.abs(heard[1].at - heard[0].at - 1) < 1e-9);
  assert.equal((await play(task, 'model')).length, 1);
});
