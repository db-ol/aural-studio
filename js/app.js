(() => {
  'use strict';

  const syllabus =
    'https://www.abrsm.org/sites/default/files/2024-06/Piano%202025%20%26%202026%20Prac%20syllabus%2020240524_access.pdf';
  const skills = {
    a: {
      part: 'A',
      title: ['Melody recall', '旋律记忆'],
      summary: [
        'Listen twice, then sing or play the melody from memory.',
        '听两遍旋律，再凭记忆唱出或弹出。'
      ],
      tip: [
        'Keep the first note in mind through the count in. Listen for where the phrase rises, rests and comes home.',
        '数拍时记住起音。第一遍听旋律的走向，第二遍留意停顿和收尾。'
      ]
    },
    b: {
      part: 'B',
      title: ['Sight singing', '六音视唱'],
      summary: [
        'Read six notes in treble or bass clef and sing at your own pace.',
        '看高音谱或低音谱，自由速度唱出六个音。'
      ],
      tip: [
        'Sing the tonic quietly after the chord. Follow the steps and skips on the staff, then check that your last note returns to the tonic.',
        '听主和弦后轻唱主音。看清相邻音是级进还是跳进，最后听自己是否回到了主音。'
      ]
    },
    c: {
      part: 'C(i)',
      title: ['Musical features', '音乐听辨'],
      summary: [
        'Listen for musical details and the clues to style and period.',
        '聆听音乐特征，辨别作品的风格与时期。'
      ],
      tip: [
        'Read both questions before listening. Follow changes in the melody, then listen to what the other hand plays underneath.',
        '听前先看两个问题。除了旋律本身，也要听另一只手怎样伴奏，这往往是辨别时期的线索。'
      ]
    },
    d: {
      part: 'C(ii)',
      title: ['Rhythm and metre', '节奏与拍子'],
      summary: [
        'Tap back the rhythm, then identify the number of beats per bar.',
        '拍出片段的节奏，再判断每小节有几拍。'
      ],
      tip: [
        'Keep the pulse with your foot while your hands copy the notes. The strong beats will help you hear groups of two, three or four.',
        '用脚保持基本拍，用手模仿音符的长短，再听重拍之间有两拍、三拍还是四拍。'
      ]
    }
  };
  const workspace = document.querySelector('#workspace');
  const guide = document.querySelector('#guide');
  const storage = {
    get(name) {
      try {
        return localStorage.getItem('aural.studio.' + name);
      } catch {
        return null;
      }
    },
    set(name, value) {
      try {
        localStorage.setItem('aural.studio.' + name, value);
        return true;
      } catch {
        return false;
      }
    }
  };
  let lang = storage.get('lang') === 'en' ? 'en' : 'zh';
  let layout = storage.get('layout') === 'list' ? 'list' : 'grid';
  let history = [];
  try {
    const saved = JSON.parse(storage.get('history'));
    if (Array.isArray(saved)) history = saved.filter(validResult).slice(0, 120);
  } catch {}
  let persisted = true;
  let offlineReady = false;
  let page = '';
  let filter = 'all';
  const keys = Object.keys(skills);
  const t = (en, zh) => (lang === 'en' ? en : zh);
  const str = (pair) => t(...pair);
  const percent = (n) => n + t('%', '％');
  const { icon, motif } = window.Art;
  const average = (items) => Math.round(items.reduce((n, i) => n + i.score, 0) / items.length);
  function validResult(r) {
    return (
      r &&
      typeof r.id === 'string' &&
      /^[\w-]+$/.test(r.id) &&
      Number.isFinite(r.date) &&
      ['practice', 'mock'].includes(r.mode) &&
      Array.isArray(r.items) &&
      r.items.length > 0 &&
      r.items.every(
        (i) =>
          i &&
          Object.hasOwn(skills, i.key) &&
          Number.isFinite(i.score) &&
          i.score >= 0 &&
          i.score <= 100 &&
          ['self', 'auto'].includes(i.method)
      )
    );
  }
  function complete(result) {
    const saved = {
      id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      date: Date.now(),
      mode: result.mode,
      clef: result.clef,
      recipe: result.recipe,
      items: result.items.map(({ key, score, method, marks, choices, rhythmScore, chosenMetre, tapCount }) =>
        ({ key, score, method, marks, choices, rhythmScore, chosenMetre, tapCount }))
    };
    if (!validResult(saved)) return;
    history = [saved, ...history].slice(0, 120);
    persisted = storage.set('history', JSON.stringify(history));
    location.replace('#result/' + saved.id);
  }
  window.App = {
    get lang() {
      return lang;
    },
    t,
    complete,
    exit() {
      location.hash = 'studio';
    }
  };
  const day = (date) =>
    new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  const partLabel = (key) => 'TEST ' + skills[key].part;
  const method = (item) =>
    item.method === 'self' ? t('Self review', '自评') : t('Exercise feedback', '练习反馈');
  const testName = (r) =>
    r.mode === 'mock' ? t('Mock aural test', '全套模拟测试') : str(skills[r.items[0].key].title);
  const practiceLink = (key, label) =>
    '<a class="action primary" href="#practice/' + key + '">' + icon('play') + label + '</a>';
  const smallLabel = (en, zh) => '<p class="kicker"><span></span>' + t(en, zh) + '</p>';
  function heading(label, title, detail, side = '') {
    return (
      '<div class="page-heading"><div>' +
      smallLabel(label, label) +
      '<h1>' +
      title +
      '</h1><p class="intro-copy">' +
      detail +
      '</p></div>' +
      side +
      '</div>'
    );
  }
  function shell() {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.getElementById('language').value = lang;
    document.getElementById('language').setAttribute('aria-label', t('Interface language', '界面语言'));
    document.getElementById('language-icon').innerHTML = icon('globe');
    document.querySelector('.skip').textContent = t('Skip to practice', '跳至练习内容');
    document.querySelector('#main-nav').setAttribute('aria-label', t('Main navigation', '主导航'));
    const tabs = [
      ['studio', 'grid', t('Practice room', '练习室')],
      ['mock', 'exam', t('Mock test', '模拟测试')],
      ['history', 'chart', t('Practice log', '练习记录')]
    ];
    let active = page.startsWith('result')
      ? 'history'
      : isMock(page)
        ? 'mock'
        : sessionPage(page)
          ? 'studio'
          : page;
    document.querySelector('#main-nav').innerHTML = tabs
      .map(
        ([id, img, label]) =>
          '<a href="#' +
          id +
          '" ' +
          (active === id ? 'aria-current="page"' : '') +
          '>' +
          icon(img) +
          '<span>' +
          label +
          '</span></a>'
      )
      .join('');
    footer();
    document.title = t('Grade 5 practice', '五级听觉练习') + ' · Aural Studio';
  }
  function footer() {
    document.getElementById('footer-note').textContent = offlineReady
      ? t('Ready for offline practice', '已可离线练习')
      : t('Independent practice for ABRSM Grade 5', 'ABRSM 钢琴五级自主练习');
  }
  function hero() {
    return (
      '<section class="hero" aria-labelledby="hero-title"><div class="hero-art"></div><div class="hero-copy">' +
      '<div class="hero-label">' +
      icon('headphones') +
      '<span>MOCK EXAM</span></div><h2 id="hero-title">' +
      t('The mock aural test', '五级听力模拟测试') +
      '</h2>' +
      '<p>' +
      t(
        'Work through all four tasks in exam order, from melody recall to rhythm.',
        '从旋律记忆到节奏辨别，按考试顺序完成四项测试。'
      ) +
      '</p>' +
      '<div class="hero-bottom"><a class="action hero-start" href="#session/mock">' +
      icon('play') +
      t('Start mock test', '开始模拟') +
      '</a><span class="hero-time">' +
      icon('clock') +
      t('About 5 min', '约 5 分钟') +
      '</span></div></div></section>'
    );
  }
  function cards() {
    return keys
      .map(
        (key) =>
          '<a class="skill-card skill-' +
          key +
          '" href="#practice/' +
          key +
          '"><div class="art-panel">' +
          motif(key) +
          '</div><div class="card-body"><span class="part">' +
          partLabel(key) +
          '</span><h3>' +
          str(skills[key].title) +
          '</h3><p>' +
          str(skills[key].summary) +
          '</p><span class="card-start">' +
          icon('play') +
          t('Practise', '开始练习') +
          '</span></div></a>'
      )
      .join('');
  }
  function listToggle() {
    return (
      '<div class="layout-control" role="group" aria-label="' +
      t('Exercise layout', '练习显示方式') +
      '">' +
      ['grid', 'list']
        .map((v) => {
          const name = v === 'grid' ? t('Grid view', '卡片视图') : t('List view', '列表视图');
          return (
            '<button type="button" data-layout="' +
            v +
            '" aria-pressed="' +
            (layout === v) +
            '" aria-label="' +
            name +
            '" title="' +
            name +
            '">' +
            icon(v) +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }
  function row(r) {
    return (
      '<a class="history-row" href="#result/' +
      r.id +
      '"><span class="history-icon">' +
      icon(r.mode === 'mock' ? 'exam' : 'music') +
      '</span><span class="row-main"><strong>' +
      testName(r) +
      '</strong><small>' +
      day(r.date) +
      '</small></span><span class="row-score">' +
      percent(average(r.items)) +
      '</span></a>'
    );
  }
  function empty() {
    return (
      '<div class="empty-log">' +
      icon('history') +
      '<span>' +
      t('Your completed sessions will appear here.', '完成一次练习后，就能在这里回顾表现。') +
      '</span></div>'
    );
  }
  function home() {
    const guideButton =
      '<button type="button" class="action guide-btn" data-guide>' +
      icon('book') +
      t('Exam guide', '考试指南') +
      '</button>';
    return (
      heading(
        'ABRSM  /  GRADE 5',
        t('Aural practice room', '听觉练习室'),
        t(
          'Choose a skill to work on, or put them together in a mock test.',
          '选择一个专项练习，或用一套模拟测试检验学习成果。'
        ),
        guideButton
      ) +
      hero() +
      '<section class="section-block" aria-labelledby="skills-title"><div class="section-heading"><h2 id="skills-title">' +
      t('Practice by skill', '专项练习') +
      '</h2>' +
      listToggle() +
      '</div><div class="skill-grid ' +
      (layout === 'list' ? 'is-list' : '') +
      '">' +
      cards() +
      '</div></section>' +
      '<section class="section-block recent"><div class="section-heading"><h2>' +
      t('Recent practice', '最近练习') +
      '</h2>' +
      (history.length
        ? '<a class="text-link" href="#history">' + t('View practice log', '查看练习记录') + '</a>'
        : '') +
      '</div><div class="log-list">' +
      (history.length ? history.slice(0, 3).map(row).join('') : empty()) +
      '</div></section>'
    );
  }
  function mock() {
    return (
      heading(
        'ABRSM  /  GRADE 5',
        t('Mock test', '模拟测试'),
        t(
          'Take the four tasks in order. You can review your results at the end.',
          '按顺序完成四个环节，结束后一起查看结果。'
        )
      ) +
      hero() +
      '<section class="section-block"><div class="section-heading"><h2>' +
      t('Test sequence', '考试顺序') +
      '</h2></div><div class="sequence">' +
      keys
        .map(
          (k) =>
            '<div class="sequence-row skill-' +
            k +
            '"><span class="step-part">' +
            skills[k].part +
            '</span><div><h3>' +
            str(skills[k].title) +
            '</h3><p>' +
            str(skills[k].summary) +
            '</p></div></div>'
        )
        .join('') +
      '</div></section>'
    );
  }
  function log() {
    const items = history.flatMap((r) => r.items);
    const stats = [
      [history.length, t('Sessions', '完成次数')],
      [history.filter((r) => r.mode === 'mock').length, t('Mock tests', '模拟测试')],
      [new Set(history.map((r) => new Date(r.date).toDateString())).size, t('Practice days', '练习天数')]
    ];
    const filtered = history.filter((r) => filter === 'all' || r.mode === filter);
    return (
      heading(
        'PRACTICE LOG',
        t('Practice log', '练习记录'),
        t(
          'Revisit your results and choose a skill for your next session.',
          '回顾每次表现，选出下一次想练的专项。'
        )
      ) +
      '<div class="stats">' +
      stats.map(([v, n]) => '<div><strong>' + v + '</strong><span>' + n + '</span></div>').join('') +
      '</div>' +
      (items.length
        ? '<section class="section-block"><div class="section-heading"><h2>' +
          t('Latest by skill', '各项最近表现') +
          '</h2></div><div class="skills-summary">' +
          keys
            .map((k) => {
              const latest = items.find((i) => i.key === k);
              return (
                '<a href="#practice/' +
                k +
                '" class="skill-' +
                k +
                '"><span class="part">' +
                partLabel(k) +
                '</span><strong>' +
                str(skills[k].title) +
                '</strong><small>' +
                (latest
                  ? method(latest) + ' · ' + percent(latest.score)
                  : t('Start practising', '开始练习')) +
                '</small></a>'
              );
            })
            .join('') +
          '</div></section>'
        : '') +
      '<section class="section-block"><div class="section-heading"><h2>' +
      t('Sessions', '历次练习') +
      '</h2><select id="history-filter" aria-label="' +
      t('Session type', '练习类型') +
      '">' +
      [
        ['all', t('All sessions', '全部练习')],
        ['practice', t('Skill practice', '专项练习')],
        ['mock', t('Mock tests', '模拟测试')]
      ]
        .map(
          ([v, n]) => '<option value="' + v + '" ' + (filter === v ? 'selected' : '') + '>' + n + '</option>'
        )
        .join('') +
      '</select></div><div class="log-list">' +
      (filtered.length
        ? filtered.map(row).join('')
        : history.length
          ? '<div class="empty-log">' + t('No sessions of this type yet.', '还没有这类练习记录。') + '</div>'
          : empty()) +
      '</div><p class="footnote">' +
      t('The latest 120 sessions are kept in this browser.', '这个浏览器会保留最近 120 次练习。') +
      '</p></section>'
    );
  }
  function results(r) {
    if (!r) return log();
    const target = r.items.reduce((a, b) => (b.score < a.score ? b : a)).key;
    const set = canReplay(r) ? Music.makeSet(r.recipe) : null;
    function feedback(item) {
      let detail = '';
      if (set && item.key === 'c' && Array.isArray(item.choices)) {
        detail = set.c.questions
          .map((q, index) => {
            const choice = q.options[item.choices[index]];
            const correct = q.options[q.answer][lang];
            const picked = choice ? choice[lang] : t('Skipped', '未答');
            const comparison = item.choices[index] === q.answer
              ? t('Correct. You chose ' + correct + '.', '答对了，你选的是“' + correct + '”。')
              : t('You chose ' + picked + '. The answer is ' + correct + '.', '你选了“' + picked + '”，正确答案是“' + correct + '”。');
            return '<p><strong>' + q.topic[lang] + '</strong><br>' + comparison + '<br>' + q.evidence[lang] + '</p>';
          })
          .join('');
      } else if (set && item.key === 'd') {
        if (Number.isFinite(item.rhythmScore)) {
          let rhythm = t('Rhythm match ', '节奏吻合度 ') + percent(item.rhythmScore);
          if (Number.isInteger(item.tapCount)) {
            rhythm += t('. You tapped ' + item.tapCount + ' times for ' + set.d.notes.length + ' notes.',
              '。片段有 ' + set.d.notes.length + ' 个起音，你拍了 ' + item.tapCount + ' 下。');
          }
          let metre = t('Beats per bar', '每小节拍数') + ' ' + set.d.metre;
          if ([2,3,4].includes(item.chosenMetre)) {
            metre = t('You chose ' + item.chosenMetre + ' beats per bar. The piece has ' + set.d.metre + '.',
              '你选了每小节 ' + item.chosenMetre + ' 拍，曲子为每小节 ' + set.d.metre + ' 拍。');
          }
          detail = '<p>' + rhythm + '<br>' + metre + '</p>';
        }
      } else if (set && ['a', 'b'].includes(item.key) && Array.isArray(item.marks)) {
        const names = Music.noteNames(set[item.key], r.clef);
        const labels = {
          ok: t('On pitch', '准确'),
          low: t('Low', '偏低'),
          high: t('High', '偏高'),
          missed: t('Missed', '漏音')
        };
        detail =
          '<div class="pitch-review">' +
          item.marks
            .slice(0, names.length)
            .map(
              (mark, index) =>
                '<span>' + names[index] + ' ' + (Object.hasOwn(labels, mark) ? labels[mark] : '') + '</span>'
            )
            .join('') +
          '</div>';
      }
      return (
        '<div class="record-item"><div class="sequence-row skill-' +
        item.key +
        '"><span class="step-part">' +
        skills[item.key].part +
        '</span><div><h3>' +
        str(skills[item.key].title) +
        '</h3><p>' +
        method(item) +
        '</p></div><b class="result-grade">' +
        percent(item.score) +
        '</b></div>' +
        (detail || set
          ? '<div class="record-detail">' +
            detail +
            (set
              ? '<a class="text-link" href="#repeat/' +
                r.id +
                '/' +
                item.key +
                '">' +
                t('Repeat this exercise', '重练原题') +
                '</a>'
              : '') +
            '</div>'
          : '') +
        '</div>'
      );
    }
    return (
      heading('SESSION REVIEW', t('Session review', '练习回顾'), testName(r) + ' · ' + day(r.date)) +
      '<div class="result-panel"><span class="result-check">' +
      icon('check') +
      '</span><div><h2>' +
      t('Session complete', '本次练习已完成') +
      '</h2><p>' +
      t('Practice average', '练习均分') +
      ' <strong>' +
      percent(average(r.items)) +
      '</strong></p></div>' +
      (set && r.mode === 'mock'
        ? '<a class="text-link retake" href="#repeat/' +
          r.id +
          '/mock">' +
          t('Repeat this test', '重做这套模拟') +
          '</a>'
        : '') +
      '</div>' +
      '<section class="section-block"><div class="section-heading"><h2>' +
      t('Feedback by skill', '分项反馈') +
      '</h2></div><div class="sequence">' +
      r.items.map(feedback).join('') +
      '</div>' +
      '<p class="footnote">' +
      (persisted
        ? t(
            'These practice scores include any self review and do not predict an exam mark.',
            '练习分数包含所选自评，仅供复习参考。'
          )
        : t(
            'Browser storage is unavailable. This result is available for this visit.',
            '浏览器存储不可用，本次结果仅在当前页面保留。'
          )) +
      '</p></section>' +
      '<aside class="review-tip"><span class="part">' +
      partLabel(target) +
      '</span><h2>' +
      t('Next practice', '下一次练习') +
      ' · ' +
      str(skills[target].title) +
      '</h2><p>' +
      str(skills[target].tip) +
      '</p>' +
      practiceLink(target, t('Practise this skill', '练这一项')) +
      '</aside><a class="text-link" href="#studio">' +
      t('Return to practice room', '返回练习室') +
      '</a>'
    );
  }
  function guideContent() {
    const scope = {
      a: [
        'Melodies stay within an octave and may use major or minor keys with up to three sharps or flats.',
        '旋律音域在一个八度内，调号最多有三个升号或降号，大调和小调都可能出现。'
      ],
      b: [
        'The six notes begin and end on the tonic. Major keys have at most two sharps or flats. Expect steps and thirds, with a possible rising fourth from the lower dominant to the tonic.',
        '六音以主音开始和结束，采用最多两个升降号的大调。留意二度和三度，也可能从下方的属音向上跳四度回到主音。'
      ],
      c: [
        'You will be asked about one of dynamics, articulation, tempo, tonality or character, and about the musical style and period.',
        '第一问从力度、奏法、速度、调性或性格中取一项，第二问是风格与时期。'
      ],
      d: [
        'The examiner takes a passage from the same piece and plays the melody twice without accompaniment. Clap it back, then say whether there are two, three or four beats per bar.',
        '从前一环节的同一首曲子中截取一段，去掉伴奏，播放两遍。先拍回节奏，再说出每小节是二拍、三拍还是四拍。'
      ]
    };
    return (
      '<div class="dialog-head"><div>' +
      smallLabel('ABRSM  /  GRADE 5', 'ABRSM  /  GRADE 5') +
      '<h2 id="guide-heading">' +
      t('Exam guide', '考试指南') +
      '</h2></div><button id="close-guide" class="icon-btn" type="button" aria-label="' +
      t('Close guide', '关闭指南') +
      '">' +
      icon('close') +
      '</button></div>' +
      '<p>' +
      t(
        'The examiner plays the piano for the aural tests in a Practical Grade exam. You can sing or hum in a comfortable octave.',
        '在现场演奏考试中，考官用钢琴出听力题。你可以选择舒适的八度唱出或哼出旋律。'
      ) +
      '</p>' +
      keys
        .map(
          (k) =>
            '<section class="guide-item skill-' +
            k +
            '"><span class="part">' +
            partLabel(k) +
            '</span><h3>' +
            str(skills[k].title) +
            '</h3><p>' +
            str(scope[k]) +
            '</p><p>' +
            str(skills[k].tip) +
            '</p></section>'
        )
        .join('') +
      '<p class="footnote">' +
      t(
        'The musical examples are original. Microphone analysis runs on this device. On a phone, microphone access requires HTTPS. You can always practise using self review.',
        '本站使用原创乐例，麦克风分析在本机完成。手机浏览器需要通过 HTTPS 访问才能使用麦克风，也可以选择听示范后自评。'
      ) +
      '</p>' +
      '<a class="text-link" href="' +
      syllabus +
      '" target="_blank" rel="noopener noreferrer">' +
      t('ABRSM piano syllabus, page 49', 'ABRSM 钢琴考试大纲，第 49 页') +
      '</a>'
    );
  }
  const isMock = (route) => route === 'mock' || route.endsWith('/mock');
  const sessionPage = (route) =>
    route === 'session/mock' ||
    /^practice\/[abcd]$/.test(route) ||
    /^repeat\/[\w-]+\/(mock|[abcd])$/.test(route);
  function canReplay(record) {
    return Music.validRecipe(record?.recipe);
  }
  function render() {
    const raw = location.hash.slice(1);
    let next =
      sessionPage(raw) || ['mock', 'history', 'studio'].includes(raw) || raw.startsWith('result/')
        ? raw
        : 'studio';
    let replay;
    if (next.startsWith('repeat/')) {
      replay = history.find((r) => r.id === next.split('/')[1]);
      if (!canReplay(replay)) next = 'history';
    }
    const change = page !== next;
    if (change && sessionPage(page)) window.Trainer.stop();
    page = next;
    shell();
    if (sessionPage(page)) {
      if (change)
        window.Trainer.start({
          mode: isMock(page) ? 'mock' : 'practice',
          key: isMock(page) ? 'a' : page.slice(-1),
          set: replay ? Music.makeSet(replay.recipe) : undefined,
          clef: replay?.clef === 'bass' ? 'bass' : 'treble'
        });
      else window.Trainer.refresh();
    } else {
      workspace.innerHTML =
        page === 'mock'
          ? mock()
          : page === 'history'
            ? log()
            : page.startsWith('result/')
              ? results(history.find((r) => r.id === page.slice(7)))
              : home();
    }
    if (change) {
      window.scrollTo(0, 0);
      if (raw) workspace.focus({ preventScroll: true });
    }
  }
  document.getElementById('language').addEventListener('change', (e) => {
    lang = e.target.value === 'en' ? 'en' : 'zh';
    storage.set('lang', lang);
    render();
    if (guide.open) guide.innerHTML = guideContent();
  });
  workspace.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-guide')) {
      guide.innerHTML = guideContent();
      guide.showModal();
    } else if (button.dataset.layout) {
      layout = button.dataset.layout;
      storage.set('layout', layout);
      workspace.querySelector('.skill-grid').classList.toggle('is-list', layout === 'list');
      workspace
        .querySelectorAll('[data-layout]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === layout)));
    }
  });
  workspace.addEventListener('change', (e) => {
    if (e.target.id === 'history-filter') {
      filter = e.target.value;
      render();
      document.getElementById('history-filter').focus();
    }
  });
  guide.addEventListener('click', (e) => {
    if (e.target === guide || e.target.closest('#close-guide')) guide.close();
  });
  document.querySelector('.skip').addEventListener('click', (e) => {
    e.preventDefault();
    workspace.focus();
  });
  window.addEventListener('hashchange', render);
  render();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && window.isSecureContext) {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        offlineReady = true;
        footer();
      })
      .catch(() => {});
  }
})();
