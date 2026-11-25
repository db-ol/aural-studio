import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/input.js';

const { detectPitch, notesFromFrames, assessPitch, rhythm } = globalThis.AuralInput;

test('pitch estimator follows several vocal registers and ignores silence', () => {
  for (const rate of [44100, 48000]) {
    for (const midi of [41, 48, 55, 60, 69, 76, 80]) {
      const hz = 440 * 2 ** ((midi - 69) / 12);
      const signal = Float32Array.from({ length: 2048 }, (_, i) => {
        const phase = 2 * Math.PI * hz * i / rate;
        return 0.22 * Math.sin(phase) + 0.31 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase);
      });
      assert.ok(Math.abs(detectPitch(signal, rate) - midi) < 0.21);
    }
    assert.equal(detectPitch(new Float32Array(2048), rate), null);
  }
});

test('breaks in the voice retain repeated notes and reject brief glides', () => {
  const frames = [60, 60.12, 60.1, 60.2, null, null, null, null, 60.1, 60, 59.9, 60.1, 61, 62, 62.2, 62, 62]
    .map((pitch, index) => ({ pitch, time: index * 0.036 }));
  assert.deepEqual(notesFromFrames(frames).map(note => Math.round(note.pitch)), [60, 60, 62]);
});

test('pitch matching accepts a consistent change of octave and aligns missing notes', () => {
  const pitches = [65, 67, 69, 67, 65, 65];
  const notes = pitches.map((pitch, index) => ({ pitch: pitch - 12 + 0.1, time: index * 0.6 }));
  const exact = assessPitch(pitches, null, notes);
  assert.equal(exact.score, 100);
  assert.equal(exact.rhythmScore, null);
  const missing = assessPitch(pitches, null, notes.filter((_, i) => i !== 2));
  assert.deepEqual(missing.marks, ['ok', 'ok', 'missed', 'ok', 'ok', 'ok']);
  const wrongOctave = notes.map((note, i) => ({ ...note, pitch: note.pitch + (i === 2 ? 12 : 0) }));
  assert.equal(assessPitch(pitches, null, wrongOctave).marks[2], 'high');
  assert.equal(assessPitch(pitches, null, []), null);
});

test('rhythm ignores starting delay, accepts modest tempo variation and penalizes missing taps', () => {
  const target = [0, 0.5, 0.75, 1, 1.5, 2.5];
  assert.equal(rhythm(target, target.map(time => 16 + time * 1.1)), 100);
  assert.ok(rhythm(target, [0, 0.5]) < 30);
  assert.ok(rhythm(target, [0, 0.4, 0.8, 1.2, 1.6, 2]) < 80);
});

test('clap envelope rejects background noise and counts separate transient attacks', () => {
  const detector = globalThis.AuralInput.clapDetector();
  const claps = [0.3, 0.8, 1.05, 1.3, 1.8];
  const hits = [];
  for (let i = 0; i < 340; i++) {
    const time = i * 0.006;
    const tail = Math.min(...claps.filter(start => start <= time).map(start => time - start));
    const level = 0.005 + 0.001 * Math.sin(i) + 0.16 * Math.exp(-tail * 30);
    if (detector(level, time)) hits.push(time);
  }
  assert.equal(hits.length, claps.length);
  assert.ok(hits.every((time, i) => Math.abs(time - claps[i]) < 0.01));
});

test('media capture assembles the final recorder chunk only for a completed take and stops all tracks', async () => {
  const [{ default: vm }, { readFileSync }] = await Promise.all([import('node:vm'), import('node:fs')]);
  let trackStops = 0;
  let pauses = 0;
  class Recorder {
    mimeType = 'audio/example';
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      setImmediate(() => {
        this.ondataavailable?.({ data: new Blob(['take']) });
        this.onstop?.();
      });
    }
  }
  class Context {
    state = 'running';
    currentTime = 1;
    sampleRate = 48000;
    destination = {};
    async resume() {}
    async close() { this.state = 'closed'; pauses++; }
    createAnalyser() { return { fftSize: 2048, connect() {}, disconnect() {} }; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
  }
  const track = { readyState: 'live', addEventListener() {}, stop() { trackStops++; } };
  const session = { type: 'auto' };
  const world = {
    navigator: { audioSession: session, mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }) } },
    AudioContext: Context, MediaRecorder: Recorder, Blob, performance,
    setInterval: () => 1, clearInterval() {}, setTimeout: () => 1
  };
  vm.runInNewContext(readFileSync(new URL('../js/input.js', import.meta.url), 'utf8'), world);
  const input = world.AuralInput;
  let blob;
  await input.record(() => {});
  input.finish(take => { blob = take; });
  assert.equal(trackStops, 1);
  assert.equal(session.type, 'auto');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await blob.text(), 'take');
  assert.equal(blob.type, 'audio/example');
  await input.record(() => {});
  input.cancel();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(trackStops, 2);
  assert.equal(pauses, 2);
});
