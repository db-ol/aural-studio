(function () {
  'use strict';

  function skill(key) {
    return window.Curriculum.skill(session.grade, key);
  }

  function lastPart() {
    return session.parts[session.parts.length - 1];
  }

  function accompanied() {
    return session.key === 'b' && session.grade > 5;
  }

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
  const name = key => t(...skill(key).title);
  const label = key => window.App.lang === 'zh' ? skill(key).part.replace('(', '（').replace(')', '）') : skill(key).part;
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const icon = key => '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths[key] + '</svg>';

  function button(action, title, style = '', symbol = '', disabled = false) {
    return '<button type="button" class="tr-btn ' + style + '" data-do="' + action + '"' + (disabled ? ' disabled' : '') + '>' + (symbol ? icon(symbol) : '') + esc(title) + '</button>';
  }

  function fresh() {
    return { heard: false, plays: 0, active: '', playId: 0, mic: '', self: false, picks: [], taps: [], rhythmDone: false, metre: null, item: null, error: '' };
  }

  function start({ mode = 'practice', key = 'a', set, grade = 5, clef = 'treble' } = {}) {
    stop();
    const exercises = set || Music.makeSet(undefined, grade);
    grade = exercises.grade || grade;
    const parts = window.Curriculum.parts(grade);
    const actualKey = mode === 'mock' || !parts.includes(key) ? parts[0] : key;
    session = { mode, grade, parts, key: actualKey, first: actualKey, set: exercises, clef, step: fresh(), items: [], takes: {} };
    render();
  }

  function stop() {
    if (session) { clearTimeout(session.step.cueTimer); stopTake(); session.takes = {}; }
    session = null;
    window.Piano?.stop();
    window.AuralInput?.cancel();
  }

  function instructions(key, ex) {
    if (session.grade > 5) {
      if (key === 'c') return t('Listen for ' + ex.questions.map(q => local(q.topic).toLowerCase()).join(' and ') + '. Find evidence for both in the piece.', '聆听时关注' + ex.questions.map(q => local(q.topic)).join('和') + '，找出支持两个答案的音乐线索。');
      return t(...skill(key).summary);
    }
    if (key === 'a') return t('Listen to the chord and starting note. After two bars of count in, hear the melody twice. Sing or play it back from memory.', '先听主和弦与起音。两小节预备拍后，听两遍旋律，再凭记忆唱出或用乐器奏出。');
    if (key === 'b') return t('Hear the key chord and starting note. Sing the six written notes in order, taking as much time as you need between notes.', '先听主和弦与起音，再按顺序唱出谱上的六个音。每个音之间可以自由停顿。');
    if (key === 'c') return t('Listen for ' + local(ex.questions[0].topic).toLowerCase() + ', then identify the style and period. Think of one detail in the music that supports each answer.', '这次请留意' + local(ex.questions[0].topic) + '，再辨认风格与时期。试着用听到的细节解释两个答案。');
    return t('Listen twice to the melody line from the piece. Tap back the rhythm of its notes, then identify the number of beats in each bar.', '听两遍乐曲中的单声部片段。先按音符的节奏拍回，再判断每小节有几拍。');
  }

  function promptName(key) {
    if (key === 'cad') return t('Hear the cadence twice', '听两遍终止乐句');
    if (key === 'ch') return t('Hear the chords', '播放和弦');
    if (key === 'mod' || key === 'minor') return t('Play the passage', '播放转调片段');
    if (key === 'a' && session.grade === 7) return t('Play the duet', '播放二声部乐句');
    if (key === 'a' && session.grade === 8) return t('Play the three voices', '播放三声部乐句');
    if (key === 'desc') return t('Play piece', '播放乐曲');
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
    const playerButton = step.active && step.active !== 'accompaniment'
      ? button('stop-sound', t('Stop audio', '停止播放'), 'tr-primary', 'stop')
      : button('prompt', step.heard && !locked ? t('Listen again', '再听一次') : promptName(key), 'tr-primary', 'play', busy || locked || !!step.item || !!step.active);
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
      key === 'd' ? t('Unaccompanied melody', '单声部旋律') :
      ex.key ? t('Starting key · ', '起始调，') + local(ex.key) : t('Piano excerpt', '钢琴乐曲片段');
    return '<section class="tr-player"><div class="tr-source"><span class="tr-source-icon">' + icon(key === 'b' ? 'note' : 'phones') +
      '</span><div><strong>' + esc(detail) + '</strong><span aria-live="polite">' +
      (step.active ? t('Playing…', '正在播放……') : step.heard ? t('Listening complete', '已完成聆听') : t('Ready to listen', '准备聆听')) +
      '</span></div></div>' + clefs +
      (key === 'b' ? '<div class="tr-score">' + Music.score(ex, clef, window.App.lang) + '</div>' : '') +
      '<div class="tr-actions">' + controls + '</div>' +
      (key === 'b' && mode === 'practice' && step.heard && !step.item && !step.mic && !step.active && !step.self ? noteHelp() : '') + '</section>';
  }

  function noteHelp() {
    const { step, set, clef } = session;
    return '<div class="tr-note-help"><button type="button" class="tr-help-toggle" data-do="help" aria-expanded="' + !!step.help + '">' +
      t('Check individual notes', '逐音核对') + '</button>' + (step.help ? '<div class="tr-note-buttons">' +
      Music.noteNames(set[session.key], clef).map((note, i) => button('note-' + i, t('Note ' + (i + 1) + ' · ' + note, '第 ' + (i + 1) + ' 音，' + note))).join('') +
      '</div>' : '') + '</div>';
  }

  function section(title, body) {
    return '<section class="tr-response"><h2>' + esc(title) + '</h2>' + body + '</section>';
  }

  function ratings() {
    return '<div class="tr-choices">' +
      [t('Needs more practice', '还需多练'), t('Mostly accurate', '大部分准确'), t('Accurate throughout', '全程准确')]
        .map((value, i) => button('rate-' + i, value, 'tr-choice')).join('') + '</div>';
  }

  function singing() {
    const { step } = session;
    const withPiano = accompanied();
    if (step.self) {
      const practice = session.mode === 'practice';
      const tools = practice ? '<div class="tr-actions">' +
        button(step.active ? 'stop-sound' : 'model', step.active ? t('Stop audio', '停止播放') : t('Play example', '播放示范'), '', step.active ? 'stop' : 'play') +
        (AuralInput.supported() ? button('mic', t('Record a new take', '重新演唱并录音'), '', 'mic', !!step.active) : '') + '</div>' : '';
      return section(t('Rate your own performance', '为本次演唱自评'), '<p>' +
        t('Choose your own rating. Automatic feedback requires a recording started before you sing.', '请按自己的判断评分。如需自动逐音反馈，请在演唱前开始录音。') +
        '</p>' + tools + ratings());
    }
    if (step.mic || step.active === 'accompaniment') {
      const waiting = step.mic === 'waiting';
      let title = waiting ? t('Opening microphone', '正在开启麦克风') : t('Recording your voice', '正在录音');
      let cue = t('Sing now. Use a fresh syllable for each note, then finish to see your results.', '现在开始唱。每个音用一个独立的音节，唱完后点下方按钮查看结果。');
      if (withPiano && !waiting) {
        if (step.voiceCue === 'finished') {
          title = t('The accompaniment has finished', '伴奏已结束');
          cue = t('When you have finished singing, end the recording to check your notes.', '唱完后请结束录音，查看逐音结果。');
        } else if (step.voiceCue === 'sing') {
          title = t('Sing your part now', '现在开始唱自己的声部');
          cue = t('Keep singing the written part while the piano plays the other voice.', '钢琴在演奏另一个声部，请继续照谱唱自己的声部。');
        } else {
          title = t('Listen for your entry', '听起音和预备拍');
          cue = t('Listen to the starting note and two bars of count in. Sing your written part with the other voice.', '听起音和两小节预备拍，再随另一个声部唱出谱上的旋律。');
        }
      }
      return section(title, '<p role="status">' + (waiting ? t('Allow microphone access in your browser and wait for the cue to sing.', '请允许浏览器使用麦克风，等候演唱提示。') : cue) +
        '</p><div class="tr-actions">' + (step.mic === 'recording' ? button('finish-mic', t('Finish singing and check', '完成演唱并检查'), 'tr-primary', 'stop') : '') +
        button('cancel-mic', t('Cancel', '取消')) + '</div>');
    }
    const hasMic = window.AuralInput.supported();
    let copy = hasMic
      ? t('For automatic feedback, start recording before you sing. Finish singing to see which notes matched.', '想知道唱得准不准，请先点录音，再演唱。唱完点“完成演唱并检查”，即可查看逐音结果。')
      : t('Microphone feedback needs a supported browser on HTTPS or localhost. You can sing aloud and rate yourself here.', '要自动检查音准，请用支持麦克风的浏览器通过 HTTPS 或 localhost 打开。现在可以直接演唱并自评。');
    if (withPiano) copy += t(' Practise your part now. Use headphones when recording so the microphone picks up your voice. The piano gives two bars before your entry.', '现在可以先练唱。录音时请戴耳机，避免麦克风收到钢琴声。正式演唱前会有两小节预备拍。');
    const self = withPiano ? t('Sing with accompaniment and self review', '随伴奏演唱并自评') : t('I already sang · Self review', '我已唱完，自行评分');
    return section(t('Your turn', '轮到你了'), '<p>' + copy + '</p><div class="tr-actions">' +
      (hasMic ? button('mic', t('Record and check pitch', '录音并检查音准'), 'tr-primary', 'mic', !!step.active) : '') +
      button('self', self, hasMic ? '' : 'tr-primary', '', !!step.active) + '</div>');
  }

  function descriptionPane() {
    const { step, set } = session;
    if (step.self) {
      const own = step.description?.trim();
      return section(t('Compare your observations', '对照自己的听辨描述'), (own ? '<p class="tr-own-description">' + esc(own) + '</p>' : '') +
        '<h3>' + t('Reference observations', '参考要点') + '</h3>' + observations(set.desc) +
        '<p>' + t('Rate how well your description matches the musical details you heard.', '请根据自己是否描述了具体、准确的音乐细节，选择本次自评。') + '</p>' + ratings());
    }
    return section(t('Describe the music', '描述这段音乐'), '<p>' +
      t('Give your answer aloud or type it below. Mention the details you heard and the effect they create.', '可以口头作答，也可以写在下方。试着描述你听到的音乐细节，以及它们带来的效果。') +
      '</p><label class="tr-description">' + t('Your observations (optional)', '写下你的观察（选填）') +
      '<textarea rows="3" maxlength="1200" data-description>' + esc(step.description || '') +
      '</textarea></label><div class="tr-actions">' + button('compare-description', t('I have answered · Compare', '已作答，对照参考要点'), 'tr-primary', '', !!step.active) +
      '</div>');
  }

  function metreName(n) {
    return n === 6 ? t('6/8 time (two dotted beats)', '八六拍（每小节两大拍）') : t(n + ' beats', n + ' 拍');
  }

  function musicalChoices() {
    const { set, step } = session;
    const questions = set[session.key].questions;
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
      return section(t('Which metre did you hear?', '你听到哪一种拍子？'), '<div class="tr-choices">' +
        (session.grade === 7 ? [2, 3, 4, 6] : [2, 3, 4]).map(n => button('metre-' + n, metreName(n), 'tr-choice')).join('') + '</div>');
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

  function heardName(midi, target, name) {
    const nearest = Math.round(midi);
    if (Number.isFinite(target) && (nearest - target) % 12 === 0) {
      return name.replace(/-?\d+$/, n => Number(n) + (nearest - target) / 12);
    }
    const chromatic = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
    return chromatic[(nearest % 12 + 12) % 12] + (Math.floor(nearest / 12) - 1);
  }

  function pitchDetails(item, ex, clef, playable) {
    if (item.method === 'self') return '<p>' + t('You rated this performance yourself.', '此次演唱由你自行评分。') + '</p>';
    if (!Array.isArray(item.marks) || !item.marks.length) return '';
    const marks = item.marks;
    const correct = marks.filter(mark => mark === 'ok').length;
    const names = ex ? Music.noteNames(ex, clef) : [];
    const pitches = ex ? Music.pitches(ex, clef) : [];
    const octave = item.octave || 0;
    const heard = item.heardPitches;
    const overall = correct === marks.length ? t('All target notes were on pitch.', '目标音全部唱准了。') :
      t(correct + ' of ' + marks.length + ' target notes were on pitch.', '目标音共 ' + marks.length + ' 个，唱准了 ' + correct + ' 个。');
    let detail = '';
    if (Number.isFinite(item.rhythmScore)) detail += '<p>' + t('Rhythm match ' + item.rhythmScore + '%.', '节奏吻合度为 ' + item.rhythmScore + '％。') + '</p>';
    if (item.extraCount > 0) detail += '<p>' + t('Detected ' + item.extraCount + ' additional ' + (item.extraCount === 1 ? 'note.' : 'notes.'), '另听到 ' + item.extraCount + ' 个多余音。') + '</p>';
    if (octave) {
      const count = Math.abs(octave / 12);
      detail += '<p>' + t('The pitch check accepted your register, ' + count + (count === 1 ? ' octave ' : ' octaves ') + (octave < 0 ? 'below' : 'above') + ' the written notes.',
        '已按你的音域核对音准，整体比谱面' + (octave < 0 ? '低' : '高') + ' ' + count + ' 个八度。') + '</p>';
    }
    const rows = marks.map((mark, i) => {
      const target = names[i] || String(i + 1);
      const targetCell = playable && ex ? button('pitch-' + item.key + '-' + i, target, 'tr-target', 'play') : esc(target);
      let heardCell = '';
      if (Array.isArray(heard)) {
        let value = t('Undetected', '未听到');
        if (Number.isFinite(heard[i])) {
          value = heardName(heard[i], pitches[i], target);
          if (Number.isFinite(pitches[i])) {
            const cents = Math.round((heard[i] - pitches[i] - octave) * 100);
            value += t(' (' + (cents > 0 ? '+' : '') + cents + '¢)', '（' + (cents > 0 ? '＋' : '') + String(cents).replace('-', '−') + ' 音分）');
          }
        }
        heardCell = '<td>' + esc(value) + '</td>';
      }
      return '<tr><td>' + (i + 1) + '</td><td>' + targetCell + '</td>' + heardCell + '<td><span class="' +
        (mark === 'ok' ? 'tr-correct' : 'tr-review') + '">' + t(...(Object.hasOwn(markWords, mark) ? markWords[mark] : markWords.missed)) + '</span></td></tr>';
    }).join('');
    const legend = Array.isArray(heard) ? '<p>' + t('The number beside each heard note shows its distance from the target in cents. Within 50 cents counts as on pitch.', '检测音旁的数值是它与目标音相差的音分。相差不超过 50 音分计作准确。') + '</p>' : '';
    return '<p><strong>' + overall + '</strong></p>' + detail + legend + '<table class="tr-marks"><thead><tr><th scope="col">#</th><th scope="col">' +
      t('Target', '目标音') + '</th>' + (Array.isArray(heard) ? '<th scope="col">' + t('Heard', '检测音') + '</th>' : '') +
      '<th scope="col">' + t('Pitch', '音准') + '</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function questionDetails(ex, picks = []) {
    return ex.questions.map((question, index) => {
      const choice = question.options[picks[index]];
      const correct = picks[index] === question.answer;
      return '<div class="tr-evidence"><strong>' + esc(local(question.prompt)) + '</strong><p>' +
        (choice ? esc(t('Your answer was ', '你的答案为') + local(choice)) + t('. ', '。') : '') +
        (correct ? t('Correct.', '答对了。') : esc(t('The correct answer is ', '正确答案为') + local(question.options[question.answer])) + t('.', '。')) +
        '</p><p>' + esc(local(question.evidence)) + '</p></div>';
    }).join('');
  }

  function observations(ex) {
    return '<ul class="tr-observations">' + ex.observations.map(entry => '<li>' + esc(local(entry)) + '</li>').join('') + '</ul>';
  }

  function reviewItem(item, ex, clef = 'treble', playable = false) {
    if (!item) return '';
    if (item.key === 'a' || item.key === 'b') return pitchDetails(item, ex, clef, playable);
    if (!ex) return '';
    if (item.key === 'desc') return (item.description ? '<p class="tr-own-description">' + esc(item.description) + '</p>' : '') +
      '<p>' + t('Reference observations for your self review', '供自评时对照的音乐要点') + '</p>' + observations(ex);
    if (item.key === 'd') {
      let detail = '<p>' + (Number.isFinite(item.rhythmScore) ? t('Rhythm match ' + item.rhythmScore + '%.', '节奏吻合度为 ' + item.rhythmScore + '％。') : '');
      if (Number.isFinite(item.tapCount)) detail += t(' Expected ' + ex.notes.length + ' onsets and detected ' + item.tapCount + '.', '本题有 ' + ex.notes.length + ' 个起音，记录到 ' + item.tapCount + ' 下。');
      return detail + '</p><p>' + ([2, 3, 4, 6].includes(item.chosenMetre) ? t('You chose ', '你选择了') + metreName(item.chosenMetre) + t('. ', '。') : '') +
        t('The piece is in ', '本曲为') + metreName(ex.metre) + t('.', '。') + '</p>';
    }
    return ex.questions ? questionDetails(ex, item.choices) : '';
  }

  function recordingButton(key) {
    if (!session.takes[key]) return '';
    const playing = session.step.active === 'take-' + key;
    return button(playing ? 'stop-sound' : 'take-' + key,
      playing ? t('Stop your recording', '停止回听') : t('Play your recording', '回听自己的录音'), '', playing ? 'stop' : 'mic');
  }

  function mockFeedback() {
    const { key, step, items, set, parts } = session;
    if (key !== lastPart()) {
      const next = label(parts[parts.indexOf(key) + 1]);
      return '<section class="tr-feedback"><h2>' + t('Answer recorded', '已记录作答') + '</h2><p>' +
        t('Feedback will appear after the last task.', '完成最后一项后，将一起显示反馈。') + '</p><div class="tr-actions">' +
        button('next', t('Continue to test ' + next, '进入 ' + next + ' 项'), 'tr-primary') + '</div></section>';
    }
    const notes = [...items, step.item].map(item => {
      const part = item.key;
      const detail = reviewItem(item, set[part], session.clef, true);
      return '<div class="tr-review-part"><h3>' + esc(label(part) + '　' + name(part)) + '</h3><p class="tr-review-score">' +
        (item.method === 'self' ? t('Self rating ', '自评 ') : t('Practice score ', '练习得分 ')) +
        item.score + t('%', '％') + '</p>' + detail + '<div class="tr-actions">' + button('review-' + part, t('Play example', '播放示范'), '', 'play') + recordingButton(part) + '</div></div>';
    }).join('');
    return '<section class="tr-feedback"><h2>' + t('Your mock test review', '模拟考试反馈') + '</h2>' + notes +
      '<div class="tr-actions">' + button('next', t('Finish session', '完成本次练习'), 'tr-primary') +
      (step.active ? button('stop-sound', t('Stop audio', '停止播放'), '', 'stop') : '') + '</div></section>';
  }

  function feedback() {
    if (session.mode === 'mock') return mockFeedback();
    const { key, step, set } = session;
    const item = step.item;
    const ex = set[key];
    const body = reviewItem(item, ex, session.clef, true);
    const next = t('Finish session', '完成本次练习');
    const modelPlaying = step.active === 'model';
    return '<section class="tr-feedback"><div class="tr-feedback-head"><h2>' + t('Your feedback', '练习反馈') + '</h2><span>' +
      (item.method === 'self' ? t('Self rating', '自评') : t('Practice score', '练习得分')) + '　<b>' + item.score + (window.App.lang === 'zh' ? '％' : '%') + '</b></span></div>' + body + ((key === 'a' || key === 'b') && item.method === 'self' ? noteHelp() : '') +
      '<div class="tr-actions">' + button('next', next, 'tr-primary') + button(modelPlaying ? 'stop-sound' : 'model', modelPlaying ? t('Stop audio', '停止播放') : t('Replay example', '重听示范'), '', modelPlaying ? 'stop' : 'play') +
      recordingButton(key) + button('retry', t('Retry this exercise', '重试本题')) + '</div></section>';
  }

  function render() {
    if (!session) return;
    const { key, set, mode, step, parts } = session;
    const area = document.getElementById('workspace');
    const part = label(key);
    const focus = area.querySelector('.tr-session')?.contains(document.activeElement) ? document.activeElement : null;
    const focusAction = focus?.dataset.do;
    const focusQ = focus?.dataset.q;
    const focusValue = focus?.value;
    const status = mode === 'mock' ? t('Mock test', '模拟考试') : t('Focused practice', '专项练习');
    const responses = { recall: singing, sight: singing, choice: musicalChoices, rhythm: rhythmPane, describe: descriptionPane };
    const meter = mode === 'mock' ? '<ol class="tr-progress" aria-label="' + t('Exam progress', '考试进度') + '">' +
      parts.map((p, i) => '<li ' + (p === key ? 'aria-current="step"' : '') + ' class="' + (i <= parts.indexOf(key) ? 'tr-done' : '') + '"><span>' + label(p) + '</span></li>').join('') + '</ol>' : '';
    area.innerHTML = '<article class="tr-session"><div class="tr-top">' +
      button('exit', t('Practice room', '练习室'), 'tr-link', 'back') + '<span>' + status + '</span></div>' + meter +
      '<header class="tr-head"><span class="tr-part">' + t('Test ' + part, part + ' 项') + '</span><h1>' +
      esc(name(key)) + '</h1><p>' + esc(instructions(key, set[key])) + '</p></header>' + player() +
      (step.error ? '<p class="tr-error" role="alert">' + esc(t(...step.error)) + '</p>' : '') +
      (step.item ? feedback() : step.heard ? responses[skill(key).kind]() : '') + '</article>';
    const el = area.querySelector('.tr-session');
    el.onclick = click;
    el.onchange = change;
    el.oninput = event => {
      if (event.target.hasAttribute('data-description')) step.description = event.target.value.slice(0, 1200);
    };
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
    check.disabled = !!session.step.active || !session.set[session.key].questions.every((_, i) => Number.isInteger(session.step.picks[i]));
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
    clearTimeout(session.step.cueTimer);
    stopTake();
    session.step.playId++;
    session.step.active = '';
    Piano.stop();
  }

  function playTake(part) {
    const here = session;
    const blob = here.takes[part];
    if (!blob || !here.step.item || (here.mode === 'mock' && here.key !== lastPart())) return;
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
      const playbackMode = extraHearing ? (here.grade === 5 ? 'model' : 'extra') : action === 'context' ? 'prompt' : action;
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
      if (here.step.item && (here.mode !== 'mock' || here.key === lastPart())) render();
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
    const fixedTempo = accompanied();
    if (fixedTempo) quiet();
    const timing = key === 'a' || fixedTempo ? Music.onsets(set[key]) : null;
    const item = AuralInput.assessPitch(Music.pitches(set[key], clef), timing, notes, fixedTempo);
    if (item) saveItem({ ...item, method: 'auto' });
    else {
      step.error = ['No stable pitches were heard. Try again closer to the microphone, or perform aloud and use self rating.', '没有听到稳定音高。请靠近麦克风重试，也可以唱完后自行对照。'];
      render();
    }
  }

  async function accompany(recording) {
    const here = session;
    const { step, set, clef } = here;
    quiet();
    const id = step.playId;
    const active = () => session === here && here.step === step && step.playId === id;
    step.active = 'accompaniment';
    step.voiceCue = 'count';
    step.error = '';
    render();
    let complete = false;
    try {
      complete = await Piano.play(set.b, 'accompaniment', {
        clef, recording,
        onVoiceStart(delay) {
          if (!active()) return;
          if (recording) AuralInput.startVoiceIn(delay);
          step.cueTimer = setTimeout(() => {
            if (active() && step.active === 'accompaniment') { step.voiceCue = 'sing'; render(); }
          }, delay * 1000);
        }
      });
    } catch {}
    if (!active()) return;
    step.active = '';
    clearTimeout(step.cueTimer);
    if (complete) {
      step.voiceCue = 'finished';
      if (!recording) step.self = true;
    } else {
      if (recording) { AuralInput.cancel(); step.mic = ''; step.recording = null; }
      step.error = ['The accompaniment was interrupted. Check your audio and start the performance again.', '伴奏已中断。请检查声音后重新开始演唱。'];
    }
    render();
  }

  async function record() {
    const here = session;
    const step = here.step;
    const ticket = {};
    step.recording = ticket;
    step.self = false;
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
      await AuralInput.record(endMic, here.key === 'd' ? hearClap : null, accompanied());
      if (session !== here || here.step !== step || step.recording !== ticket) return;
      step.mic = 'recording';
      if (accompanied()) { accompany(true); return; }
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
    if (action.startsWith('pitch-')) {
      const [, part, index] = action.split('-');
      play('note', Number(index), part);
      return;
    }
    if (action.startsWith('note-')) { play('note', Number(action.slice(5))); return; }
    if (action.startsWith('clef-')) {
      const clef = action.slice(5);
      if (session.clef === clef) return;
      session.clef = clef;
      session.step = fresh();
    } else if (action === 'mic') { record(); return; }
    else if (action === 'finish-mic') { endMic(); return; }
    else if (action === 'cancel-mic') { step.recording = null; step.mic = ''; if (key === 'd') step.taps = []; AuralInput.cancel(); quiet(); }
    else if (action === 'self' || action === 'compare-description') {
      if (action === 'self' && accompanied()) { accompany(false); return; }
      step.self = true;
      step.error = '';
    } else if (action.startsWith('rate-')) {
      const item = { score: [25, 70, 100][Number(action.slice(5))], method: 'self' };
      if (key === 'desc') item.description = (step.description || '').trim();
      saveItem(item);
      return;
    } else if (action === 'check-c') {
      const questions = set[key].questions;
      const correct = questions.filter((q, i) => q.answer === step.picks[i]).length;
      saveItem({ score: Math.round(correct * 100 / questions.length), method: 'auto', choices: step.picks.slice() }); return;
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
      if (mode === 'practice' || key === lastPart()) {
        const result = { mode, grade: session.grade, key: session.first, items: session.items.slice(), recipe: session.set.recipe, clef: session.clef };
        stop();
        window.App.complete(result);
        return;
      }
      session.key = session.parts[session.parts.indexOf(key) + 1];
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
  window.Trainer = { start, stop, refresh: render, reviewItem };
})();
