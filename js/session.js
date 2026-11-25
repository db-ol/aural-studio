(function () {
  'use strict';

  const parts = ['a', 'b', 'c', 'd'];
  const labels = { a: 'A', b: 'B', c: 'C（i）', d: 'C（ii）' };
  const english = { ...labels, c: 'C(i)', d: 'C(ii)' };
  const names = {
    a: ['Melody recall', '旋律记忆'],
    b: ['Sight singing', '六音视唱'],
    c: ['Musical features', '音乐听辨'],
    d: ['Rhythm and metre', '节奏与拍子']
  };

  const paths = {
    play: '<path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
    mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11v1a6 6 0 0 0 12 0v-1m-6 7v3m-4 0h8"/>',
    note: '<path d="M9 17V5l11-2v12M9 8l11-2"/><ellipse cx="6.5" cy="18" rx="3" ry="2"/><ellipse cx="17.5" cy="16" rx="3" ry="2"/>',
    phones: '<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>',
    tap: '<path d="M9 13V7a1.5 1.5 0 0 1 3 0v5-2a1.5 1.5 0 0 1 3 0v2-1a1.5 1.5 0 0 1 3 0v2-1a1.5 1.5 0 0 1 3 0v4c0 3-2 5-5 5h-2c-2 0-3-1-4-2l-5-5a1.5 1.5 0 0 1 2-2l2 1Z"/><path d="M6 8a5 5 0 0 1 7-5"/>',
    back: '<path d="m14 6-6 6 6 6"/>'
  };

  let session = null;
  const t = (en, zh) => window.App.t(en, zh);
  const local = value => value[window.App.lang] || value.en;
  const name = key => t(...names[key]);
  const label = key => (window.App.lang === 'zh' ? labels : english)[key];
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const icon = key => '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths[key] + '</svg>';

  function button(action, title, style = '', symbol = '', disabled = false) {
    return '<button type="button" class="tr-btn ' + style + '" data-do="' + action + '"' + (disabled ? ' disabled' : '') + '>' + (symbol ? icon(symbol) : '') + esc(title) + '</button>';
  }

  function fresh() {
    return { heard: false, plays: 0, active: '', playId: 0, mic: '', self: false, picks: [], taps: [], rhythmDone: false, metre: null, item: null, error: '' };
  }

  function start({ mode = 'practice', key = 'a', set, clef = 'treble' } = {}) {
    stop();
    const actualKey = mode === 'mock' || !parts.includes(key) ? 'a' : key;
    session = { mode, key: actualKey, first: actualKey, set: set || Music.makeSet(), clef, step: fresh(), items: [], takes: {} };
    render();
  }

  function stop() {
    if (session) { stopTake(); session.takes = {}; }
    session = null;
    window.Piano?.stop();
    window.AuralInput?.cancel();
  }

  function instructions(key, ex) {
    if (key === 'a') return t('Listen to the chord and starting note. After two bars of count in, hear the melody twice. Sing or play it back from memory.', '先听主和弦与起音。两小节预备拍后，听两遍旋律，再凭记忆唱出或用乐器奏出。');
    if (key === 'b') return t('Hear the key chord and starting note. Sing the six written notes in order, taking as much time as you need between notes.', '先听主和弦与起音，再按顺序唱出谱上的六个音。每个音之间可以自由停顿。');
    if (key === 'c') return t('Listen for ' + local(ex.questions[0].topic).toLowerCase() + ', then identify the style and period. Think of one detail in the music that supports each answer.', '这次请留意' + local(ex.questions[0].topic) + '，再辨认风格与时期。试着用听到的细节解释两个答案。');
    return t('Listen twice to the melody line from the piece. Tap back the rhythm of its notes, then identify the number of beats in each bar.', '听两遍乐曲中的单声部片段。先按音符的节奏拍回，再判断每小节有几拍。');
  }

  function promptName(key) {
    if (key === 'b') return t('Play starting notes', '播放主和弦与起音');
    if (key === 'c') return t('Play piece', '播放乐曲');
    if (key === 'd') return t('Play extract twice', '播放两遍片段');
    return t('Play melody test', '播放旋律听题');
  }

  function referenceName(ex) {
    const first = Music.noteNames(ex, session.clef)[0];
    return t(local(ex.key) + ' · Starting note ' + first, local(ex.key) + '，起音为 ' + first);
  }

  function player() {
    const { key, step, mode, set, clef } = session;
    const ex = set[key];
    const busy = !!step.mic || step.rhythmDone || (!!step.taps.length && !step.item);
    const maxPlays = key === 'a' ? 2 : key === 'b' ? Infinity : 1;
    const locked = mode === 'mock' && step.plays >= maxPlays;
    const playerButton = step.active
      ? button('stop-sound', t('Stop audio', '停止播放'), 'tr-primary', 'stop')
      : button('prompt', step.heard && !locked ? t('Listen again', '再听一次') : promptName(key), 'tr-primary', 'play', busy || locked || !!step.item);
    let controls = playerButton;
    if (key === 'd' && mode !== 'mock' && !busy && !step.active && !step.item) controls += button('context', t('Hear full piece', '听完整乐曲'));
    let clefs = '';
    if (key === 'b') {
      const selected = item => ' aria-pressed="' + (clef === item) + '"';
      const disabled = step.active || step.mic || step.self || step.item;
      clefs = '<div class="tr-clefs" role="group" aria-label="' + t('Clef', '谱号') + '">' +
        ['treble', 'bass'].map(item => '<button type="button" data-do="clef-' + item + '"' + selected(item) + (disabled ? ' disabled' : '') + '>' + (item === 'treble' ? t('Treble clef', '高音谱号') : t('Bass clef', '低音谱号')) + '</button>').join('') + '</div>';
    }
    const detail = key === 'a' || key === 'b' ? referenceName(ex) :
      key === 'c' ? t('Piano excerpt', '钢琴乐曲片段') : t('Unaccompanied melody', '单声部旋律');
    return '<section class="tr-player"><div class="tr-source"><span class="tr-source-icon">' + icon(key === 'b' ? 'note' : 'phones') +
      '</span><div><strong>' + esc(detail) + '</strong><span aria-live="polite">' +
      (step.active ? t('Playing…', '正在播放……') : step.heard ? t('Listening complete', '已完成聆听') : t('Ready to listen', '准备聆听')) +
      '</span></div></div>' + clefs +
      (key === 'b' ? '<div class="tr-score">' + Music.score(ex, clef, window.App.lang) + '</div>' : '') +
      '<div class="tr-actions">' + controls + '</div>' +
      (key === 'b' && mode === 'practice' && step.heard && !step.item && !step.mic ? noteHelp() : '') + '</section>';
  }

  function noteHelp() {
    const { step, set, clef } = session;
    return '<div class="tr-note-help"><button type="button" class="tr-help-toggle" data-do="help" aria-expanded="' + !!step.help + '">' +
      t('Check individual notes', '逐音核对') + '</button>' + (step.help ? '<div class="tr-note-buttons">' +
      Music.noteNames(set.b, clef).map((note, i) => button('note-' + i, t('Note ' + (i + 1) + ' · ' + note, '第 ' + (i + 1) + ' 音，' + note))).join('') +
      '</div>' : '') + '</div>';
  }

  function section(title, body) {
    return '<section class="tr-response"><h2>' + esc(title) + '</h2>' + body + '</section>';
  }

  function singing() {
    const { step, key } = session;
    if (step.self) {
      return section(t('Compare your answer', '对照自己的演唱'), '<p>' +
        t('Play the example and compare the pitches in order. For melody recall, also compare the rhythm. Choose how close your performance was.', '播放示范，逐音比较自己的音高。旋律记忆还要比较节奏。请选择最符合本次表现的一项。') +
        '</p><div class="tr-actions">' + button(step.active ? 'stop-sound' : 'model', step.active ? t('Stop audio', '停止播放') : t('Play example', '播放示范'), '', step.active ? 'stop' : 'play') +
        '</div><div class="tr-choices">' +
        [t('Needs more practice', '还需多练'), t('Mostly accurate', '大部分准确'), t('Accurate throughout', '全程准确')].map((value, i) => button('rate-' + i, value, 'tr-choice')).join('') + '</div>');
    }
    if (step.mic) {
      const waiting = step.mic === 'waiting';
      return section(waiting ? t('Opening microphone', '正在开启麦克风') : t('Your microphone is listening', '麦克风正在听你的演唱'),
        '<p role="status">' + (waiting ? t('Allow microphone access in your browser to begin.', '请在浏览器中允许使用麦克风。') : t('Sing each note on a separate syllable. Finish when you reach the end.', '每个音用一个独立的音节演唱，唱完后点下方按钮。')) +
        '</p><div class="tr-actions">' + (waiting ? '' : button('finish-mic', t('Finish singing', '完成演唱'), 'tr-primary', 'stop')) +
        button('cancel-mic', t('Cancel', '取消')) + '</div>');
    }
    const hasMic = window.AuralInput.supported();
    const perform = key === 'a' ? t('Sing or play the melody aloud', '请先唱出或奏出旋律') : t('Sing the six notes aloud', '请先唱出六个音');
    return section(t('Your turn', '轮到你了'), '<p>' +
      perform + (hasMic ? t('. Use the microphone for pitch feedback, or compare by ear afterwards.', '。可以使用麦克风查看逐音反馈，也可以完成后听示范自行对照。') :
        t(', then compare with the example. Microphone feedback is available in supported browsers on HTTPS or localhost.', '，再与示范对照。通过 HTTPS 或 localhost 打开网站时，支持的浏览器还可以使用麦克风。')) +
      '</p><div class="tr-actions">' +
      (hasMic ? button('mic', t('Sing with microphone', '用麦克风演唱'), 'tr-primary', 'mic', !!step.active) : '') +
      button('self', key === 'a' ? t('I performed aloud', '我已唱完或奏完') : t('I sang the six notes', '我已唱完六个音'), hasMic ? '' : 'tr-primary', '', !!step.active) + '</div>');
  }

  function musicalChoices() {
    const { set, step } = session;
    const questions = set.c.questions;
    const choices = questions.map((question, qi) => '<fieldset class="tr-question"><legend>' + esc(local(question.prompt)) + '</legend>' +
      question.options.map((option, oi) => '<label class="tr-option"><input type="radio" name="feature' + qi + '" data-q="' + qi + '" value="' + oi + '"' +
        (step.picks[qi] === oi ? ' checked' : '') + '><span>' + esc(local(option)) + '</span></label>').join('') +
      '</fieldset>').join('');
    return section(t('What did you hear?', '你听到了什么？'), choices + button('check-c', t('Check answers', '提交答案'), 'tr-primary', '', step.active || !questions.every((_, i) => Number.isInteger(step.picks[i]))));
  }

  function rhythmPane() {
    const { step } = session;
    if (step.mic) {
      const waiting = step.mic === 'waiting';
      return section(waiting ? t('Opening microphone', '正在开启麦克风') : t('Clap into the microphone', '对着麦克风拍手'),
        '<p role="status">' + (waiting ? t('Allow microphone access in your browser.', '请在浏览器中允许使用麦克风。') :
          t('Clap each note once in a quiet space. Watch the count to see which claps were heard.', '在安静处拍出各个音的节奏。观察下方计数，确认麦克风听到了拍手声。')) +
        '</p>' + (waiting ? '' : '<div class="tr-clap-count" id="tr-claps">' + clapCount() + '</div>') +
        '<div class="tr-actions">' + (waiting ? '' : button('finish-mic', t('Finish clapping', '完成拍手'), 'tr-primary', 'stop')) +
        button('cancel-mic', t('Cancel', '取消')) + '</div>');
    }
    if (step.rhythmDone) {
      return section(t('How many beats are in a bar?', '每小节有几拍？'), '<div class="tr-choices">' +
        [2, 3, 4].map(n => button('metre-' + n, t(n + ' beats', n + ' 拍'), 'tr-choice')).join('') + '</div>');
    }
    return section(t('Tap the rhythm', '拍回节奏'), '<p>' +
      t('Tap once for each note, keeping the spacing you heard. The first tap starts your answer. On a keyboard, focus the pad and use Space.', '听清音符间隔，每个音在拍击区点一下。第一下开始计时。使用键盘时，先聚焦拍击区，再按空格键。') +
      '</p><button class="tr-pad" data-do="tap" type="button"' + (step.active ? ' disabled' : '') + '>' + icon('tap') + '<strong>' +
      t('Tap here', '点此拍击') + '</strong><span id="tr-tap-count">' + tapCount() + '</span></button><div class="tr-actions">' +
      button('finish-taps', t('Finish rhythm', '完成节奏'), 'tr-primary', '', step.taps.length < 2) +
      button('reset-taps', t('Clear taps', '重新拍击'), '', '', !step.taps.length) +
      (AuralInput.supported() && !step.taps.length ? button('mic', t('Clap with microphone', '用麦克风拍手'), '', 'mic', !!step.active) : '') + '</div>');
  }

  function clapCount() {
    const n = session.step.taps.length;
    return t(n + (n === 1 ? ' clap heard' : ' claps heard'), '已听到 ' + n + ' 次拍手');
  }

  function tapCount() {
    const n = session.step.taps.length;
    return t(n + (n === 1 ? ' tap' : ' taps'), '已拍 ' + n + ' 下');
  }

  const markWords = {
    ok: ['On pitch', '准确'], high: ['High', '偏高'], low: ['Low', '偏低'], missed: ['Missed', '漏音']
  };

  function pitchDetails(item) {
    if (item.method === 'self') return '<p>' + t('Your own assessment is recorded as a practice rating.', '本次已记为自评练习。') + '</p>';
    return '<p>' + t(item.correct + ' of ' + item.marks.length + ' target notes matched.', '目标音共 ' + item.marks.length + ' 个，唱准了 ' + item.correct + ' 个。') +
      (item.rhythmScore === null ? '' : ' ' + t('Rhythm match ' + item.rhythmScore + '%.', '节奏吻合度为 ' + item.rhythmScore + '％。')) +
      '</p><ol class="tr-marks">' + item.marks.map((mark, i) => '<li class="' + (mark === 'ok' ? 'tr-correct' : 'tr-review') + '"><b>' +
      (i + 1) + '</b> ' + t(...markWords[mark]) + '</li>').join('') + '</ol>';
  }

  function questionDetails(ex, picks) {
    return ex.questions.map((question, index) => '<div class="tr-evidence"><strong>' +
      (picks[index] === question.answer ? '✓ ' : '') + esc(local(question.options[question.answer])) +
      '</strong><p>' + esc(local(question.evidence)) + '</p></div>').join('');
  }

  function recordingButton(key) {
    if (!session.takes[key]) return '';
    const playing = session.step.active === 'take-' + key;
    return button(playing ? 'stop-sound' : 'take-' + key,
      playing ? t('Stop your recording', '停止回听') : t('Play your recording', '回听自己的录音'), '', playing ? 'stop' : 'mic');
  }

  function mockFeedback() {
    const { key, step, items, set } = session;
    if (key !== 'd') {
      const next = label(parts[parts.indexOf(key) + 1]);
      return '<section class="tr-feedback"><h2>' + t('Answer recorded', '已记录作答') + '</h2><p>' +
        t('Feedback will appear after the last task.', '完成最后一项后，将一起显示反馈。') + '</p><div class="tr-actions">' +
        button('next', t('Continue to test ' + next, '进入 ' + next + ' 项'), 'tr-primary') + '</div></section>';
    }
    const notes = [...items, step.item].map(item => {
      const part = item.key;
      let detail;
      if (part === 'a' || part === 'b') detail = pitchDetails(item);
      else if (part === 'c') detail = questionDetails(set.c, item.choices);
      else detail = rhythmDetails();
      return '<div class="tr-review-part"><h3>' + esc(label(part) + '　' + name(part)) + '</h3><p class="tr-review-score">' +
        (item.method === 'self' ? t('Self rating ', '自评 ') : t('Practice score ', '练习得分 ')) +
        item.score + t('%', '％') + '</p>' + detail + '<div class="tr-actions">' + button('review-' + part, t('Play example', '播放示范'), '', 'play') + recordingButton(part) + '</div></div>';
    }).join('');
    return '<section class="tr-feedback"><h2>' + t('Your mock test review', '模拟考试反馈') + '</h2>' + notes +
      '<div class="tr-actions">' + button('next', t('Finish session', '完成本次练习'), 'tr-primary') +
      (step.active ? button('stop-sound', t('Stop audio', '停止播放'), '', 'stop') : '') + '</div></section>';
  }

  function rhythmDetails() {
    const { step, set } = session;
    const item = step.item;
    return '<p>' + t('Rhythm match ' + item.rhythmScore + '%. Expected ' + set.d.notes.length + ' onsets and detected ' + step.taps.length + '.', '节奏吻合度为 ' + item.rhythmScore + '％。本题有 ' + set.d.notes.length + ' 个起音，记录到 ' + step.taps.length + ' 下。') +
      '</p><p>' + t('You chose ' + step.metre + ' beats per bar. The piece has ' + set.d.metre + ' beats per bar.', '你选择了每小节 ' + step.metre + ' 拍，本曲为每小节 ' + set.d.metre + ' 拍。') + '</p>';
  }

  function feedback() {
    if (session.mode === 'mock') return mockFeedback();
    const { key, step, set } = session;
    const item = step.item;
    const ex = set[key];
    let body = '';
    if (key === 'a' || key === 'b') body = pitchDetails(item);
    else if (key === 'c') body = questionDetails(ex, step.picks);
    else body = rhythmDetails();
    const next = t('Finish session', '完成本次练习');
    const modelPlaying = step.active === 'model';
    return '<section class="tr-feedback"><div class="tr-feedback-head"><h2>' + t('Your feedback', '练习反馈') + '</h2><span>' +
      (item.method === 'self' ? t('Self rating', '自评') : t('Practice score', '练习得分')) + '　<b>' + item.score + (window.App.lang === 'zh' ? '％' : '%') + '</b></span></div>' + body + (key === 'b' ? noteHelp() : '') +
      '<div class="tr-actions">' + button('next', next, 'tr-primary') + button(modelPlaying ? 'stop-sound' : 'model', modelPlaying ? t('Stop audio', '停止播放') : t('Replay example', '重听示范'), '', modelPlaying ? 'stop' : 'play') +
      recordingButton(key) + button('retry', t('Retry this exercise', '重试本题')) + '</div></section>';
  }

  function render() {
    if (!session) return;
    const { key, set, mode, step } = session;
    const area = document.getElementById('workspace');
    const part = label(key);
    const focus = area.querySelector('.tr-session')?.contains(document.activeElement) ? document.activeElement : null;
    const focusAction = focus?.dataset.do;
    const focusQ = focus?.dataset.q;
    const focusValue = focus?.value;
    const status = mode === 'mock' ? t('Mock test', '模拟考试') : t('Focused practice', '专项练习');
    const meter = mode === 'mock' ? '<ol class="tr-progress" aria-label="' + t('Exam progress', '考试进度') + '">' +
      parts.map((p, i) => '<li ' + (p === key ? 'aria-current="step"' : '') + ' class="' + (i <= parts.indexOf(key) ? 'tr-done' : '') + '"><span>' + label(p) + '</span></li>').join('') + '</ol>' : '';
    area.innerHTML = '<article class="tr-session"><div class="tr-top">' +
      button('exit', t('Practice room', '练习室'), 'tr-link', 'back') + '<span>' + status + '</span></div>' + meter +
      '<header class="tr-head"><span class="tr-part">' + t('Test ' + part, part + ' 项') + '</span><h1>' +
      esc(name(key)) + '</h1><p>' + esc(instructions(key, set[key])) + '</p></header>' + player() +
      (step.error ? '<p class="tr-error" role="alert">' + esc(t(...step.error)) + '</p>' : '') +
      (step.item ? feedback() : step.heard ? (key === 'c' ? musicalChoices() : key === 'd' ? rhythmPane() : singing()) : '') + '</article>';
    const el = area.querySelector('.tr-session');
    el.onclick = click;
    el.onchange = change;
    el.onpointerdown = event => {
      if (event.button !== 0) return;
      const pad = event.target.closest('[data-do="tap"]');
      if (pad && !pad.disabled) { event.preventDefault(); pad.focus({ preventScroll: true }); tap(); }
    };
    el.onkeydown = event => {
      if (event.target.dataset.do === 'tap' && (event.code === 'Space' || event.key === 'Enter')) {
        event.preventDefault();
        if (!event.repeat) tap();
      }
    };
    if (focusAction) el.querySelector('[data-do="' + focusAction + '"]:not(:disabled)')?.focus({ preventScroll: true });
    else if (focusQ !== undefined) el.querySelector('input[data-q="' + focusQ + '"][value="' + focusValue + '"]')?.focus({ preventScroll: true });
  }

  function change(event) {
    if (!session || event.target.dataset.q === undefined) return;
    session.step.picks[Number(event.target.dataset.q)] = Number(event.target.value);
    const check = document.querySelector('.tr-session [data-do="check-c"]');
    check.disabled = !!session.step.active || !session.set.c.questions.every((_, i) => Number.isInteger(session.step.picks[i]));
  }

  function tap() {
    if (!session || session.key !== 'd') return;
    const { step } = session;
    if (!step.heard || step.active || step.rhythmDone || step.taps.length >= 128) return;
    step.taps.push(performance.now() / 1000);
    const el = document.querySelector('.tr-session');
    el.querySelector('#tr-tap-count').textContent = tapCount();
    el.querySelector('[data-do="finish-taps"]').disabled = step.taps.length < 2;
    el.querySelector('[data-do="reset-taps"]').disabled = false;
    ['prompt', 'context', 'mic'].forEach(action => { const button = el.querySelector('[data-do="' + action + '"]'); if (button) button.disabled = true; });
    const pad = el.querySelector('.tr-pad');
    pad.classList.remove('tr-beat');
    void pad.offsetWidth;
    pad.classList.add('tr-beat');
  }

  function stopTake() {
    const active = session.player;
    if (!active) return;
    active.audio.onended = active.audio.onerror = null;
    active.audio.pause();
    active.audio.removeAttribute('src');
    active.audio.load();
    URL.revokeObjectURL(active.url);
    session.player = null;
  }

  function quiet() {
    stopTake();
    session.step.playId++;
    session.step.active = '';
    Piano.stop();
  }

  function playTake(part) {
    const here = session;
    const blob = here.takes[part];
    if (!blob || !here.step.item || (here.mode === 'mock' && here.key !== 'd')) return;
    quiet();
    const audio = new Audio();
    const url = URL.createObjectURL(blob);
    audio.src = url;
    here.player = { audio, url };
    here.step.active = 'take-' + part;
    here.step.error = '';
    const finish = failed => {
      if (session !== here || here.player?.audio !== audio) return;
      quiet();
      if (failed) here.step.error = ['Your recording could not play. Try again or listen to the piano example.', '录音未能播放，请重试或聆听钢琴示范。'];
      render();
    };
    audio.onended = () => finish(false);
    audio.onerror = () => finish(true);
    try { audio.play().catch(() => finish(true)); } catch { finish(true); }
    render();
  }

  async function play(action, index, part) {
    const here = session;
    const { key, set, step, clef } = here;
    quiet();
    const id = step.playId;
    step.active = action;
    step.error = '';
    render();
    try {
      const extraHearing = action === 'prompt' && key === 'a' && here.mode === 'mock' && step.plays === 1;
      const playbackMode = extraHearing ? 'model' : action === 'context' ? 'prompt' : action;
      const complete = await Piano.play(action === 'context' ? set.c : set[part || key], playbackMode, { clef, index });
      if (session !== here || here.step !== step || step.playId !== id) return;
      if (action === 'prompt' && complete) { step.heard = true; step.plays++; }
      if (!complete) step.error = ['Audio was interrupted. Tap play to listen again.', '播放已中断，请重新点按播放。'];
    } catch {
      if (session !== here || here.step !== step || step.playId !== id) return;
      step.error = ['Audio could not start. Check your output device and tap play again.', '声音未能启动，请检查输出设备后重新点按播放。'];
    }
    step.active = '';
    render();
  }

  function saveItem(result) {
    quiet();
    session.step.item = { key: session.key, ...result };
    session.step.error = '';
    render();
    document.querySelector('.tr-feedback')?.scrollIntoView({ block: 'nearest' });
  }

  function endMic() {
    if (!session || session.step.mic !== 'recording') return;
    const here = session;
    const { key, set, clef, step } = here;
    const ticket = step.recording;
    const notes = AuralInput.finish(blob => {
      if (session !== here || step.recording !== ticket || !blob.size || !window.URL?.createObjectURL || !window.Audio) return;
      if (step.item?.method !== 'auto' && !step.rhythmDone) return;
      if (here.step !== step && !here.items.includes(step.item)) return;
      here.takes[key] = blob;
      if (here.step.item && (here.mode !== 'mock' || here.key === 'd')) render();
    });
    step.mic = '';
    if (key === 'd') {
      if (step.taps.length >= 2) step.rhythmDone = true;
      else {
        step.taps = [];
        step.error = ['Fewer than two claps were heard. Try the microphone again or use the tap pad.', '听到的拍手声不足两次。请重试麦克风，或改用拍击区。'];
      }
      render();
      return;
    }
    const item = AuralInput.assessPitch(Music.pitches(set[key], clef), key === 'a' ? Music.onsets(set.a) : null, notes);
    if (item) saveItem({ ...item, method: 'auto' });
    else {
      step.error = ['No stable pitches were heard. Try again closer to the microphone, or perform aloud and use self rating.', '没有听到稳定音高。请靠近麦克风重试，也可以唱完后自行对照。'];
      render();
    }
  }

  async function record() {
    const here = session;
    const step = here.step;
    const ticket = {};
    step.recording = ticket;
    step.mic = 'waiting';
    step.error = '';
    render();
    try {
      const hearClap = time => {
        if (session !== here || step.recording !== ticket || step.taps.length >= 128) return;
        step.taps.push(time);
        const counter = document.getElementById('tr-claps');
        if (counter) counter.textContent = clapCount();
      };
      await AuralInput.record(endMic, here.key === 'd' ? hearClap : null);
      if (session !== here || here.step !== step || step.recording !== ticket) return;
      step.mic = 'recording';
    } catch {
      if (session !== here || here.step !== step || step.recording !== ticket) return;
      step.mic = '';
      step.error = here.key === 'd'
        ? ['The microphone could not start. Check browser permissions or use the tap pad.', '麦克风未能启动。请检查浏览器权限，或改用拍击区。']
        : ['The microphone could not start. Check browser permissions, or perform aloud and choose self rating.', '麦克风未能启动。请检查浏览器权限，也可以直接演唱后自行对照。'];
    }
    render();
  }

  function click(event) {
    const control = event.target.closest('[data-do]');
    if (!session || !control || control.disabled) return;
    const action = control.dataset.do;
    const { step, key, set, mode } = session;
    if (action === 'exit') { stop(); window.App.exit(); return; }
    if (action === 'stop-sound') { quiet(); render(); return; }
    if (['prompt', 'context', 'model'].includes(action)) { play(action); return; }
    if (action.startsWith('take-')) { playTake(action.slice(5)); return; }
    if (action.startsWith('review-')) { play('model', undefined, action.slice(7)); return; }
    if (action === 'help') { step.help = !step.help; render(); return; }
    if (action.startsWith('note-')) { play('note', Number(action.slice(5))); return; }
    if (action.startsWith('clef-')) {
      const clef = action.slice(5);
      if (session.clef === clef) return;
      session.clef = clef;
      session.step = fresh();
    } else if (action === 'mic') { record(); return; }
    else if (action === 'finish-mic') { endMic(); return; }
    else if (action === 'cancel-mic') { step.recording = null; step.mic = ''; if (key === 'd') step.taps = []; AuralInput.cancel(); }
    else if (action === 'self') { step.self = true; step.error = ''; }
    else if (action.startsWith('rate-')) { saveItem({ score: [25, 70, 100][Number(action.slice(5))], method: 'self' }); return; }
    else if (action === 'check-c') {
      const correct = set.c.questions.filter((q, i) => q.answer === step.picks[i]).length;
      saveItem({ score: Math.round(correct * 100 / set.c.questions.length), method: 'auto', choices: step.picks.slice() }); return;
    } else if (action === 'tap') {
      if (!window.PointerEvent || event.detail === 0) tap();
      return;
    } else if (action === 'reset-taps') { step.taps = []; }
    else if (action === 'finish-taps') { step.rhythmDone = true; }
    else if (action.startsWith('metre-')) {
      step.metre = Number(action.slice(6));
      const rhythmScore = AuralInput.rhythm(Music.onsets(set.d), step.taps);
      const metreScore = step.metre === set.d.metre ? 100 : 0;
      saveItem({ score: Math.round((rhythmScore + metreScore) / 2), rhythmScore, metreScore, chosenMetre: step.metre, tapCount: step.taps.length, method: 'auto' }); return;
    } else if (action === 'retry') { quiet(); delete session.takes[key]; session.step = fresh(); }
    else if (action === 'next') {
      quiet();
      session.items.push(step.item);
      if (mode === 'practice' || key === 'd') {
        const result = { mode, key: session.first, items: session.items.slice(), recipe: session.set.recipe, clef: session.clef };
        stop();
        window.App.complete(result);
        return;
      }
      session.key = parts[parts.indexOf(key) + 1];
      session.step = fresh();
    }
    render();
    if (action === 'next' || action === 'retry') document.querySelector('.tr-top')?.scrollIntoView({ block: 'start' });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !session) return;
    const step = session.step;
    if (step.mic) {
      AuralInput.cancel();
      step.recording = null;
      step.mic = '';
      if (session.key === 'd') step.taps = [];
      step.error = ['Recording paused when you left the page. Start again when you are ready.', '切换页面后，录音已停止。准备好后请重试。'];
      render();
    }
    if (step.active) { quiet(); render(); }
  });
  window.Trainer = { start, stop, refresh: render };
})();
