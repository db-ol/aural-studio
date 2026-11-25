import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
for (const file of ['advanced-listening', 'music']) {
  vm.runInContext(readFileSync(new URL('../js/' + file + '.js', import.meta.url), 'utf8'), context);
}

function set(grade, i) {
  const recipe = { version: 2, grade, seed: Math.imul(2654435761, 1 + i) >>> 0, study: i % 8 };
  return context.Music.makeSet(recipe);
}

const answer = q => q.options[q.answer].en;
const chroma = pitch => (pitch % 12 + 12) % 12;
function tonic(key) {
  const lookup = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return chroma(lookup[key.en[0]] + Number(key.en[1] === '♯') - Number(key.en[1] === '♭'));
}
function pitchesAt(events, beat) {
  return [...events].filter(e => Math.abs(e.at - beat) < 1e-6).map(e => e.pitch);
}

const chordDegrees = { I: 0, II: 1, IV: 3, V: 4, V7: 4, VI: 5 };
const major = [0, 2, 4, 5, 7, 9, 11], minor = [0, 2, 3, 5, 7, 8, 10];

for (const grade of [7, 8]) {
  test('Grade ' + grade + ' voices the same permitted cadence in both harmony questions', () => {
    const kinds = new Set(), chordIds = new Set();
    for (let i = 0; i < 180; i++) {
      const { cad, ch, a } = set(grade, i);
      const parts = grade === 7 ? 2 : 3;
      const scale = cad.key.en.endsWith('minor') ? minor : major;
      const kind = answer(cad.questions[0]);
      kinds.add(kind);
      assert.equal(cad.progression.length, parts);
      assert.equal(ch.progression, cad.progression);
      assert.equal(ch.questions.length, parts);
      const mode = cad.programs.model, voices = mode.events;
      const prompt = cad.programs.prompt;
      assert.equal(prompt.events.length, 4 + voices.length * 2);
      assert.equal(ch.programs.prompt.events.length, 4 + parts * 4 * (grade === 8 ? 2 : 1));
      assert.equal(chroma(Math.min(...pitchesAt(prompt.events, 0))), tonic(cad.key));

      cad.progression.forEach(({ id, pitches }, j) => {
        chordIds.add(id);
        const base = id.replace(/[bc]$/, '');
        const degree = chordDegrees[base];
        const inversion = id.endsWith('b') ? 1 : id.endsWith('c') ? 2 : 0;
        assert.ok(Number.isInteger(degree));
        if (grade === 7) assert.equal(inversion, 0);
        const chordTones = [0, 2, 4].map(step => scale[(degree + step) % 7]);
        if (degree === 4) chordTones[1] = 11;
        if (base === 'V7') chordTones.push(5);
        const sounding = Array.from(pitches, pitch => chroma(pitch - tonic(cad.key)));
        assert.equal(sounding[0], chordTones[inversion]);
        assert.deepEqual(new Set(sounding), new Set(chordTones));
        assert.ok(pitches.every((pitch, index) => index === 0 || pitch > pitches[index - 1]));
        const onsets = grade === 7 ? [mode.metre, mode.metre * 2]
          : [mode.metre, mode.metre + Math.ceil(mode.metre / 2), mode.metre * 2];
        assert.deepEqual(pitchesAt(voices, onsets[j]), [...pitches]);
        assert.deepEqual(pitchesAt(ch.programs.model.events, j * 1.4), [...pitches]);
        assert.ok(answer(ch.questions[j]).startsWith(id + ' ('));
      });
      const last = cad.progression.at(-1), preceding = cad.progression.at(-2);
      if (kind === 'Perfect') {
        assert.ok(['V','V7'].includes(preceding.id));
        assert.equal(last.id, 'I');
        assert.equal(last.pitches.at(-1) - preceding.pitches.at(-1), 1);
      }
      if (kind === 'Interrupted') {
        assert.ok(['V','V7'].includes(preceding.id));
        assert.equal(last.id, 'VI');
        assert.ok(last.pitches[0] > preceding.pitches[0]);
      }
      if (kind === 'Plagal') {
        assert.equal(preceding.id, 'IV');
        assert.equal(last.id, 'I');
        assert.equal(last.pitches[0] - preceding.pitches[0], -5);
      }
      if (kind === 'Imperfect') assert.equal(last.id, 'V');
      if (grade === 8) {
        assert.deepEqual(cad.key, a.key);
        assert.equal(mode.bpm, a.bpm);
        assert.equal(mode.metre, a.metre);
        const upper = a.otherVoices.at(-1);
        let cursor = -upper.beats.reduce((sum, beat) => sum + beat, 0) + a.metre;
        upper.beats.forEach((beat, n) => {
          if (cursor >= 0) assert.ok(pitchesAt(voices, cursor).includes(upper.notes[n]));
          cursor += beat;
        });
        const grouped = ch.programs.prompt;
        const singleOnsets = [...new Set(Array.from(grouped.events, e => e.at))].slice(-3);
        assert.ok(singleOnsets[1] - singleOnsets[0] >= 4);
        singleOnsets.forEach((at, j) => assert.deepEqual(pitchesAt(grouped.events, at), [...ch.progression[j].pitches]));
      }
    }
    assert.equal(kinds.size, grade === 7 ? 3 : 4);
    assert.equal(chordIds.size, grade === 7 ? 5 : 11);
  });
}

