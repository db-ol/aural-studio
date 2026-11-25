import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function music() {
  const context = vm.createContext({ AdvancedListening: { make: (_, __, base) => base } });
  vm.runInContext(readFileSync(new URL('../js/music.js', import.meta.url), 'utf8'), context);
  return context.Music;
}

test('published Grade 5 recipes preserve every field, note and answer after changing grades', () => {
  const api = music();
  for (const grade of [7, 8]) {
    const fresh = api.makeSet(undefined, grade);
    assert.equal(fresh.grade, grade);
    assert.ok(api.validRecipe(fresh.recipe));
    assert.deepEqual(api.makeSet(fresh.recipe, 5), fresh);
  }
  const legacy = {version: 1, seed: 123456, study: 3};
  const digest = createHash('sha256').update(JSON.stringify(api.makeSet(legacy, 8))).digest('hex');
  assert.equal(digest, '9f1ede770d3ddc01f4e8c937835b09172d3b8cd4cb2d15fc971d78e4e388eee1');
  assert.equal(api.validRecipe({...legacy, version: 2, grade: 6}), false);
});

function soundingPitches(voice) {
  let start = 0;
  const result = [];
  assert.equal(voice.notes.length, voice.beats.length);
  voice.notes.forEach((pitch, i) => {
    assert.ok(Number.isInteger(pitch));
    assert.ok(voice.beats[i] > 0);
    const end = start + voice.beats[i];
    for (let beat = start; beat < end; beat += .5) result.push(pitch);
    start = end;
  });
  return result;
}

for (const grade of [7, 8]) {
  test('Grade ' + grade + ' holds the sung part in the correct register throughout each phrase', () => {
    const api = music();
    const aKeys = new Set(), bKeys = new Set(), shapes = new Set();
    const octaveParts = new Set();
    for (let i = 0; i < 640; i++) {
      const seed = Math.imul(2654435761, i + 1) >>> 0;
      const {a, b} = api.makeSet({version: 2, grade, seed, study: i % 8});
      aKeys.add(a.key.en);
      bKeys.add(b.key.en);
      shapes.add(a.notes.map(pitch => pitch - a.tonic).join(',') + '/' + a.beats.join(','));
      assert.equal(a.otherVoices.length, grade === 8 ? 2 : 1);
      assert.equal(b.otherVoices.length, 1);
      assert.ok(Math.abs(a.signature) <= 3);
      assert.ok(Math.abs(b.signature) <= 4);
      for (const ex of [a, b]) {
        const range = Math.max(...ex.notes) - Math.min(...ex.notes);
        assert.ok(range <= 12);
        if (range === 12) octaveParts.add(ex.type);
        const lines = grade === 7 && ex === b ? [...ex.otherVoices, ex] : [ex, ...ex.otherVoices];
        const grid = lines.map(soundingPitches);
        for (const pitches of grid) assert.equal(pitches.length, ex.metre * 8);
        for (let v = 1; v < lines.length; v++) {
          assert.ok(grid[v].every((pitch, beat) => pitch > grid[v-1][beat]));
        }
      }
      assert.deepEqual(api.pitches(b,'bass'), b.notes.map(pitch => pitch - 12));
      for (const clef of ['treble','bass']) {
        const staff = api.score(b,clef,'en');
        assert.match(staff, /role="img"/);
        assert.ok(staff.includes(b.key.en + ', ' + b.metre + '/4'));
        assert.equal((staff.match(/<ellipse /g) || []).length, b.notes.length);
        assert.equal((staff.match(/<g transform=/g) || []).length, 2);
        assert.doesNotMatch(staff, /NaN|undefined/);
      }
    }
    assert.equal(aKeys.size, 14);
    assert.equal(bKeys.size, 18);
    assert.ok(shapes.size > 35);
    assert.equal(octaveParts.size, 2);
  });
}
