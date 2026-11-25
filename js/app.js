(() => {
  'use strict';

  const syllabus =
    'https://www.abrsm.org/sites/default/files/2024-06/Piano%202025%20%26%202026%20Prac%20syllabus%2020240524_access.pdf';
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
  const { grades, parts, skill: findSkill } = window.Curriculum;
  const storedGrade = Number(storage.get('grade'));
  let grade = grades.includes(storedGrade) ? storedGrade : 5;
  const skills = () => parts(grade);
  const skill = (key) => findSkill(grade, key);
  const recordGrade = (record) => record?.grade ?? record?.recipe?.grade ?? 5;
  const gradeHistory = () => history.filter((record) => recordGrade(record) === grade);
  const routeFor = (path, level = grade) => '#grade/' + level + '/' + path;
  let lang = storage.get('lang') === 'en' ? 'en' : 'zh';
  let layout = storage.get('layout') === 'list' ? 'list' : 'grid';
  function readHistory(fallback = []) {
    try {
      const saved = JSON.parse(storage.get('history'));
      if (Array.isArray(saved)) return saved.filter(validResult).slice(0, 120 * grades.length);
    } catch {}
    return fallback;
  }
  let history = readHistory();
  let persisted = true;
  let offlineReady = false;
  let page = '';
  let filter = 'all';
  const t = (en, zh) => (lang === 'en' ? en : zh);
  function gradeName(level = grade) {
    const word = { 5: '五级', 7: '七级', 8: '八级' };
    return t('Grade ' + level, word[level]);
  }
  const str = (pair) => t(...pair);
  const percent = (n) => n + t('%', '％');
  const { icon, motif } = window.Art;
  const average = (items) => Math.round(items.reduce((n, i) => n + i.score, 0) / items.length);
  function validResult(r) {
    return (
      r &&
      grades.includes(recordGrade(r)) &&
      typeof r.id === 'string' &&
      /^[\w-]+$/.test(r.id) &&
      Number.isFinite(r.date) &&
      ['practice', 'mock'].includes(r.mode) &&
      Array.isArray(r.items) &&
      r.items.length > 0 &&
      r.items.every(
        (i) =>
          i &&
          findSkill(recordGrade(r), i.key) &&
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
      grade,
      mode: result.mode,
      clef: result.clef,
      recipe: result.recipe,
      items: result.items.map((item) => {
        const fields = [
          'key',
          'score',
          'method',
          'marks',
          'choices',
          'rhythmScore',
          'chosenMetre',
          'tapCount',
          'heardPitches',
          'octave',
          'extraCount',
          'description',
          'correct',
          'pitchScore'
        ];
        return Object.fromEntries(
          fields.filter((field) => item[field] !== undefined).map((field) => [field, item[field]])
        );
      })
    };
    if (!validResult(saved)) return;
    if (persisted) history = readHistory(history);
    history = [saved, ...gradeHistory()]
      .slice(0, 120)
      .concat(history.filter((r) => recordGrade(r) !== grade));
    persisted = storage.set('history', JSON.stringify(history));
    location.replace('#result/' + saved.id);
  }
  window.App = {
    get grade() {
      return grade;
    },
    get lang() {
      return lang;
    },
    t,
    complete,
    exit() {
      location.hash = routeFor('studio');
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
  const partLabel = (key) => {
    const part = skill(key).part;
    return t('TEST ' + part, part.replace('(', '（').replace(')', '）') + ' 项');
  };
  const method = (item) =>
    item.method === 'self' ? t('Self review', '自评') : t('Exercise feedback', '练习反馈');
  const testName = (r) =>
    r.mode === 'mock'
      ? t('Mock aural test', '全套模拟测试')
      : str(findSkill(recordGrade(r), r.items[0].key).title);
  const practiceLink = (key, label) =>
    '<a class="action primary" href="' + routeFor('practice/' + key) + '">' + icon('play') + label + '</a>';
  const smallLabel = (en, zh) => '<p class="kicker"><span></span>' + t(en, zh) + '</p>';
  function gradePicker(path) {
    const options = grades
      .map(
        (level) =>
          '<a href="' +
          routeFor(path, level) +
          '"' +
          (grade === level ? ' aria-current="true"' : '') +
          '>' +
          gradeName(level) +
          '</a>'
      )
      .join('');
    return (
      '<nav class="grade-picker" aria-label="' +
      t('Exam grade', '考试级别') +
      '"><span>ABRSM</span>' +
      options +
      '</nav>'
    );
  }
  function heading(label, title, detail, side = '') {
    return (
      '<div class="page-heading"><div>' +
      (label === null ? gradePicker(page) : smallLabel(label, label)) +
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
          '<a href="' +
          routeFor(id) +
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
    document.title = gradeName() + t(' aural practice', '听觉练习') + ' · Aural Studio';
  }
  function footer() {
    document.getElementById('footer-note').textContent = offlineReady
      ? t('Ready for offline practice', '已可离线练习')
      : t('ABRSM ' + gradeName() + ' aural practice', 'ABRSM 钢琴' + gradeName() + '自主练习');
  }
  function hero() {
    return (
      '<section class="hero" aria-labelledby="hero-title"><div class="hero-art"></div><div class="hero-copy">' +
      '<div class="hero-label">' +
      icon('headphones') +
      '<span>MOCK EXAM</span></div><h2 id="hero-title">' +
      gradeName() +
      t(' mock aural test', '听觉模拟') +
      '</h2>' +
      '<p>' +
      (grade === 5
        ? t(
            'Practise all four tasks, from memory singing to rhythm.',
            '从旋律记忆到节奏辨别，按考试顺序完成四项练习。'
          )
        : grade === 7
          ? t(
              'Follow the lower voice, sing a duet part and identify the harmony before the listening piece.',
              '从二声部低音记忆开始，依次练习视唱、和声、音乐听辨与节奏。'
            )
          : t(
              'Start with three voices and finish with your own description of a piano piece.',
              '从三声部记忆和终止进行开始，最后用自己的话描述一首钢琴小品。'
            )) +
      '</p>' +
      '<div class="hero-bottom"><a class="action hero-start" href="' +
      routeFor('session/mock') +
      '">' +
      icon('play') +
      t('Start mock test', '开始模拟') +
      '</a><span class="hero-time">' +
      icon('layers') +
      t(skills().length + ' tasks', skills().length + ' 个练习环节') +
      '</span></div></div></section>'
    );
  }
  function cards() {
    return skills()
      .map(
        (key) =>
          '<a class="skill-card skill-' +
          skill(key).art +
          '" href="' +
          routeFor('practice/' + key) +
          '"><div class="art-panel">' +
          motif(skill(key).art) +
          '</div><div class="card-body"><span class="part">' +
          partLabel(key) +
          '</span><h3>' +
          str(skill(key).title) +
          '</h3><p>' +
          str(skill(key).summary) +
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
    const recent = gradeHistory();
    const guideButton =
      '<button type="button" class="action guide-btn" data-guide>' +
      icon('book') +
      '<span>' +
      t('Exam guide', '考试指南') +
      '</span></button>';
    return (
      heading(
        null,
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
      (recent.length
        ? '<a class="text-link" href="' +
          routeFor('history') +
          '">' +
          t('View practice log', '查看练习记录') +
          '</a>'
        : '') +
      '</div><div class="log-list">' +
      (recent.length ? recent.slice(0, 3).map(row).join('') : empty()) +
      '</div></section>'
    );
  }
  function mock() {
    return (
      heading(
        null,
        t('Mock test', '模拟测试'),
        t(
          'Work through the tasks in order. Review your answers together at the end.',
          '按考试顺序完成本级的各个环节，结束后一起查看结果。'
        )
      ) +
      hero() +
      '<section class="section-block"><div class="section-heading"><h2>' +
      t('Test sequence', '考试顺序') +
      '</h2></div><div class="sequence">' +
      skills()
        .map(
          (k) =>
            '<div class="sequence-row skill-' +
            skill(k).art +
            '"><span class="step-part">' +
            skill(k).part +
            '</span><div><h3>' +
            str(skill(k).title) +
            '</h3><p>' +
            str(skill(k).summary) +
            '</p></div></div>'
        )
        .join('') +
      '</div></section>'
    );
  }
  function log() {
    const records = gradeHistory();
    const items = records.flatMap((r) => r.items);
    const stats = [
      [records.length, t('Sessions', '完成次数')],
      [records.filter((r) => r.mode === 'mock').length, t('Mock tests', '模拟测试')],
      [new Set(records.map((r) => new Date(r.date).toDateString())).size, t('Practice days', '练习天数')]
    ];
    const filtered = records.filter((r) => filter === 'all' || r.mode === filter);
    return (
      heading(
        null,
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
          skills()
            .map((k) => {
              const latest = items.find((i) => i.key === k);
              return (
                '<a href="' +
                routeFor('practice/' + k) +
                '" class="skill-' +
                skill(k).art +
                '"><span class="part">' +
                partLabel(k) +
                '</span><strong>' +
                str(skill(k).title) +
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
        : records.length
          ? '<div class="empty-log">' + t('No sessions of this type yet.', '还没有这类练习记录。') + '</div>'
          : empty()) +
      '</div><p class="footnote">' +
      t(
        'This browser keeps the latest 120 sessions for each grade.',
        '这个浏览器会为每个级别保留最近 120 次练习。'
      ) +
      '</p></section>'
    );
  }
  function results(r) {
    if (!r) return log();
    const target = r.items.reduce((a, b) => (b.score < a.score ? b : a)).key;
    const set = canReplay(r) ? Music.makeSet(r.recipe) : null;
    function feedback(item) {
      const detail = Trainer.reviewItem(item, set?.[item.key], r.clef);
      return (
        '<div class="record-item"><div class="sequence-row skill-' +
        skill(item.key).art +
        '"><span class="step-part">' +
        skill(item.key).part +
        '</span><div><h3>' +
        str(skill(item.key).title) +
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
      heading(
        'SESSION REVIEW',
        t('Session review', '练习回顾'),
        gradeName() + ' · ' + testName(r) + ' · ' + day(r.date)
      ) +
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
      str(skill(target).title) +
      '</h2><p>' +
      str(skill(target).tip) +
      '</p>' +
      practiceLink(target, t('Practise this skill', '练这一项')) +
      '</aside><a class="text-link" href="#studio">' +
      t('Return to practice room', '返回练习室') +
      '</a>'
    );
  }
  function guideContent() {
    return (
      '<div class="dialog-head"><div>' +
      smallLabel('ABRSM  /  GRADE ' + grade, 'ABRSM  /  GRADE ' + grade) +
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
      skills()
        .map(
          (k) =>
            '<section class="guide-item skill-' +
            skill(k).art +
            '"><span class="part">' +
            partLabel(k) +
            '</span><h3>' +
            str(skill(k).title) +
            '</h3><p>' +
            str(skill(k).scope) +
            '</p><p>' +
            str(skill(k).tip) +
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
      '#page=' +
      (45 + grade) +
      '" target="_blank" rel="noopener noreferrer">' +
      t('ABRSM piano syllabus, page ' + (44 + grade), 'ABRSM 钢琴考试大纲，第 ' + (44 + grade) + ' 页') +
      '</a>'
    );
  }
  const isMock = (route) => route === 'mock' || route.endsWith('/mock');
  function sessionPage(route) {
    return route === 'session/mock' || route.startsWith('practice/') || route.startsWith('repeat/');
  }
  function canReplay(record) {
    return Music.validRecipe(record?.recipe);
  }
  function render() {
    const raw = location.hash.slice(1);
    const match = raw.match(/^grade\/(5|7|8)\/(.+)$/);
    const requested = match ? match[2] : raw;
    let level = match ? Number(match[1]) : grade;
    const practice = requested.match(/^practice\/(\w+)$/);
    if (!match && (practice || requested === 'session/mock')) level = 5;
    const repeat = requested.match(/^repeat\/([\w-]+)\/(\w+)$/);
    const result = requested.match(/^result\/([\w-]+)$/);
    let record;
    let next = 'studio';
    if (repeat || result) {
      record = history.find((r) => r.id === (repeat || result)[1]);
      if (record) level = recordGrade(record);
      const validTarget =
        repeat &&
        canReplay(record) &&
        (repeat[2] === 'mock' ? record.mode === 'mock' : record.items.some((i) => i.key === repeat[2]));
      next = (result && record) || validTarget ? requested : 'history';
    } else if (
      ['studio', 'history', 'mock', 'session/mock'].includes(requested) ||
      (practice && findSkill(level, practice[1]))
    ) {
      next = requested;
    }
    const change = page !== next || level !== grade;
    if (change && sessionPage(page)) window.Trainer.stop();
    if (grade !== level) {
      grade = level;
      storage.set('grade', String(grade));
    }
    page = next;
    shell();
    if (sessionPage(page)) {
      if (change)
        window.Trainer.start({
          mode: isMock(page) ? 'mock' : 'practice',
          grade,
          key: isMock(page) ? 'a' : page.split('/').at(-1),
          set: record ? Music.makeSet(record.recipe) : undefined,
          clef: record?.clef === 'bass' ? 'bass' : 'treble'
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