test('modulation answers match the sounding opening and closing keys', () => {
  const intervals = { Dominant: 7, Subdominant: 5, 'Relative major': 3, 'Relative minor': 9 };
  const minorDominants = new Set(), destinations = new Set();
  for (let i = 0; i < 220; i++) {
    const { mod, minor: second } = set(8, i);
    assert.ok(mod.key.en.endsWith('major'));
    assert.ok(second.key.en.endsWith('minor'));
    assert.notDeepEqual(mod.programs.model.events.map(e => e.at), second.programs.model.events.map(e => e.at));
    for (const exercise of [mod, second]) {
      const { model, prompt } = exercise.programs;
      const relation = answer(exercise.questions[0]);
      const ending = pitchesAt(model.events, 14).map(chroma);
      const target = tonic(exercise.destination);
      const initial = tonic(exercise.key);
      const minorMode = exercise.destination.en.endsWith('minor');
      destinations.add(relation);
      if (exercise === second && relation === 'Dominant') minorDominants.add(minorMode);
      assert.equal(chroma(target - initial), intervals[relation]);
      assert.equal(chroma(Math.min(...pitchesAt(prompt.events, 0))), initial);
      assert.equal(chroma(Math.min(...pitchesAt(model.events, 0))), initial);
      assert.equal(chroma(Math.min(...pitchesAt(model.events, 12)) - target), 7);
      assert.equal(chroma(Math.min(...pitchesAt(model.events, 14))), target);
      assert.ok(ending.includes(chroma(target + (minorMode ? 3 : 4))));
      assert.ok(exercise.questions[0].evidence.en.includes(exercise.destination.en));
      assert.equal(prompt.events.length, 4 + model.events.length);
    }
  }
  assert.equal(destinations.size, 4);
  assert.equal(minorDominants.size, 2);
});

test('feature prompts use two distinct topics and the clap extract quotes their piece exactly', () => {
  const metres = new Set(), topics = new Set(), structures = new Set(), dynamics = new Set();
  for (let i = 0; i < 260; i++) {
    const { c, d } = set(7, i);
    assert.equal(c.questions.length, 2);
    assert.notEqual(c.questions[0].topic.en, c.questions[1].topic.en);
    for (const q of c.questions) {
      topics.add(q.topic.en);
      if (q.topic.en === 'Structure') structures.add(answer(q));
      if (q.topic.en === 'Dynamics') dynamics.add(answer(q));
      assert.ok(q.evidence.en && q.evidence.zh && q.options[q.answer].zh);
    }
    metres.add(d.metre);
    assert.equal(d.piece, c.piece);
    let cursor = 0;
    for (let n = 0; n < d.notes.length; n++) {
      assert.ok(pitchesAt(c.piece.events, cursor).includes(d.notes[n]));
      assert.deepEqual(pitchesAt(d.programs.model.events, cursor), [d.notes[n]]);
      cursor += d.beats[n];
    }
    assert.equal(cursor, 2 * (d.metre === 6 ? 3 : d.metre));
    assert.equal(d.programs.prompt.events.length, 2 * d.notes.length);
  }
  assert.deepEqual(metres, new Set([2,3,4,6]));
  assert.equal(topics.size, 8);
  assert.equal(structures.size, 3);
  assert.equal(dynamics.size, 2);
});

test('open descriptions pair the recording with bilingual observations and repeat the saved recipe', () => {
  for (let i = 0; i < 30; i++) {
    const {desc} = set(8, i);
    assert.equal(desc.programs.prompt, desc.piece);
    assert.equal(desc.questions, undefined);
    assert.ok(desc.observations.length >= 4);
    assert.ok(desc.observations.every(q => q.en.length > 10 && q.zh.length > 5));
    assert.ok(desc.piece.events.every(e => Number.isFinite(e.at) && Number.isFinite(e.pitch) && e.volume > 0 && e.duration > 0));
    assert.deepEqual(set(8,i).desc, desc);
  }
});
