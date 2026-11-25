(function (root) {
  'use strict';

  const pair = (en, zh) => ({ en, zh });
  const choose = (items, random) => items[Math.floor(random() * items.length)];
  const noteLetters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const naturals = [0, 2, 4, 5, 7, 9, 11];
  const minorScale = [0, 2, 3, 5, 7, 8, 10];
  const homeKeys = [['C', 60], ['D', 62], ['E♭', 63], ['F', 65], ['G', 67], ['A', 57], ['B♭', 58]];
  const pitchClass = number => ((number % 12) + 12) % 12;

  function shuffle(items, random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const swap = Math.floor(random() * (i + 1));
      [result[i], result[swap]] = [result[swap], result[i]];
    }
    return result;
  }

  function question(topic, prompt, correct, otherOptions, evidence, random) {
    const options = shuffle([correct, ...otherOptions], random);
    return { topic, prompt, options, answer: options.indexOf(correct), evidence };
  }

  function key(name, tonic, isMinor) {
    return { name, tonic, isMinor, label: pair(name + (isMinor ? ' minor' : ' major'), name + (isMinor ? ' 小调' : ' 大调')) };
  }

  function randomKey(random, isMinor) {
    const [name, tonic] = choose(homeKeys, random);
    return key(name, tonic, isMinor);
  }

  function degree(k, number) {
    const scale = k.isMinor ? minorScale : naturals;
    return k.tonic + Math.floor(number / 7) * 12 + scale[(number % 7 + 7) % 7];
  }

  function program(bpm, metre, length, events) {
    return { bpm, metre, length, events };
  }

  function event(at, pitch, duration, volume) {
    return { at, pitch, duration, volume };
  }

  const symbols = {
    I: [0, 0], Ib: [0, 1], Ic: [0, 2],
    II: [1, 0], IIb: [1, 1], IV: [3, 0],
    V: [4, 0], Vb: [4, 1], Vc: [4, 2], V7: [4, 0],
    VI: [5, 0]
  };
  const roles = [
    pair('tonic', '主和弦'), pair('supertonic', '上主和弦'), null, pair('subdominant', '下属和弦'),
    pair('dominant', '属和弦'), pair('submediant', '下中和弦')
  ];
  const positions = [pair('root position', '原位'), pair('first inversion', '第一转位'), pair('second inversion', '第二转位')];

  function chordLabel(id) {
    const [degreeIndex, inversion] = symbols[id];
    const role = id === 'V7' ? pair('dominant seventh', '属七和弦') : roles[degreeIndex];
    return pair(id + ' (' + role.en + ', ' + positions[inversion].en + ')', id + '（' + role.zh + '，' + positions[inversion].zh + '）');
  }

  function chord(k, id, topIndex = 0) {
    const [rootDegree, inversion] = symbols[id];
    const tones = [0, 2, 4].map(interval => degree(k, rootDegree + interval));
    if (rootDegree === 4) tones[1] = tones[0] + 4;
    if (id === 'V7') tones.push(tones[0] + 10);
    const bass = k.tonic - 12 + pitchClass(tones[inversion] - k.tonic);
    // In a seventh chord the upper voices supply the three notes missing from the bass.
    const upper = tones.length === 4 ? tones.slice(1) : tones;
    const top = upper[topIndex % upper.length];
    const pitches = [top];
    for (let i = 1; i < upper.length; i++) {
      const next = upper[(topIndex - i + upper.length) % upper.length];
      let pitch = next;
      while (pitch >= pitches[0]) pitch -= 12;
      pitches.unshift(pitch);
    }
    while (pitches[0] <= bass || pitches.at(-1) < k.tonic + 7) {
      for (let i = 0; i < pitches.length; i++) pitches[i] += 12;
    }
    return { id, pitches: [bass, ...pitches] };
  }

  function strike(events, voicing, at, duration, level = .68) {
    voicing.pitches.forEach((pitch, i) => {
      events.push(event(at, pitch, duration * .91, level * (i === 0 ? .90 : .77)));
    });
  }

  function examPrompt(k, phrase, repeats) {
    const events = [];
    strike(events, chord(k, 'I'), 0, 1.45);
    let at = 2.5;
    for (let i = 0; i < repeats; i++) {
      phrase.events.forEach(note => events.push({ ...note, at: at + note.at }));
      at += phrase.length + 1.5;
    }
    return program(phrase.bpm, phrase.metre, at - 1.5, events);
  }

  const cadences = {
    perfect: pair('Perfect', '正格终止'),
    imperfect: pair('Imperfect', '半终止'),
    interrupted: pair('Interrupted', '阻碍终止'),
    plagal: pair('Plagal', '变格终止')
  };
  const progressions = {
    7: {
      perfect: [['V', 'I'], ['V7', 'I']],
      imperfect: [['I', 'V'], ['IV', 'V'], ['VI', 'V']],
      interrupted: [['V', 'VI'], ['V7', 'VI']]
    },
    8: {
      perfect: [['Ic', 'V', 'I'], ['IIb', 'V7', 'I'], ['IV', 'V', 'I'], ['II', 'V', 'I']],
      imperfect: [['Vb', 'I', 'V'], ['Vc', 'Ib', 'V'], ['I', 'IIb', 'V'], ['VI', 'IV', 'V']],
      interrupted: [['IIb', 'V7', 'VI'], ['Ic', 'V', 'VI'], ['Ib', 'V', 'VI']],
      plagal: [['I', 'IV', 'I'], ['Ib', 'IV', 'I'], ['VI', 'IV', 'I']]
    }
  };
  const cadenceEvidence = {
    perfect: pair('The dominant leads to the tonic. Listen for the leading note rising a semitone into the final harmony.', '属和弦回到主和弦。听导音上行半音到主音，以及结尾的稳定感。'),
    imperfect: pair('The ending rests on the dominant. Its bass is scale degree five, leaving the phrase open.', '结尾停在属和弦，低音落在第五级，乐句仍有继续向前的感觉。'),
    interrupted: pair('The dominant points towards the tonic, but the bass moves up to scale degree six instead.', '属和弦制造回到主和弦的预期，低音却上行到第六级。'),
    plagal: pair('The bass descends from scale degree four to one. The tonic can be heard in both chords.', '低音从第四级回到第一级，两个和弦中都能听到主音。')
  };

  function endingMelody(a, k, metre) {
    const voice = a?.otherVoices?.at(-1);
    if (!voice) {
      return [[degree(k, 2) + 12, metre / 2], [degree(k, 1) + 12, metre / 4], [degree(k, 0) + 12, metre / 4]];
    }
    const skip = voice.beats.reduce((sum, beat) => sum + beat, 0) - metre;
    const motif = [];
    let at = 0;
    voice.notes.forEach((pitch, i) => {
      const end = at + voice.beats[i];
      if (end > skip) motif.push([pitch, end - Math.max(at, skip)]);
      at = end;
    });
    return motif;
  }

  function cadenceTasks(grade, random, a) {
    const continued = grade === 8;
    const k = continued ? key(a.key.en.split(' ')[0], a.tonic, a.isMinor) : randomKey(random, random() < .5);
    const bpm = continued ? a.bpm : choose([88, 92, 96], random);
    const metre = continued ? a.metre : choose([3, 4], random);
    const vocabulary = progressions[grade];
    const kind = choose(Object.keys(vocabulary), random);
    const progression = choose(vocabulary[kind], random).map(id => chord(k, id, id[0] === 'V' && id !== 'VI' && id !== 'V7' ? 1 : 0));
    const events = [];
    const motif = endingMelody(continued ? a : null, k, metre);
    strike(events, chord(k, 'I'), 0, metre);
    let at = 0;
    motif.forEach(([pitch, duration]) => {
      events.push(event(at, pitch, duration * .88, .85));
      at += duration;
    });
    const durations = grade === 7 ? [metre, metre] : [Math.ceil(metre / 2), Math.floor(metre / 2), metre];
    progression.forEach((harmony, i) => {
      const length = durations[i];
      strike(events, harmony, at, length, .81);
      at += length;
    });
    const phrase = program(bpm, metre, at, events);
    const cad = {
      type: 'cad', key: k.label, progression,
      programs: { prompt: examPrompt(k, phrase, 2), model: phrase },
      questions: [question(pair('Cadence', '终止式'), pair('Which cadence ends the phrase?', '乐句以哪种终止式结束？'),
        cadences[kind], Object.keys(vocabulary).filter(id => id !== kind).map(id => cadences[id]), cadenceEvidence[kind], random)]
    };
    const permitted = grade === 7 ? ['I', 'IV', 'V', 'V7', 'VI'] : Object.keys(symbols);
    const chordQuestions = progression.map(({ id }, i) => {
      const candidates = permitted.filter(other => other !== id);
      let distractors = candidates;
      if (grade === 8) {
        const sameRoot = candidates.filter(other => symbols[other][0] === symbols[id][0]);
        const otherRoots = shuffle(candidates.filter(other => !sameRoot.includes(other)), random);
        distractors = [...sameRoot, ...otherRoots].slice(0, 4);
      }
      const [rootDegree, inversion] = symbols[id];
      const bassDegree = (rootDegree + inversion * 2) % 7 + 1;
      const detail = chordLabel(id);
      const seventh = id === 'V7' ? pair(' There is also a seventh above the chord root.', '还可以听见和弦根音上方的七度音。') : pair('', '');
      return question(pair('Chord ' + (i + 1), '第 ' + (i + 1) + ' 个和弦'),
        pair('Identify chord ' + (i + 1) + (grade === 8 ? ' and its position.' : '.'), '辨别第 ' + (i + 1) + ' 个和弦' + (grade === 8 ? '及其转位。' : '。')),
        detail, distractors.map(chordLabel),
        pair('Scale degree ' + bassDegree + ' is in the bass. The harmony is ' + detail.en + '.' + seventh.en,
          '最低音是调内第 ' + bassDegree + ' 级。和声为 ' + detail.zh + '。' + seventh.zh), random);
    });
    const grouped = [];
    progression.forEach((voicing, i) => strike(grouped, voicing, i * 1.4, 1.33));
    const group = program(bpm, metre, progression.length * 1.4, grouped);
    const chordPrompt = examPrompt(k, group, 1);
    if (grade === 8) {
      let entry = chordPrompt.length + 2;
      progression.forEach(voicing => {
        strike(chordPrompt.events, voicing, entry, 1.6);
        entry += 4.5;
      });
      chordPrompt.length = entry - 2.9;
    }
    const ch = { type: 'ch', key: k.label, progression, questions: chordQuestions, programs: { prompt: chordPrompt, model: group } };
    return { cad, ch };
  }

  const relations = {
    dominant: pair('Dominant', '属调'), subdominant: pair('Subdominant', '下属调'),
    relativeMinor: pair('Relative minor', '关系小调'), relativeMajor: pair('Relative major', '关系大调')
  };

  function destination(start, relation, minorDominant) {
    const [steps, interval] = { dominant: [4, 7], subdominant: [3, 5], relativeMinor: [5, 9], relativeMajor: [2, 3] }[relation];
    const letter = (noteLetters.indexOf(start.name[0]) + steps) % 7;
    const accidental = pitchClass(start.tonic + interval - naturals[letter]);
    const name = noteLetters[letter] + (accidental === 1 ? '♯' : accidental === 11 ? '♭' : '');
    const isMinor = relation === 'relativeMinor' || (start.isMinor && (relation === 'subdominant' || relation === 'dominant' && minorDominant));
    let tonic = start.tonic + interval;
    if (tonic > 67) tonic -= 12;
    return key(name, tonic, isMinor);
  }

  function modulation(random, isMinor) {
    const start = randomKey(random, isMinor);
    const options = ['dominant', 'subdominant', isMinor ? 'relativeMajor' : 'relativeMinor'];
    const target = choose(options, random);
    const end = destination(start, target, random() < .5);
    const bpm = choose([94, 100, 104], random);
    const events = [];
    const harmony = ['I', 'IV', 'V7', 'I', 'IV', 'IIb', 'V7', 'I'];
    const melody = isMinor
      ? [[7, 6, 4], [5, 3, 0], [1, 4, 6], [7, 4, 2], [3, 5, 7], [8, 7, 5], [4, 1, 6], [7]]
      : [[2, 4, 2], [3, 5, 3], [4, 1, 1], [2, 1, 0], [5, 3, 0], [3, 2, 1], [1, 4, 6], [7]];
    const lengths = isMinor ? [.5, .5, 1] : [1, .5, .5];
    harmony.forEach((id, group) => {
      const at = group * 2;
      const area = group < 4 ? start : end;
      const length = 2;
      strike(events, chord(area, id), at, length, .59);
      let cursor = at;
      melody[group].forEach((step, i) => {
        const duration = melody[group].length === 1 ? length : lengths[i];
        const pitch = step === 6 && area.isMinor && id === 'V7' ? area.tonic + 11 : degree(area, step);
        events.push(event(cursor, pitch + 12, duration * .93, .86));
        cursor += duration;
      });
    });
    const phrase = program(bpm, 4, 16, events);
    const detail = {
      dominant: pair('Its tonic is a fifth above the opening tonic.', '新主音在原主音上方五度。'),
      subdominant: pair('Its tonic is a fourth above the opening tonic.', '新主音在原主音上方四度。'),
      relativeMinor: pair('Its tonic is a minor third below the opening tonic, with a minor final chord.', '新主音在原主音下方小三度，结尾是小三和弦。'),
      relativeMajor: pair('Its tonic is a minor third above the opening tonic, with a major final chord.', '新主音在原主音上方小三度，结尾是大三和弦。')
    }[target];
    return {
      type: isMinor ? 'minor' : 'mod', key: start.label, destination: end.label,
      questions: [question(pair('Modulation', '转调'), pair('To which key does the music modulate?', '乐段最后转到原调的哪个关系调？'),
        relations[target], options.filter(id => id !== target).map(id => relations[id]),
        pair('The final dominant seventh resolves into ' + end.label.en + '. ' + detail.en,
          '末尾的属七和弦解决到 ' + end.label.zh + '。' + detail.zh), random)],
      programs: { prompt: examPrompt(start, phrase, 1), model: phrase }
    };
  }

  const textures = {
    'Baroque': [pair('Two independent lines in dialogue', '两个独立声部相互应答'),
      pair('The lower line has its own rhythm and answers the upper idea. Both act as melodies.', '低声部以自己的节奏回应高声部，两条线都具有旋律性。')],
    'Classical': [pair('Tune above a regular accompaniment', '主旋律配以规律的伴奏'),
      pair('A clearly shaped tune is prominent in the right hand. The left hand keeps an orderly supporting pattern underneath it.', '右手旋律清晰突出，左手在下方反复弹奏有规律的伴奏音型。')],
    'Romantic': [pair('Singing tune over rolling arpeggios', '歌唱性旋律配以流动的分解和弦'),
      pair('The upper voice sustains long notes while the lower notes sweep through broken chords.', '上声部保持长音，下方的音符以分解和弦的形式来回流动。')],
    'Twentieth century': [pair('Angular tune against a repeated bass figure', '棱角分明的旋律配以固定低音音型'),
      pair('An insistent low pattern keeps returning while accented upper entries fall between its beats.', '低音不断重复短小的音型，上方的旋律用错开的重音与它形成对比。')],
    'Jig': [pair('Dance tune over a two pulse accompaniment', '舞曲旋律配以每小节两大拍的伴奏'),
      pair('A low note anchors the first big beat and a lighter chord answers on the second. The upper line moves across both groups of three quavers.', '每小节第一大拍有低音支撑，第二大拍用轻一些的和弦回应。上方旋律穿行在两组三个八分音符之间。')]
  };

  function compoundStudy(random) {
    const k = randomKey(random, random() < .5);
    const bpm = choose([120, 126, 132], random);
    // Each bar contains two dotted crotchet beats, represented internally as three crotchets.
    const bars = [
      [[0, .5], [2, .5], [4, .5], [5, 1], [4, .5]],
      [[3, 1], [2, .5], [1, .5], [3, .5], [4, .5]],
      [[5, .75], [4, .25], [3, .5], [2, 1], [1, .5]],
      [[1, .5], [4, .5], [6, .5], [7, 1.5]]
    ];
    const events = [];
    const notes = [];
    const beats = [];
    bars.forEach((bar, i) => {
      const at = i * 3;
      const harmony = chord(k, ['I', 'IV', 'IIb', 'V'][i]);
      events.push(event(at, harmony.pitches[0], .88, .70));
      if (i === 3) strike(events, chord(k, 'I'), at + 1.5, 1.45);
      else harmony.pitches.slice(1).forEach(pitch => events.push(event(at + 1.5, pitch, .65, .48)));
      let offset = 0;
      bar.forEach(([step, length]) => {
        const pitch = degree(k, step) + 12 + (i === 3 && step === 6 && k.isMinor ? 1 : 0);
        events.push(event(at + offset, pitch, length * .72, offset === 0 ? 1.08 : offset === 1.5 ? .96 : .84));
        if (i < 2) { notes.push(pitch); beats.push(length); }
        offset += length;
      });
    });
    const character = question(pair('Character', '性格'), pair('What character does the phrasing suggest?', '乐句表现出怎样的性格？'),
      pair('A lively, lilting dance', '轻快、有弹性的舞曲'), [pair('A heavy march', '沉重的进行曲'), pair('A slow, floating lullaby', '舒缓飘浮的摇篮曲')],
      pair('The tune bounces between short notes in threes and longer notes on the two main pulses of each bar.', '旋律在每大拍的三个细分音与较长的重拍音之间交替，带有鲜明的舞蹈律动。'), random);
    const detached = question(pair('Articulation', '奏法'), pair('How are the notes of the tune connected?', '旋律的音与音之间怎样衔接？'),
      pair('Mostly lightly detached', '大多轻巧、分离'), [pair('Legato throughout', '全段连奏'), pair('Sustained chords throughout', '全段持续柱式和弦')],
      pair('Each short note releases before the next attack. Listen to the gaps in the opening groups of quavers.', '开头每组八分音符之间留有空隙，每个音在下一个音弹响前已经收住。'), random);
    return { c: { piece: program(bpm, 3, 12, events), questions: [character, detached] },
      d: { notes, beats, bpm, metre: 6 } };
  }

  function rhythmPrograms(notes, beats, bpm, metre) {
    let at = 0;
    const events = notes.map((pitch, i) => {
      const bar = metre === 6 ? 3 : metre;
      const beat = at % bar;
      const note = event(at, pitch, beats[i] * .83, beat === 0 ? 1 : metre === 6 && beat === 1.5 ? .86 : .70);
      at += beats[i];
      return note;
    });
    const pause = 1.35;
    const repeat = events.map(note => ({ ...note, at: note.at + at + pause }));
    return { model: program(bpm, metre, at, events), prompt: program(bpm, metre, at * 2 + pause, [...events, ...repeat]) };
  }

  function listeningTasks(grade, random, baseListening) {
    const compound = random() < .25;
    const base = compound ? compoundStudy(random) : baseListening;
    const source = base.c.piece;
    const styleQuestion = base.c.questions[1];
    const style = compound ? 'Jig' : styleQuestion.options[styleQuestion.answer].en;
    const [texture, detail] = textures[style];
    const form = choose(['octave', 'repeat', 'middle'], random);
    const softReturn = random() < .5;
    const first = source.events.map(note => ({ ...note, pitch: note.pitch - 12, volume: note.volume * (softReturn ? .96 : .55) }));
    const middle = [];
    let returnAt = source.length;
    if (form === 'middle') {
      const tonic = source.events.at(-1).pitch - 12;
      [7, 5, 2, -1].forEach((interval, i) => {
        middle.push(event(returnAt + i * source.metre / 2, tonic + interval, source.metre * .46, .85));
      });
      returnAt += source.metre * 2;
    }
    const second = source.events.map(note => ({ ...note, pitch: note.pitch - (form === 'octave' ? 0 : 12),
      at: returnAt + note.at, volume: note.volume * (softReturn ? .45 : 1) }));
    const piece = { ...source, length: returnAt + source.length, events: [...first, ...middle, ...second] };
    const forms = {
      octave: [pair('The theme repeats immediately an octave higher', '主题随即在高八度重现'),
        pair('Rhythm, melodic outline and accompaniment repeat together. The entire second statement lies an octave above the first.', '节奏、旋律轮廓和伴奏一起重现。第二遍的整个乐段都比第一遍高一个八度。')],
      repeat: [pair('The passage repeats immediately in the same register', '乐段随即在相同音区重现'),
        pair('The opening notes return directly after the cadence, at their original pitch. The same phrase and accompaniment follow.', '终止式之后，开头的几个音随即以原音高重现，接着出现同样的乐句和伴奏。')],
      middle: [pair('A contrasting middle separates two statements of the opening theme', '两次主题之间插入了一个对比段落'),
        pair('At the centre the accompaniment drops out. A single line descends in longer notes, then the opening theme and its bass come back together.', '中间的伴奏停下，留下单独的旋律以时值较长的音下行。随后开头的主题与低声部一起回来。')]
    };
    const structure = question(pair('Structure', '结构'), pair('How is the piece put together?', '这首乐曲的段落是怎样组织的？'),
      forms[form][0], Object.keys(forms).filter(id => id !== form).map(id => forms[id][0]), forms[form][1], random);
    const textureQ = question(pair('Texture', '织体'), pair('How do the hands work together in the opening theme?', '开头主题中，钢琴左右手之间是什么关系？'),
      texture, [pair('A single tune in unison throughout', '始终用齐奏弹同一条旋律'), pair('All parts move together in block chords', '所有声部始终以相同节奏弹柱式和弦')], detail, random);
    const dynamics = question(pair('Dynamics', '力度'), pair('Compare the two statements of the theme. How does the second begin?', '比较主题的两次陈述，第二次开头的力度怎样？'),
      softReturn ? pair('Like a softer echo', '变轻，形成回声') : pair('With a louder attack', '以更强的力度开始'),
      [softReturn ? pair('With a louder attack', '以更强的力度开始') : pair('Like a softer echo', '变轻，形成回声'), pair('At the same level', '保持相同力度')],
      softReturn ? pair('Compare the first notes of both statements. The returning melody and bass have a softer attack.', '对比两次主题开头的音，重现时旋律与低音都弹得更轻。')
        : pair('The opening theme is quite soft. When it returns the tune and bass attack more strongly together.', '开头的主题力度较轻，重现时旋律与低音都弹得更强。'), random);
    const extras = base.c.questions.filter(q => !['Tempo', 'Dynamics'].includes(q.topic.en));
    const slows = !!piece.ritard;
    const tempo = question(pair('Tempo', '速度'), pair('What happens to the underlying pulse?', '贯穿乐段的基本拍如何变化？'),
      slows ? pair('It broadens towards the close', '接近结尾时渐慢') : pair('It remains steady', '保持稳定'),
      [pair('It quickens towards the close', '接近结尾时渐快'), slows ? pair('It remains steady', '保持稳定') : pair('It slows to a halt', '逐渐慢到停止')],
      slows ? pair('The beats grow farther apart during the second statement, giving the closing phrase time to settle.', '第二遍乐段进行中，基本拍之间的间隔逐渐增大，收尾变得舒缓。')
        : pair('Keep tapping through changes of note length. Your tap can stay regular throughout both statements.', '尽管旋律音符有长有短，跟着基本拍敲击，两遍都能保持相同速度。'), random);
    const bank = [textureQ, structure, dynamics, tempo, ...extras];
    if (grade === 8) {
      const observations = [textureQ, structure, ...extras, dynamics].map(q => q.evidence);
      return { desc: { type: 'desc', piece, observations, programs: { prompt: piece, model: piece } } };
    }
    const notes = base.d.notes.map(pitch => pitch - 12);
    return {
      c: { type: 'c', piece, questions: shuffle(bank, random).slice(0, 2), programs: { prompt: piece, model: piece } },
      d: { ...base.d, type: 'd', piece, notes, programs: rhythmPrograms(notes, base.d.beats, base.d.bpm, base.d.metre) }
    };
  }

  function make(grade, random, baseListening, a) {
    const set = { ...cadenceTasks(grade, random, a), mod: modulation(random, false) };
    if (grade === 8) set.minor = modulation(random, true);
    return { ...set, ...listeningTasks(grade, random, baseListening) };
  }

  root.AdvancedListening = { make };
})(typeof window === 'undefined' ? globalThis : window);
