(function (root) {
  'use strict';

  function median(values) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function detectPitch(samples, sampleRate) {
    // Average to roughly 12 kHz before estimating the period of a single sung note.
    const stride = Math.max(1, Math.floor(sampleRate / 12000));
    const data = new Float32Array(Math.floor(samples.length / stride));
    let energy = 0;
    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < stride; j++) sum += samples[i * stride + j];
      data[i] = sum / stride;
      energy += data[i] * data[i];
    }
    if (Math.sqrt(energy / data.length) < 0.006) return null;
    const rate = sampleRate / stride;
    const maxLag = Math.min(Math.floor(rate / 68), Math.floor(data.length / 2));
    const windowLength = data.length - maxLag;
    const differences = new Float32Array(maxLag + 1);
    let cumulative = 0;
    for (let lag = 1; lag <= maxLag; lag++) {
      let diff = 0;
      for (let i = 0; i < windowLength; i++) {
        const delta = data[i] - data[i + lag];
        diff += delta * delta;
      }
      cumulative += diff;
      differences[lag] = cumulative > 0 ? diff * lag / cumulative : 1;
    }
    for (let lag = Math.max(2, Math.floor(rate / 1100)); lag < maxLag - 1; lag++) {
      if (differences[lag] > 0.16) continue;
      while (lag + 1 < maxLag && differences[lag + 1] < differences[lag]) lag++;
      const before = differences[lag - 1];
      const current = differences[lag];
      const after = differences[lag + 1];
      const denominator = 2 * (2 * current - after - before);
      const offset = denominator ? (after - before) / denominator : 0;
      return 69 + 12 * Math.log2(rate / (lag + offset) / 440);
    }
    return null;
  }

  function clapDetector() {
    let noise = 0.004;
    let previous = 0;
    let peak = 0;
    let armed = true;
    let last = -Infinity;
    return (level, time) => {
      const threshold = Math.max(0.015, noise * 3.7);
      const attack = level > previous * 1.5 + 0.006;
      const onset = armed && time - last > 0.10 && level > threshold && attack;
      if (onset) {
        last = time;
        armed = false;
        peak = level;
      } else if (!armed) {
        peak = Math.max(peak, level);
        if (level < Math.max(threshold * 0.85, peak * 0.16)) armed = true;
      }
      if (time - last > 0.14) noise += 0.025 * (Math.min(level, noise * 2.5) - noise);
      previous = level;
      return onset;
    };
  }

  function notesFromFrames(frames) {
    const groups = [];
    let group = null;
    for (const frame of frames) {
      if (!Number.isFinite(frame.pitch)) continue;
      if (!group || frame.time - group.end > 0.13 || Math.abs(frame.pitch - group.center) > 0.78) {
        group = { time: frame.time, end: frame.time, center: frame.pitch, pitches: [] };
        groups.push(group);
      }
      group.pitches.push(frame.pitch);
      group.end = frame.time;
      group.center = median(group.pitches.slice(-5));
    }
    return groups.filter(group => group.end - group.time >= 0.078)
      .map(group => ({ pitch: median(group.pitches), time: group.time }));
  }

  function rhythm(expected, actual) {
    if (expected.length < 2 || actual.length < 2) return 0;
    const count = Math.min(expected.length, actual.length) - 1;
    const targets = Array.from({ length: count }, (_, i) => expected[i + 1] - expected[i]);
    const intervals = targets.map((_, i) => actual[i + 1] - actual[i]);
    const ratios = intervals.map((duration, i) => duration / targets[i]);
    const pace = median(ratios);
    if (!(pace > 0)) return 0;
    // A consistent, moderate change of tempo preserves the rhythm.
    const paceCredit = Math.min(1, pace / 0.66, 1.5 / pace);
    const accuracy = targets.reduce((total, duration, i) => {
      const error = Math.abs(intervals[i] - duration * pace);
      const tolerance = Math.max(0.055, duration * pace * 0.12);
      return total + Math.max(0, 1 - Math.max(0, error - tolerance) / (duration * pace * 0.50));
    }, 0) / count;
    const countCredit = count / (Math.max(expected.length, actual.length) - 1);
    return Math.round(100 * accuracy * countCredit * paceCredit);
  }

  function align(expected, actual, octave) {
    const rows = expected.length + 1;
    const cols = actual.length + 1;
    const costs = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => i + j));
    const previous = Array.from({ length: rows }, () => []);
    for (let i = 1; i < rows; i++) {
      for (let j = 1; j < cols; j++) {
        const miss = Math.abs(actual[j - 1].pitch - octave - expected[i - 1]);
        const diagonal = costs[i - 1][j - 1] + (miss <= 0.5 ? miss * 0.3 : Math.min(1.5, 0.75 + miss * 0.15));
        const choices = [diagonal, costs[i - 1][j] + 1, costs[i][j - 1] + 1];
        costs[i][j] = Math.min(...choices);
        previous[i][j] = choices.indexOf(costs[i][j]);
      }
    }
    const matches = Array(expected.length).fill(null);
    let i = expected.length;
    let j = actual.length;
    while (i && j) {
      const direction = previous[i][j];
      if (direction === 0) matches[--i] = --j;
      else if (direction === 1) i--;
      else j--;
    }
    return { cost: costs[rows - 1][cols - 1], matches, octave };
  }

  function assessPitch(expected, onsets, actual, accompanied = false) {
    if (!actual.length) return null;
    const best = [0, -12, 12, -24, 24].map(octave => align(expected, actual, octave))
      .reduce((a, b) => a.cost <= b.cost ? a : b);
    const marks = best.matches.map((index, i) => {
      if (index === null) return 'missed';
      const cents = Math.round(actual[index].pitch * 100) - (best.octave + expected[i]) * 100;
      if (Math.abs(cents) <= 50) return 'ok';
      return cents < 0 ? 'low' : 'high';
    });
    const correct = marks.filter(mark => mark === 'ok').length;
    const pitchScore = Math.round(correct * 100 / Math.max(actual.length, expected.length));
    let rhythmScore = onsets ? rhythm(onsets, actual.map(note => note.time)) : null;
    if (accompanied && onsets) {
      // The accompaniment fixes the pulse. Allow a little time for vocal attack and device latency.
      const total = best.matches.reduce((sum, j, i) => {
        if (j === null) return sum;
        const error = Math.abs(actual[j].time - onsets[i]);
        return sum + Math.max(0, 1 - Math.max(0, error - 0.17) / 0.38);
      }, 0);
      rhythmScore = Math.round(100 * total / Math.max(expected.length, actual.length));
    }
    const heardPitches = best.matches.map(i => i === null ? null : Number(actual[i].pitch.toFixed(2)));
    const extraCount = actual.length - best.matches.filter(i => i !== null).length;
    return { marks, correct, heardPitches, octave: best.octave, extraCount, pitchScore, rhythmScore,
      score: rhythmScore === null ? pitchScore : Math.round(0.75 * pitchScore + 0.25 * rhythmScore) };
  }

  let current = null;

  function supported() {
    return !!(root.navigator?.mediaDevices?.getUserMedia && (root.AudioContext || root.webkitAudioContext));
  }

  function enableReplay(recording) {
    if (!root.MediaRecorder) return;
    try {
      const recorder = new root.MediaRecorder(recording.stream);
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        if (recording.onTake && chunks.length) {
          recording.onTake(new Blob(chunks, { type: recorder.mimeType || chunks[0].type }));
        }
        chunks.length = 0;
        recording.onTake = null;
      };
      recorder.start();
      recording.recorder = recorder;
    } catch { /* Pitch and rhythm analysis work independently of recording support. */ }
  }

  function cleanup(recording, onTake) {
    if (!recording) return;
    clearInterval(recording.timer);
    if (recording.recorder) {
      const recorder = recording.recorder;
      recording.onTake = onTake;
      if (!onTake) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
      }
      if (recorder.state !== 'inactive') {
        try { recorder.stop(); } catch {}
      }
      recording.recorder = null;
    }
    recording.stream?.getTracks().forEach(track => track.stop());
    recording.source?.disconnect();
    recording.analyser?.disconnect();
    recording.silent?.disconnect();
    if (recording.context && recording.context.state !== 'closed') recording.context.close().catch(() => {});
    if (current === recording) {
      if (recording.sessionType !== undefined) {
        try { root.navigator.audioSession.type = recording.sessionType; } catch {}
      }
      current = null;
    }
  }

  function cancel() {
    cleanup(current);
  }

  function startVoiceIn(delay) {
    if (current) current.voiceStart = performance.now() + delay * 1000;
  }

  async function record(onEnd, onClap, waitForCue = false) {
    cancel();
    if (!supported()) throw new Error('unavailable');
    const session = { frames: [] };
    current = session;
    try {
      const AudioContext = root.AudioContext || root.webkitAudioContext;
      if (root.navigator.audioSession) {
        try {
          session.sessionType = root.navigator.audioSession.type;
          root.navigator.audioSession.type = 'play-and-record';
        } catch {}
      }
      session.context = new AudioContext();
      const resumed = session.context.resume().catch(() => {});
      const stream = await root.navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      if (session !== current) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('cancelled');
      }
      session.stream = stream;
      await Promise.race([resumed, new Promise(resolve => setTimeout(resolve, 900))]);
      if (session !== current) throw new Error('cancelled');
      if (session.context.state !== 'running' || !stream.getAudioTracks().some(track => track.readyState === 'live')) throw new Error('suspended');
      session.source = session.context.createMediaStreamSource(stream);
      session.analyser = session.context.createAnalyser();
      session.analyser.fftSize = 2048;
      session.silent = session.context.createGain();
      session.silent.gain.value = 0;
      session.source.connect(session.analyser);
      session.analyser.connect(session.silent);
      session.silent.connect(session.context.destination);
      enableReplay(session);
      const samples = new Float32Array(session.analyser.fftSize);
      const start = performance.now();
      session.voiceStart = waitForCue ? Infinity : start;
      const ended = () => { if (current === session) onEnd(); };
      stream.getTracks().forEach(track => track.addEventListener('ended', ended));
      const detectClap = clapDetector();
      const rate = session.context.sampleRate;
      const startClock = session.context.currentTime;
      const slice = Math.round(rate * 0.006);
      let seenUntil = 0;
      session.timer = setInterval(() => {
        const time = (performance.now() - start) / 1000;
        if (time >= 40 || session.context.state !== 'running') return ended();
        session.analyser.getFloatTimeDomainData(samples);
        if (!onClap) {
          const voiceTime = (performance.now() - session.voiceStart) / 1000;
          if (voiceTime >= 0) session.frames.push({ time: voiceTime, pitch: detectPitch(samples, rate) });
          return;
        }
        const end = session.context.currentTime - startClock;
        const begin = end - samples.length / rate;
        let i = Math.max(0, Math.round((seenUntil - begin) * rate));
        for (; i + slice <= samples.length; i += slice) {
          let sum = 0;
          for (let j = i; j < i + slice; j++) sum += samples[j] * samples[j];
          const onset = begin + i / rate;
          if (detectClap(Math.sqrt(sum / slice), onset)) onClap(onset);
        }
        seenUntil = begin + i / rate;
      }, onClap ? 20 : 36);
    } catch (error) {
      cleanup(session);
      throw error;
    }
  }

  function finish(onTake) {
    const frames = current?.frames || [];
    cleanup(current, onTake);
    return notesFromFrames(frames);
  }

  root.AuralInput = { record, finish, cancel, supported, startVoiceIn, assessPitch, rhythm, notesFromFrames, detectPitch, clapDetector };
})(typeof window === 'undefined' ? globalThis : window);
