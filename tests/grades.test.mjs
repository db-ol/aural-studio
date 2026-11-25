import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function app(initial = {}, hash = '') {
  const saved = new Map(Object.entries(initial));
  const handlers = new Map();
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id))
      nodes.set(id, {
        innerHTML: '',
        setAttribute() {},
        focus() {},
        addEventListener() {}
      });
    return nodes.get(id);
  }
  let lastExercise,
    stops = 0;
  const ctx = vm.createContext({
    document: { documentElement: {}, querySelector: node, getElementById: node, addEventListener() {} },
    navigator: {},
    location: {
      hash,
      replace(next) {
        this.hash = next;
      }
    },
    localStorage: { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) },
    scrollTo() {},
    addEventListener: (name, fn) => handlers.set(name, fn),
    Trainer: {
      start(options) {
        lastExercise = options;
      },
      stop() {
        stops++;
      },
      refresh() {},
      reviewItem() {
        return '';
      }
    }
  });
  ctx.window = ctx;
  for (const file of ['art', 'curriculum', 'advanced-listening', 'music', 'app']) {
    vm.runInContext(fs.readFileSync(new URL('../js/' + file + '.js', import.meta.url), 'utf8'), ctx);
  }
  return {
    ctx,
    saved,
    exercise: () => lastExercise,
    stops: () => stops,
    html: () => node('#workspace').innerHTML,
    go(path) {
      ctx.location.hash = '#' + path;
      handlers.get('hashchange')();
    }
  };
}

test('each grade exposes its own ordered tasks, and old practice links open Grade 5', () => {
  const { ctx, html, go, saved, exercise, stops } = app({ 'aural.studio.grade': '7' });
  assert.equal(ctx.App.grade, 7);
  const cases = [
    [5, ['a', 'b', 'c', 'd']],
    [7, ['a', 'b', 'cad', 'ch', 'mod', 'c', 'd']],
    [8, ['a', 'cad', 'ch', 'b', 'mod', 'minor', 'desc']]
  ];
  for (const [grade, keys] of cases) {
    go('grade/' + grade + '/studio');
    assert.deepEqual(
      [...html().matchAll(/class="skill-card [^"]+" href="#grade\/\d+\/practice\/(\w+)"/g)].map((m) => m[1]),
      keys
    );
    for (const key of keys) {
      go('grade/' + grade + '/practice/' + key);
      assert.equal(exercise().grade, grade);
      assert.equal(exercise().key, key);
      assert.equal(exercise().mode, 'practice');
    }
    go('grade/' + grade + '/session/mock');
    assert.equal(exercise().mode, 'mock');
  }
  go('grade/8/practice/d');
  assert.match(html(), /听觉练习室/);
  go('practice/b');
  assert.equal(exercise().grade, 5);
  assert.equal(saved.get('aural.studio.grade'), '5');
  assert.ok(stops() > 4);
});

test('legacy records stay in Grade 5 while an advanced record restores its own grade and score', () => {
  const old = {
    id: 'old',
    date: 1,
    mode: 'practice',
    clef: 'bass',
    recipe: { version: 1, seed: 42, study: 0 },
    items: [{ key: 'b', score: 90, method: 'auto', marks: ['ok', 'ok', 'ok', 'low', 'ok', 'ok'] }]
  };
  const { ctx, html, go, exercise, saved } = app({ 'aural.studio.history': JSON.stringify([old]) });
  go('grade/7/history');
  assert.doesNotMatch(html(), /href="#result\/old"/);
  const set = ctx.Music.makeSet(undefined, 7);
  ctx.App.complete({
    mode: 'practice',
    clef: 'treble',
    recipe: set.recipe,
    items: [{ key: 'mod', score: 100, method: 'auto', choices: [0] }]
  });
  const records = JSON.parse(saved.get('aural.studio.history'));
  assert.equal(records.length, 2);
  const id = records[0].id;
  go('grade/7/history');
  assert.ok(html().includes('href="#result/' + id + '"'));
  go('grade/8/history');
  assert.doesNotMatch(html(), /class="history-row"/);
  go('repeat/' + id + '/mod');
  assert.equal(exercise().grade, 7);
  assert.equal(exercise().key, 'mod');
  assert.deepEqual(exercise().set.recipe, set.recipe);
  go('result/old');
  assert.equal(ctx.App.grade, 5);
  assert.match(html(), /六音视唱/);
  go('repeat/old/b');
  assert.equal(exercise().clef, 'bass');
  assert.equal(exercise().set.recipe.seed, 42);
});

test('saving in one grade preserves a result another tab completed after startup', () => {
  const { ctx, go, saved } = app();
  go('grade/8/practice/desc');
  const other = {
    id: 'another',
    date: 1,
    grade: 7,
    mode: 'practice',
    items: [{ key: 'a', score: 70, method: 'self' }]
  };
  saved.set('aural.studio.history', JSON.stringify([other]));
  ctx.App.complete({
    mode: 'practice',
    clef: 'treble',
    recipe: ctx.Music.makeSet(undefined, 8).recipe,
    items: [{ key: 'desc', score: 70, method: 'self', description: '柔和的主题' }]
  });
  assert.deepEqual(
    JSON.parse(saved.get('aural.studio.history')).map((entry) => entry.grade),
    [8, 7]
  );
});
