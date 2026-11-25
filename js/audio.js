(function (root) {
  'use strict';

  let context = null;
  let wave = null;
  let current = null;

  function openContext() {
    const AudioContext = root.AudioContext || root.webkitAudioContext;
    if (!AudioContext) throw new Error('Audio playback is unavailable.');
    if (!context || context.state === 'closed' || context.state === 'interrupted') {
      const old = context;
      if (old && old.state !== 'closed') old.close().catch(() => {});
      context = new AudioContext();
      const harmonics = new Float32Array([0, 1, .47, .25, .16, .105, .067, .045, .030, .019, .01]);
      wave = context.createPeriodicWave(new Float32Array(harmonics.length), harmonics);
      const created = context;
      created.onstatechange = () => {
        if (created === context && current && current.started && created.state !== 'running') stop();
      };
    }
    return context;
  }

  function finish(run, completed, error) {
    if (run.finished) return;
    run.finished = true;
    clearTimeout(run.startTimer);
    if (current === run) current = null;
    for (const node of run.sources) {
      node.onended = null;
      try { node.stop(); } catch {}
      node.disconnect();
    }
    if (run.bus) run.bus.disconnect();
    if (run.sessionType !== undefined) {
      try { root.navigator.audioSession.type = run.sessionType; } catch {}
    }
    if (error) run.reject(error);
    else run.resolve(completed);
  }

  function stop() {
    if (current) finish(current, false);
  }

  function sound(run, note, start, length, power, click = false) {
    const c = run.context;
    const oscillator = c.createOscillator();
    const gain = c.createGain();
    const frequency = click ? note : 440 * Math.pow(2, (note - 69) / 12);
    oscillator.frequency.value = frequency;
    if (click) oscillator.type = 'sine';
    else oscillator.setPeriodicWave(wave);
    const press = Math.max(.045, length);
    const end = start + press;
    const tail = click ? .025 : .11;
    const level = (click ? .18 : .30) * power;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + .009);
    const decay = Math.min(.17, press * .48);
    gain.gain.exponentialRampToValueAtTime(level * .58, start + decay);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, level * .58 * Math.exp(-press * .85)), end);
    gain.gain.exponentialRampToValueAtTime(.0001, end + tail);
    if (click) oscillator.connect(gain);
    else {
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = .55;
      filter.frequency.setValueAtTime(Math.min(8000, frequency * (5.5 + power * 4)), start);
      filter.frequency.exponentialRampToValueAtTime(Math.min(5500, frequency * 3.1), end + tail);
      oscillator.connect(filter);
      filter.connect(gain);
    }
    gain.connect(run.bus);
    oscillator.start(start);
    oscillator.stop(end + tail);
    run.sources.push(oscillator);
    run.end = Math.max(run.end, end + tail);
  }

  function notes(run, exercise, start, clef, crispness = .86) {
    const pitches = root.Music.pitches(exercise, clef);
    const seconds = 60 / exercise.bpm;
    let beat = 0;
    pitches.forEach((pitch, i) => {
      const duration = exercise.beats[i];
      const barStart = exercise.metre && beat % exercise.metre === 0;
      sound(run, pitch, start + beat * seconds, duration * seconds * crispness, barStart ? .91 : .72);
      beat += duration;
    });
    return start + beat * seconds;
  }

  function reference(run, exercise, start, clef) {
    const tonic = exercise.tonic + (clef === 'bass' && exercise.type === 'b' ? -12 : 0);
    [tonic - 12, tonic, tonic + (exercise.isMinor ? 3 : 4), tonic + 7].forEach(pitch =>
      sound(run, pitch, start, .71, .42));
    const first = root.Music.pitches(exercise, clef)[0];
    sound(run, first, start + 1, .61, .88);
    return start + 2;
  }

  function piece(run, data, start) {
    const seconds = 60 / data.bpm;
    const middle = data.length / 2;
    // Integrate the widening beats so both voices share the same ritardando.
    function time(beat) {
      const late = Math.max(0, beat - middle);
      return seconds * (beat + (data.ritard ? .33 * late * late / middle : 0));
    }
    for (const note of data.events) {
      const t = time(note.at);
      sound(run, note.pitch, start + t, time(note.at + note.duration) - t, note.volume * .85);
    }
  }

  function schedule(run, exercise, mode, options) {
    const { context: c } = run;
    const start = c.currentTime + .055;
    const clef = options.clef || 'treble';
    if (mode === 'note') {
      const pitch = root.Music.pitches(exercise, clef)[options.index ?? 0];
      if (!Number.isFinite(pitch)) throw new Error('Unknown note.');
      sound(run, pitch, start, .63, .82);
    } else if (exercise.type === 'c') {
      piece(run, exercise.piece, start);
    } else if (mode === 'reference' || (exercise.type === 'b' && mode === 'prompt')) {
      reference(run, exercise, start, clef);
    } else if (mode === 'prompt' && exercise.type === 'a') {
      const beat = 60 / exercise.bpm;
      const countIn = reference(run, exercise, start, clef);
      for (let i = 0; i < exercise.metre * 2; i++) {
        const strong = i % exercise.metre === 0;
        sound(run, strong ? 1460 : 990, countIn + i * beat, .049, strong ? 1 : .65, true);
      }
      const end = notes(run, exercise, countIn + exercise.metre * 2 * beat, clef);
      notes(run, exercise, end + beat * 1.5, clef);
    } else {
      const end = notes(run, exercise, start, clef);
      if (exercise.type === 'd' && mode === 'prompt') notes(run, exercise, end + .77, clef);
    }
    // A silent marker follows the audio clock, including output interruptions.
    const marker = c.createOscillator();
    const silent = c.createGain();
    silent.gain.value = 0;
    marker.connect(silent);
    silent.connect(run.bus);
    marker.onended = () => finish(run, true);
    marker.start(start);
    marker.stop(run.end + .035);
    run.sources.push(marker);
  }

  function play(exercise, mode = 'prompt', options = {}) {
    stop();
    return new Promise((resolve, reject) => {
      const run = { resolve, reject, sources: [], end: 0 };
      current = run;
      function begin() {
        if (run.finished || run.started || run.context.state !== 'running') return;
        clearTimeout(run.startTimer);
        try {
          run.started = true;
          run.bus = run.context.createGain();
          run.bus.gain.value = .82;
          run.bus.connect(run.context.destination);
          schedule(run, exercise, mode, options);
        } catch (error) { finish(run, false, error); }
      }
      try {
        // Safari can route Web Audio through the silent switch unless playback is requested.
        const audioSession = root.navigator?.audioSession;
        if (audioSession) {
          try {
            run.sessionType = audioSession.type;
            audioSession.type = 'playback';
          } catch {}
        }
        run.context = openContext();
        if (run.context.state === 'running') begin();
        else {
          run.startTimer = setTimeout(() => {
            if (run.context === context) {
              context = null;
              wave = null;
              run.context.close().catch(() => {});
            }
            finish(run, false, new Error('Tap to restart audio playback.'));
          }, 2200);
          run.context.resume().then(begin, error => finish(run, false, error));
        }
      } catch (error) { finish(run, false, error); }
    });
  }

  function leave() {
    stop();
    const old = context;
    context = null;
    wave = null;
    if (old && old.state !== 'closed') old.close().catch(() => {});
  }

  if (root.document) root.document.addEventListener('visibilitychange', () => {
    if (root.document.hidden) leave();
  });
  if (root.addEventListener) root.addEventListener('pagehide', leave);

  root.Piano = { play, stop };
})(typeof window === 'undefined' ? globalThis : window);
