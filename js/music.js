(function (root) {
  'use strict';

  const pair = (en, zh) => ({ en, zh });
  const pick = (items, random) => items[Math.floor(random() * items.length)];
  const major = [0, 2, 4, 5, 7, 9, 11];
  const minor = [0, 2, 3, 5, 7, 8, 10];
  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const mod = (n, divisor) => ((n % divisor) + divisor) % divisor;

  function shuffled(items, random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // MIDI, diatonic position (C4 = 28), and the number of sharps or flats.
  const keys = [
    ['C', 60, 28, 0], ['G', 67, 32, 1], ['D', 62, 29, 2], ['A', 57, 26, 3],
    ['F', 65, 31, -1], ['B♭', 58, 27, -2], ['E♭', 63, 30, -3],
    ['A', 57, 26, 0, true], ['E', 64, 30, 1, true], ['B', 59, 27, 2, true],
    ['F♯', 66, 31, 3, true], ['D', 62, 29, -1, true],
    ['G', 55, 25, -2, true], ['C', 60, 28, -3, true]
  ];

  function degree(tonic, number, scale) {
    return tonic + 12 * Math.floor(number / 7) + scale[mod(number, 7)];
  }

  function spelling(midi, position, withOctave = false) {
    const letter = mod(position, 7);
    const octave = Math.floor(position / 7);
    const natural = 12 * (octave + 1) + major[letter];
    const accidental = midi === natural ? '' : midi > natural ? '♯' : '♭';
    return letters[letter] + accidental + (withOctave ? octave : '');
  }

  function exercise(type, key, degrees, beats, bpm, metre) {
    const [name, tonic, position, signature, isMinor] = key;
    const scale = isMinor ? minor : major;
    const notes = degrees.map(n => degree(tonic, n, scale));
    const positions = degrees.map(n => n + position);
    const start = spelling(notes[0], positions[0]);
    return {
      type, notes, beats, bpm, metre, tonic, positions, signature, isMinor: !!isMinor,
      key: pair(name + (isMinor ? ' minor' : ' major'), name + (isMinor ? ' 小调' : ' 大调')),
      startName: pair(start, start)
    };
  }

  const memoryPhrases = [
    [2, [0, 2, 4, 5, 4, 2, 1, 0], [1, .5, .5, 1, 1, 1.5, .5, 2]],
    [3, [2, 3, 4, 6, 5, 4, 3, 1, 2, 1, 0], [1, .5, .5, 1, 1.5, .5, 1, 1, 1, 1, 3]],
    [4, [0, 1, 2, 4, 3, 2, 1, 4, 5, 7, 6, 4, 2, 1, 0], [1, .5, .5, 2, 1, .5, .5, 2, 1, .5, .5, 2, .5, .5, 3]],
    [2, [4, 2, 1, 0, 2, 4, 3, 2, 1, 0], [.5, .5, .5, .5, 1, 1, 1, .5, .5, 2]],
    [3, [0, 2, 1, 2, 4, 5, 3, 4, 2, 1, 0], [1.5, .5, 1, 1, 1, 1, 1, .5, .5, 1, 3]],
    [4, [4, 5, 4, 2, 1, 2, 3, 4, 5, 4, 3, 1, 0], [1, 1, .5, .5, 1, 1.5, .5, 1, 1, 1, 2, 1, 4]],
    [3, [4, 6, 7, 5, 4, 3, 2, 0, 1, 0], [1, 1, 1, 2, .5, .5, 1, 1, 1, 3]],
    [2, [2, 1, 2, 4, 5, 4, 2, 1, 0], [.5, .5, 1, .5, .5, 1, 1.5, .5, 2]]
  ];

  function memory(random) {
    const [metre, sequence, beats] = pick(memoryPhrases, random);
    const degrees = sequence.slice();
    // Vary an inner note while preserving the cadence and a singable contour.
    const i = 1 + Math.floor(random() * (degrees.length - 3));
    const nearby = [degrees[i] - 1, degrees[i], degrees[i] + 1].filter(n =>
      n >= 0 && n <= 7 && Math.abs(n - degrees[i - 1]) <= 3 && Math.abs(n - degrees[i + 1]) <= 3 &&
      n !== degrees[i - 1] && n !== degrees[i + 1]);
    if (nearby.length) degrees[i] = pick(nearby, random);
    return exercise('a', pick(keys, random), degrees, beats.slice(), pick([96, 100, 104, 108], random), metre);
  }

  function sight() {
    const sequences = [];
    function extend(path) {
      if (path.length === 6) {
        if (path[5] === 0 && new Set(path).size >= 4) sequences.push(path);
        return;
      }
      const prev = path[path.length - 1];
      for (let n = -3; n <= 4; n++) {
        const gap = Math.abs(n - prev);
        if (gap === 1 || gap === 2 || (prev === -3 && n === 0)) extend([...path, n]);
      }
    }
    extend([0]);
    return sequences;
  }
  const sightPaths = sight();
  const sightKeys = keys.filter(k => !k[4] && Math.abs(k[3]) <= 2);

  const advancedSightKeys = [...keys, ['E', 64, 30, 4], ['A♭', 56, 26, -4],
    ['C♯', 61, 28, 4, true], ['F', 65, 31, -4, true]];

  // Each voice has four complete bars of scale degrees and quarter-note durations.
  const ensemblePhrases = [
    {
      metre: 3,
      low: [[[0,1],[2,.5],[1,.5],[0,1]], [[3,1],[2,1],[1,1]], [[4,1.5],[3,.5],[1,1]], [[4,1],[0,2]]],
      middle: [[[9,1.5],[8,.5],[7,1]], [[7,2],[8,1]], [[8,1],[7,1],[6,1]], [[8,1],[7,2]]],
      high: [[[11,2],[9,1]], [[12,1],[11,.5],[10,.5],[10,1]], [[13,1],[12,1],[11,1]], [[11,1],[9,2]]]
    }, {
      metre: 4,
      low: [[[0,2],[1,1],[2,1]], [[3,1.5],[2,.5],[1,2]], [[2,1],[3,1],[4,2]], [[1,1],[4,1],[0,2]]],
      middle: [[[9,1],[8,.5],[7,.5],[6,1],[7,1]], [[7,1],[9,1],[8,2]], [[7,1.5],[8,.5],[6,2]], [[8,1],[6,1],[7,2]]],
      high: [[[11,1.5],[12,.5],[13,1],[11,1]], [[12,2],[10,1],[12,1]], [[11,1],[12,1],[13,2]], [[10,1],[11,1],[9,2]]]
    }, {
      metre: 2,
      low: [[[2,.5],[1,.5],[0,1]], [[3,1],[5,1]], [[4,.5],[3,.5],[1,1]], [[4,1],[0,1]]],
      middle: [[[7,1],[9,1]], [[10,.5],[9,.5],[7,1]], [[8,1.5],[6,.5]], [[8,1],[7,1]]],
      high: [[[11,.5],[10,.5],[11,1]], [[12,1],[9,.5],[10,.5]], [[11,1],[10,1]], [[11,1],[9,1]]]
    }, {
      metre: 3,
      low: [[[0,1.5],[1,.5],[2,1]], [[5,2],[3,1]], [[2,1],[3,.5],[2,.5],[1,1]], [[4,1],[0,2]]],
      middle: [[[9,1],[8,1],[7,1]], [[7,.5],[8,.5],[9,1],[10,1]], [[9,1],[7,1],[6,1]], [[8,1],[7,2]]],
      high: [[[11,2],[12,1]], [[12,1],[11,1],[12,1]], [[11,1.5],[10,.5],[11,1]], [[13,1],[14,2]]]
    }, {
      metre: 4,
      low: [[[0,1],[4,.5],[3,.5],[2,2]], [[3,1],[5,1],[4,1],[1,1]], [[2,1.5],[1,.5],[0,1],[3,1]], [[1,1],[4,1],[0,2]]],
      middle: [[[9,2],[7,1],[9,1]], [[10,1.5],[9,.5],[8,2]], [[7,1],[9,1],[7,.5],[8,.5],[7,1]], [[8,1],[6,1],[7,2]]],
      high: [[[11,1],[13,1],[11,.5],[10,.5],[11,1]], [[12,2],[13,1],[10,1]], [[11,2],[9,1],[12,1]], [[10,1],[11,1],[9,2]]]
    }, {
      metre: 3,
      low: [[[0,1],[1,.5],[2,.5],[3,1]], [[4,1],[5,1],[6,1]], [[7,1.5],[5,.5],[3,1]], [[4,1],[0,2]]],
      middle: [[[7,1],[9,1],[11,1]], [[12,1],[11,.5],[12,.5],[13,1]], [[14,1],[12,1],[10,1]], [[8,1],[7,2]]],
      high: [[[11,1],[13,1],[14,1]], [[14,1.5],[15,.5],[15,1]], [[16,1.5],[15,.5],[14,1]], [[11,1],[9,2]]]
    }
  ];

  function varySungLine(bars, random) {
    const notes = bars.flat();
    const degrees = notes.map(([n]) => n);
    const min = Math.min(...degrees), max = Math.max(...degrees);
    const choices = [];
    const cadenceStart = notes.length - bars.at(-1).length;
    for (let i = 0; i < cadenceStart; i++) {
      const [current, duration] = notes[i];
      if (duration < 1) continue;
      const next = notes[i + 1][0];
      for (const neighbour of [current - 1, current + 1]) {
        if (neighbour >= min && neighbour <= max && neighbour !== next && Math.abs(next - neighbour) <= 2) {
          choices.push({i, neighbour});
        }
      }
    }
    if (choices.length) {
      const {i, neighbour} = pick(choices, random);
      const [current, duration] = notes[i];
      notes.splice(i, 1, [current, duration - .5], [neighbour, .5]);
    }
    return notes;
  }

  function ensemble(type, grade, random) {
    const phrase = pick(ensemblePhrases, random);
    const key = pick(type === 'b' ? advancedSightKeys : keys, random).slice();
    const upperTarget = grade === 7 && type === 'b';
    // Put the written treble part near middle C and the memory bass in the octave below.
    const octave = type === 'b' ? (key[1] < 60 ? 1 : 0) : (key[1] >= 60 ? -1 : 0);
    key[1] += octave * 12;
    key[2] += octave * 7;
    const bpm = pick([84, 88, 92, 96], random);
    function voice(line) {
      const degrees = line.map(([n]) => n - (upperTarget ? 7 : 0));
      const ex = exercise(type, key, degrees, line.map(([,length]) => length), bpm, phrase.metre);
      degrees.forEach((n,i) => {
        if (ex.isMinor && mod(n,7) === 6 && degrees[i+1] === n+1) ex.notes[i]++;
      });
      return ex;
    }
    const low = voice(upperTarget ? phrase.low.flat() : varySungLine(phrase.low, random));
    const middle = voice(upperTarget ? varySungLine(phrase.middle, random) : phrase.middle.flat());
    const target = upperTarget ? middle : low;
    const others = upperTarget ? [low] : [middle];
    if (type === 'a' && grade === 8) others.push(voice(phrase.high.flat()));
    target.grade = grade;
    const start = spelling(target.notes[0], target.positions[0]);
    target.startName = pair(start, start);
    target.otherVoices = others.map(({notes, beats}) => ({notes, beats}));
    return target;
  }

  const periods = [
    pair('Baroque', '巴洛克时期'), pair('Classical', '古典主义时期'),
    pair('Romantic', '浪漫主义时期'), pair('Twentieth century', '二十世纪')
  ];
  const features = {
    dynamics: pair('Dynamics', '力度'), articulation: pair('Articulation', '奏法'),
    tempo: pair('Tempo', '速度'), tonality: pair('Tonality', '调性'), character: pair('Character', '性格')
  };

  const periodClues = [
    pair('Follow the lower line. It answers the upper voice with its own moving notes, creating the two independent lines of a Baroque invention.',
      '留意低声部，它用流动的音符回应高声部。两条独立的旋律线是巴洛克创意曲的常见写法。'),
    pair('A balanced tune comes in short phrases above a repeating accompaniment. The clear cadence and regular phrasing suggest the Classical period.',
      '主旋律由均衡的短句构成，下方有规律重复的伴奏。清楚的终止和对称的乐句带有古典主义风格。'),
    pair('A singing upper line stretches across broad, broken chords. The changing weight and pace of the phrase suggest a Romantic piano miniature.',
      '上方是歌唱般的长线条，下方是宽广的分解和弦。力度和速度随乐句起伏，带有浪漫主义钢琴小品的风格。'),
    pair('Listen for the repeating bass pattern, displaced accents and chords built from fourths. Together they suggest a twentieth century piano style.',
      '听一听反复的低音音型、错开的重音和四度叠置的和弦。这些线索共同指向二十世纪的钢琴风格。')
  ];

  // Each entry is a scale degree and its length in beats. Each inner array is one bar.
  const studies = [
    {
      style: 0, tonic: 62, scale: minor, metre: 2, bpm: 104,
      bars: [
        [[0,.5],[1,.25],[2,.25],[3,.5],[1,.5]], [[2,.5],[3,.25],[4,.25],[5,.5],[4,.5]],
        [[3,.5],[2,.5],[1,.5],[4,.5]], [[2,.5],[1,.5],[0,1]]
      ],
      bass: [
        [[0,.75],[4,.25],[-2,.5],[-3,.5]], [[0,.5],[1,.25],[2,.25],[3,.5],[1,.5]],
        [[-2,.75],[0,.25],[-3,1]], [[-2,.5],[-3,.5],[0,1]]
      ],
      harmony: [0,2,4,0], features: ['tempo','tonality']
    }, {
      style: 0, tonic: 65, scale: major, metre: 3, bpm: 98,
      bars: [
        [[4,.5],[5,.5],[4,.5],[2,.5],[3,1]], [[2,.5],[3,.5],[2,.5],[0,.5],[1,1]],
        [[3,.5],[4,.5],[5,1],[4,1]], [[2,1],[1,1],[0,1]]
      ],
      bass: [
        [[0,1],[2,.5],[0,.5],[-2,1]], [[0,.5],[1,.5],[0,.5],[-2,.5],[-1,1]],
        [[-2,1],[0,1],[1,.5],[-3,.5]], [[0,1],[-3,1],[0,1]]
      ],
      harmony: [0,2,4,0], features: ['dynamics','tempo'], echo: true
    }, {
      style: 1, tonic: 60, scale: major, metre: 4, bpm: 108,
      bars: [
        [[2,1],[4,.5],[2,.5],[1,1],[0,1]], [[1,.5],[2,.5],[3,1],[4,2]],
        [[4,1],[6,.5],[4,.5],[5,1],[3,1]], [[2,.5],[1,.5],[0,3]]
      ],
      harmony: [0,4,4,0], features: ['articulation','tonality'], short: true
    }, {
      style: 1, tonic: 62, scale: major, metre: 3, bpm: 112,
      bars: [
        [[0,1],[2,1],[4,1]], [[5,1.5],[4,.5],[3,1]],
        [[4,.5],[3,.5],[2,1],[1,1]], [[2,1],[1,1],[0,1]]
      ],
      harmony: [0,3,4,0], features: ['character','tempo']
    }, {
      style: 2, tonic: 63, scale: major, metre: 3, bpm: 74,
      bars: [
        [[2,1.5],[3,.5],[4,1]], [[5,2],[4,.5],[2,.5]],
        [[6,1],[5,.5],[4,.5],[3,1]], [[2,1.5],[1,.5],[0,1]]
      ],
      harmony: [0,3,4,0], features: ['dynamics','tempo','articulation']
    }, {
      style: 2, tonic: 64, scale: minor, metre: 4, bpm: 78,
      bars: [
        [[4,2],[3,.5],[2,.5],[1,1]], [[2,1.5],[3,.5],[4,2]],
        [[5,1.5],[4,.5],[3,1],[1,1]], [[2,1],[1,1],[0,2]]
      ],
      harmony: [0,5,4,0], features: ['character','tonality','dynamics']
    }, {
      style: 3, tonic: 60, scale: minor, metre: 2, bpm: 116,
      bars: [
        [[0,.75],[4,.25],[3,.5],[1,.5]], [[0,.5],[5,.75],[3,.25],[4,.5]],
        [[6,.5],[3,.5],[4,.75],[1,.25]], [[2,.5],[1,.5],[0,1]]
      ],
      harmony: [0,1,3,0], features: ['articulation','character'], short: true
    }, {
      style: 3, tonic: 65, scale: minor, metre: 4, bpm: 108,
      bars: [
        [[0,.5],[3,1],[4,.5],[1,.5],[5,1],[4,.5]], [[2,.5],[4,1],[5,.5],[3,1],[1,1]],
        [[0,.5],[3,1],[6,.5],[4,.5],[2,1],[1,.5]], [[4,1],[3,.5],[1,.5],[0,2]]
      ],
      harmony: [0,1,3,0], features: ['tempo','character']
    }
  ];

  const concepts = {
    steady: pair('The pulse stays steady', '速度保持稳定'),
    faster: pair('It gets faster towards the end', '结尾渐快'),
    slower: pair('It slows down towards the end', '结尾渐慢'),
    loud: pair('It grows louder', '力度逐渐增强'), soft: pair('It grows softer', '力度逐渐减弱'),
    echo: pair('The reply is suddenly quieter', '回应的乐句突然变轻'),
    short: pair('Short and detached', '短促、分离'), joined: pair('Smooth and connected', '平滑、连贯'),
    alternate: pair('Alternating detached and smooth phrases', '断奏和连奏的乐句交替'),
    minor: pair('Minor', '小调'), major: pair('Major', '大调'),
    changing: pair('It moves from minor to major', '从小调转为大调'),
    dance: pair('Graceful, like a dance', '优雅，带有舞曲感'), wistful: pair('Reflective and wistful', '沉静，带有惆怅感'),
    restless: pair('Energetic and edgy', '活跃，富有棱角')
  };
  const prompts = {
    dynamics: pair('What happens to the loudness?', '这段音乐的力度怎样变化？'),
    articulation: pair('How are the melody notes played?', '这段旋律的音与音之间是怎样连接的？'),
    tempo: pair('What happens to the speed?', '这段音乐的速度怎样变化？'),
    tonality: pair('Which description fits the tonality?', '哪个选项最符合这段音乐的调性？'),
    character: pair('Which character best fits the music?', '哪个选项最符合这段音乐的性格？')
  };
  const alternatives = {
    dynamics: ['loud','soft','echo'], articulation: ['short','joined','alternate'],
    tempo: ['steady','faster','slower'], tonality: ['minor','major','changing'],
    character: ['dance','wistful','restless']
  };

  function question(topic, prompt, options, correct, evidence, random) {
    const mixed = shuffled(options, random);
    return { topic, prompt, options: mixed, answer: mixed.indexOf(correct), evidence };
  }

  function featureQuestion(study, random) {
    const feature = pick(study.features, random);
    const romantic = study.style === 2;
    let correct, evidence;
    switch (feature) {
      case 'tempo':
        correct = romantic ? 'slower' : 'steady';
        evidence = romantic
          ? pair('Tap along. The gaps between beats widen over the last two bars as the ending relaxes.', '跟着拍一拍。最后两个小节的拍点逐渐拉开，句末放慢。')
          : pair('Tap through the short and long notes. The underlying beat keeps the same speed.', '试着在长音和短音下持续打拍，基本拍的速度始终一致。');
        break;
      case 'dynamics':
        correct = study.echo ? 'echo' : study.scale === major ? 'loud' : 'soft';
        evidence = study.echo
          ? pair('The second bar answers the first at a noticeably lower level, like an echo.', '第二小节回应第一小节时突然变轻，像一个回声。')
          : correct === 'loud'
            ? pair('Compare the opening with the final phrase. Both the tune and its arpeggios build in volume.', '对比开头与末句，旋律和分解和弦的音量都逐渐增强。')
            : pair('The melody and rolling accompaniment retreat together from a full opening to a quiet close.', '旋律与流动的伴奏一起减弱，从饱满的开头走向安静的结尾。');
        break;
      case 'tonality':
        correct = study.scale === major ? 'major' : 'minor';
        evidence = correct === 'major'
          ? pair('The third above the home note is a major third. Hear it in the tune and the final harmony.', '留意主音上方的大三度，在旋律和末尾的主和弦中都可以听见。')
          : pair('Hear the home note at the end, then recall the lowered third above it in the melody. That interval gives the tune its minor colour.', '先听结尾的主音，再回想旋律中它上方的小三度。这个音程赋予旋律小调的色彩。');
        break;
      case 'articulation':
        correct = study.short ? 'short' : 'joined';
        evidence = study.short
          ? pair('Small silences separate the melody notes. Each attack stands out clearly.', '旋律的音符之间留有短暂空隙，每个音的起音都很清楚。')
          : pair('Each melody note sustains almost into the next, forming a continuous singing line.', '旋律的每个音几乎保持到下一个音出现，形成连贯的歌唱线条。');
        break;
      case 'character':
        correct = romantic ? 'wistful' : study.style === 1 ? 'dance' : 'restless';
        evidence = romantic
          ? pair('Long melody notes, minor harmony and a softening close give the phrase its reflective character.', '悠长的旋律、小调和声与渐弱的结尾营造出沉思的气氛。')
          : study.style === 1
            ? pair('Hear a stronger bass beat followed by two light chords. Each group of three gives the tune a dance lilt.', '较重的低音之后是两个轻巧的和弦，三拍的律动让旋律带有舞曲感。')
            : pair('Angular jumps and accents away from the strong beat give the music a restless edge.', '旋律的跳进和偏离强拍的重音使音乐显得活跃而棱角分明。');
        break;
    }
    return question(features[feature], prompts[feature], alternatives[feature].map(k => concepts[k]), concepts[correct], evidence, random);
  }

  function accompaniment(study, offset) {
    const events = [];
    const { tonic, metre, style, scale } = study;
    function add(bar, beat, pitch, duration, volume = .55) {
      events.push({ at: bar * metre + beat, pitch, duration, volume });
    }
    study.harmony.forEach((chord, bar) => {
      const bass = degree(tonic - 12, chord, scale);
      const third = degree(tonic - 12, chord + 2, scale);
      const fifth = degree(tonic - 12, chord + 4, scale);
      if (style === 0) {
        let cursor = 0;
        study.bass[bar].forEach(([step, length]) => {
          const pitch = degree(tonic - 12, step, scale);
          add(bar, cursor, pitch, length * .89, .59);
          cursor += length;
        });
      } else if (style === 1 && metre === 4) {
        const pattern = [bass - 12, fifth, third, fifth];
        for (let i = 0; i < metre * 2; i++) add(bar, i / 2, pattern[i % 4], .40, i % 4 ? .38 : .52);
      } else if (style === 1) {
        add(bar, 0, bass - 12, .84);
        [1,2].forEach(beat => [third,fifth].forEach(pitch => add(bar, beat, pitch, .49, .40)));
      } else if (style === 2) {
        const arpeggio = [bass - 12, fifth - 12, third, fifth, bass + 12, fifth, third, fifth - 12];
        for (let i = 0; i < metre * 2; i++) add(bar, i / 2, arpeggio[i], .78, .50);
      } else {
        for (let i = 0; i < metre; i += 2) {
          add(bar, i, bass - 12, .54, .70);
          const chordAt = i + (bar % 2 ? .5 : .75);
          [bass, bass + 5, bass + 10].forEach(pitch => add(bar, chordAt, pitch, .38, .43));
          add(bar, i + 1.5, bass - 5, .35, .52);
        }
      }
    });
    events.forEach(e => { e.pitch += offset; });
    return events;
  }

  function listening(study, random) {
    const { style, metre, tonic, scale, bpm } = study;
    const offset = pick([-2, 0, 2], random);
    const events = accompaniment(study, offset);
    const notes = [], beats = [];
    let at = 0;
    study.bars.forEach((bar, index) => {
      bar.forEach(([step, duration]) => {
        const pitch = degree(tonic + 12 + offset, step, scale);
        const accent = at % metre === 0 ? 1.12 : style === 3 && at % 1 ? 1.22 : 1;
        events.push({ at, pitch, duration: duration * (study.short ? .50 : style === 2 ? 1.00 : .88), volume: accent });
        if (index < 2) { notes.push(pitch); beats.push(duration); }
        at += duration;
      });
    });
    events.forEach(e => {
      if (study.echo && Math.floor(e.at / metre) % 2) e.volume *= .38;
      if (style === 2) {
        const progress = e.at / (metre * 4);
        e.volume *= scale === major ? .37 + .83 * progress : 1.12 - .79 * progress;
      }
    });
    const piece = { events, bpm, metre, length: at, ritard: style === 2 };
    const styleQuestion = question(pair('Style and period','风格与时期'),
      pair('Which period does the writing suggest?', '这段音乐最接近哪个时期的风格？'),
      periods, periods[style], periodClues[style], random);
    return {
      c: { type: 'c', piece, questions: [featureQuestion(study, random), styleQuestion] },
      d: { type: 'd', piece, notes, beats, bpm, metre }
    };
  }

  const studyDecks = {5: [], 7: [], 8: []};
  function validRecipe(saved) {
    const known = saved?.version === 1 || (saved?.version === 2 && [7,8].includes(saved.grade));
    return known && Number.isInteger(saved.seed) && saved.seed >= 0 &&
      saved.seed <= 0xffffffff && Number.isInteger(saved.study) && saved.study >= 0 && saved.study < studies.length;
  }
  function makeSet(saved, grade = 5) {
    let seed, study;
    if (validRecipe(saved)) {
      grade = saved.version === 1 ? 5 : saved.grade;
      seed = saved.seed;
      study = saved.study;
    } else {
      if (![7,8].includes(grade)) grade = 5;
      if (!studyDecks[grade].length) studyDecks[grade] = shuffled(studies.map((_, i) => i), Math.random);
      study = studyDecks[grade].pop();
      seed = Math.floor(Math.random() * 0x100000000);
    }
    let state = seed;
    function random() {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 0x100000000;
    }
    if (grade !== 5) {
      const a = ensemble('a', grade, random);
      const b = ensemble('b', grade, random);
      const baseListening = listening(studies[study], random);
      return {grade, recipe: {version: 2, grade, seed, study}, a, b,
        ...root.AdvancedListening.make(grade, random, baseListening, a)};
    }
    return {
      recipe: { version: 1, seed, study },
      a: memory(random),
      b: exercise('b', pick(sightKeys, random), pick(sightPaths, random), [1,1,1,1,1,1], 80, 0),
      ...listening(studies[study], random)
    };
  }

  function pitches(ex, clef = 'treble') {
    const offset = ex.type === 'b' && clef === 'bass' ? -12 : 0;
    return ex.notes.map(note => note + offset);
  }

  function noteNames(ex, clef = 'treble') {
    const shift = ex.type === 'b' && clef === 'bass' ? 7 : 0;
    return pitches(ex, clef).map((midi, i) => spelling(midi, ex.positions[i] - shift, true));
  }

  function onsets(ex) {
    let beat = 0;
    return ex.beats.map(duration => {
      const start = beat * 60 / ex.bpm;
      beat += duration;
      return start;
    });
  }

  function scoreLayout(ex, left, barWidth) {
    const bars = [];
    const written = new Map();
    const signatureSteps = (ex.signature < 0 ? [6,2,5,1] : [3,0,4,1]).slice(0, Math.abs(ex.signature));
    let cursor = 0;
    ex.positions.forEach((position, i) => {
      const beat = cursor % ex.metre;
      if (beat === 0) {
        bars.push([]);
        written.clear();
      }
      const letter = mod(position, 7);
      const natural = 12 * (Math.floor(position / 7) + 1) + major[letter];
      const alteration = ex.notes[i] - natural;
      const keySign = signatureSteps.includes(letter) ? Math.sign(ex.signature) : 0;
      const sign = alteration === (written.get(position) ?? keySign) ? null : alteration;
      bars.at(-1).push({beat, sign});
      written.set(position, alteration);
      cursor += ex.beats[i];
    });
    return bars.flatMap((bar, index) => {
      const spaceForSigns = bar.filter(note => note.sign !== null).length * 9;
      const spacing = (barWidth - spaceForSigns) / ex.metre;
      let inset = left + index % 2 * barWidth + 12;
      return bar.map(({beat, sign}) => {
        if (sign !== null) inset += 9;
        return {beat, sign, row: Math.floor(index / 2), x: inset + beat * spacing};
      });
    });
  }

  function score(ex, clef = 'treble', lang = 'en') {
    const bass = clef === 'bass';
    const bottom = bass ? 18 : 30;
    const yAt = position => 70 - (position - bottom) * 4;
    const parts = [];
    function line(x1, y1, x2, y2, width = 1) {
      parts.push('<path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" fill="none" stroke="currentColor" stroke-width="' + width + '"/>');
    }
    function accidental(x, y, sign) {
      if (sign > 0) {
        line(x - 2.4, y - 8, x - 2.4, y + 8, 1);
        line(x + 2.4, y - 9, x + 2.4, y + 7, 1);
        line(x - 4.3, y - 2, x + 4.3, y - 4, 2.5);
        line(x - 4.3, y + 4, x + 4.3, y + 2, 2.5);
      } else if (sign < 0) {
        line(x - 2, y - 12, x - 2, y + 4.5, 1.3);
        parts.push('<path d="M' + (x-2) + ' ' + (y-.8) + 'c6-7 10 0 0 5.3c4-4 5-9 0-5.3Z"/>');
      } else {
        line(x - 2, y - 8.5, x - 2, y + 4, 1.1);
        line(x + 2, y - 4, x + 2, y + 8.5, 1.1);
        line(x - 2, y - 2, x + 2, y - 3.5, 2.1);
        line(x - 2, y + 3.5, x + 2, y + 2, 2.1);
      }
    }
    function staff() {
      for (let i = 0; i < 5; i++) line(8, 38 + i * 8, 385, 38 + i * 8);
      if (bass) {
        parts.push('<path d="M18 47 C16 39 23 35 29 39 C41 47 29 64 16 70 C25 63 32 52 30 44 C29 36 21 37 20 43 C25 40 28 48 23 50 C20 51 18 49 18 47Z"/><circle cx="39" cy="42" r="1.7"/><circle cx="39" cy="50" r="1.7"/>');
      } else {
        parts.push('<path d="M28 68 C14 67 15 54 21 46 C26 39 35 33 32 23 C31 19 26 27 26 34 C25 42 29 58 32 73 C34 83 28 88 24 85 C20 82 23 77 26 79" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><path d="M21 62 C17 54 24 47 31 50 C40 54 36 68 27 68 C20 69 14 63 16 56 C16 62 21 68 28 66 C35 65 35 55 29 54 C24 53 20 57 21 62Z"/>');
      }
      const sharp = ex.signature > 0;
      const signPositions = sharp ? (bass ? [24,21,25,22] : [38,35,39,36]) : (bass ? [20,23,19,22] : [34,37,33,36]);
      for (let i = 0; i < Math.abs(ex.signature); i++) {
        accidental(53 + i * 11, yAt(signPositions[i]), ex.signature);
      }
    }
    const timed = ex.grade === 7 || ex.grade === 8;
    const sigEnd = 54 + Math.abs(ex.signature) * 11;
    const left = sigEnd + 22;
    const barWidth = (384 - left) / 2;
    const layout = timed ? scoreLayout(ex, left, barWidth) : ex.positions.map((_, i) => ({x: 92 + i * 53, row: 0, sign: null}));
    let row = -1;
    let beamEnd = null;
    function labelAt(x,y,value,size) {
      parts.push('<text x="' + x + '" y="' + y + '" font-size="' + size + '" font-family="Georgia, serif">' + value + '</text>');
    }
    ex.positions.forEach((position, i) => {
      const {row: currentRow, x, beat, sign} = layout[i];
      if (currentRow !== row) {
        if (row >= 0) parts.push('</g>');
        row = currentRow;
        parts.push('<g transform="translate(0 ' + row * 94 + ')">');
        staff();
        if (timed) {
          if (row === 0) {
            labelAt(sigEnd, 53, ex.metre, 20);
            labelAt(sigEnd, 69, 4, 20);
          }
          line(left + barWidth,38,left + barWidth,70);
          line(384,38,384,70);
        }
      }
      const active = position - (bass ? 7 : 0);
      const y = yAt(active);
      const duration = timed ? ex.beats[i] : 1;
      if (sign !== null) accidental(x - 11, y, sign);
      for (let ledger = bottom - 2; ledger >= active; ledger -= 2) line(x - 9, yAt(ledger), x + 9, yAt(ledger));
      for (let ledger = bottom + 10; ledger <= active; ledger += 2) line(x - 9, yAt(ledger), x + 9, yAt(ledger));
      const fill = duration >= 2 ? ' fill="white" stroke="currentColor" stroke-width="1.5"' : '';
      parts.push('<ellipse cx="' + x + '" cy="' + y + '" rx="5.5" ry="3.5" transform="rotate(-18 ' + x + ' ' + y + ')"' + fill + '/>');
      let up = active < bottom + 4;
      let stemY = y + (up ? -24 : 24);
      const closesBeam = beamEnd !== null;
      const opensBeam = !closesBeam && Number.isInteger(beat) && duration === .5 && ex.beats[i + 1] === .5;
      if (closesBeam) {
        ({up, stemY} = beamEnd);
        beamEnd = null;
      } else if (opensBeam) {
        const nextPosition = ex.positions[i + 1] - (bass ? 7 : 0);
        const nextY = yAt(nextPosition);
        up = (active + nextPosition) / 2 < bottom + 4;
        const middleY = (up ? Math.min(y, nextY) - 24 : Math.max(y, nextY) + 24);
        const slant = Math.max(-4, Math.min(4, (nextY - y) / 2));
        stemY = middleY - slant / 2;
        beamEnd = {up, stemY: middleY + slant / 2};
      }
      const stemX = x + (up ? 5 : -5);
      if (duration < 4) line(stemX, y, stemX, stemY, 1.4);
      if (opensBeam) {
        line(stemX, stemY, layout[i + 1].x + (up ? 5 : -5), beamEnd.stemY, 3.4);
      } else if (duration === .5 && !closesBeam) {
        const flag = up ? 'c0 6 10 9 6 17c1-8-7-9-7-14Z' : 'c0-6 10-9 6-17c1 8-7 9-7 14Z';
        parts.push('<path d="M' + stemX + ' ' + stemY + flag + '"/>');
      }
      if (duration === 1.5 || duration === 3) {
        const dotY = y - (mod(active - bottom,2) ? 0 : 3);
        parts.push('<circle cx="' + (x + 9) + '" cy="' + dotY + '" r="1.5"/>');
      }
    });
    parts.push('</g>');
    const names = noteNames(ex, clef).map((name, i) => {
      if (!timed) return name;
      const duration = ex.beats[i];
      return lang === 'zh' ? name + '（' + duration + '拍）' : name + ' (' + duration + (duration === 1 ? ' beat)' : ' beats)');
    });
    const label = lang === 'zh'
      ? (bass ? '低音谱号' : '高音谱号') + '视唱谱，' + ex.key.zh + '，' + (timed ? ex.metre + '/4拍，' : '') + names.join('、') + '。'
      : (bass ? 'Bass' : 'Treble') + ' clef sight singing in ' + ex.key.en + (timed ? ', ' + ex.metre + '/4' : '') + '. ' + names.join(', ') + '.';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 395 ' + (108 + row * 94) + '" width="100%" role="img" aria-label="' + label + '" fill="currentColor">' + parts.join('') + '</svg>';
  }

  root.Music = { makeSet, validRecipe, pitches, noteNames, onsets, score };
})(typeof window === 'undefined' ? globalThis : window);
