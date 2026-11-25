(() => {
  'use strict';
  const five = {
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
  const categories = { a: 'recall', b: 'sight', c: 'choice', d: 'rhythm' };
  for (const [key, entry] of Object.entries(five)) {
    Object.assign(entry, { kind: categories[key], art: key, scope: scope[key] });
  }

  function exercise(part, kind, art, title, summary, tip) {
    return { part, kind, art, title, summary, scope: summary, tip };
  }
  function recall(isEight) {
    return exercise(
      isEight ? 'A(i)' : 'A',
      'recall',
      'a',
      isEight ? ['Lowest of three voices', '三声部低音记忆'] : ['Lower of two voices', '二声部低音记忆'],
      isEight
        ? [
            'Listen to three voices twice and sing or play back the lowest line.',
            '听两遍三声部乐句，唱出或弹出最低声部。'
          ]
        : [
            'Hear a duet twice and sing or play its lower line from memory.',
            '听两遍二声部乐句，凭记忆唱出或弹出低声部。'
          ],
      [
        'Hold the given starting note through the count. Follow the bass even when the upper line moves in the opposite direction.',
        '在预备拍中记住起音。即使高声部向相反方向移动，也继续听低声部的走向。'
      ]
    );
  }
  function sight(isEight) {
    return exercise(
      'B',
      'sight',
      'b',
      isEight ? ['Sight sing the lower voice', '低声部视唱'] : ['Sight sing the upper voice', '高声部视唱'],
      isEight
        ? [
            'Read the lower voice and sing it while the piano plays the upper voice.',
            '看谱唱低声部，同时听钢琴演奏高声部。'
          ]
        : [
            'Read the upper voice and sing it while the piano plays the lower voice.',
            '看谱唱高声部，同时听钢琴演奏低声部。'
          ],
      [
        'Use the preparation time to sing through your part. Choose a clef and keep the pulse when the other voice enters.',
        '准备时可以试唱自己的声部。选择熟悉的谱号，另一声部进入后仍保持原来的拍子。'
      ]
    );
  }
  function cadence(isEight) {
    return exercise(
      isEight ? 'A(ii)' : 'C(i)',
      'choice',
      'c',
      ['Cadence recognition', '辨别终止式'],
      isEight
        ? [
            'Hear how the phrase continues and identify a perfect, imperfect, interrupted or plagal ending.',
            '听前一乐句的接续，辨别正格、半终止、阻碍或变格终止。'
          ]
        : [
            'Listen to the ending and distinguish perfect, imperfect and interrupted cadences.',
            '听乐句的结尾，辨别正格终止、半终止和阻碍终止。'
          ],
      [
        'Hum the bass at the last two chords. Does the music come home, pause on the dominant or turn elsewhere?',
        '哼出最后两个和弦的低音，听乐句是回到主和弦、停在属和弦，还是转向别处。'
      ]
    );
  }
  function chords(isEight) {
    return exercise(
      isEight ? 'A(iii)' : 'C(ii)',
      'choice',
      'b',
      isEight ? ['Chords and inversions', '和弦与转位'] : ['Name the two chords', '辨别两个和弦'],
      isEight
        ? [
            'Identify all three chords of the same ending, including the position of each.',
            '再听同一终止进行，辨认三个和弦以及各自的转位。'
          ]
        : [
            'Identify both root position chords from the cadence you just heard.',
            '再听刚才的终止式，按顺序辨认两个原位和弦。'
          ],
      isEight
        ? [
            'First identify the harmony, then sing the bass. A third or fifth in the bass changes the inversion.',
            '先判断和弦，再唱出低音。低音是三音或五音，可以帮助你判断转位。'
          ]
        : [
            'Listen for the root movement, then check the quality of each chord against the home key.',
            '先听根音怎样移动，再根据主调核对每个和弦的性质。'
          ]
    );
  }
  function modulation(part, isMinor) {
    return exercise(
      part,
      'choice',
      'a',
      isMinor ? ['Modulation from minor', '从小调转调'] : ['Modulation from major', '从大调转调'],
      isMinor
        ? [
            'Locate the new tonic and choose the dominant, subdominant or relative major.',
            '听出新的主音，辨别转向属调、下属调还是关系大调。'
          ]
        : [
            'Hear a major key passage and identify the dominant, subdominant or relative minor as its destination.',
            '听一段由大调开始的音乐，辨别转向属调、下属调还是关系小调。'
          ],
      [
        'Hold the original tonic in mind. Hum the note that sounds settled at the end and compare it with the starting key.',
        '记住原调主音，哼出结尾听起来最稳定的音，再比较两个调的关系。'
      ]
    );
  }

  const seven = {
    a: recall(false),
    b: sight(false),
    cad: cadence(false),
    ch: chords(false),
    mod: modulation('C(iii)', false),
    c: exercise(
      'D(i)',
      'choice',
      'c',
      ['Two musical features', '辨别两项音乐特征'],
      [
        'Read the two listening prompts, then listen for evidence in the piece.',
        '先看本题要听的两项特征，再从曲子里找依据。'
      ],
      [
        'Trace the number of independent lines for texture. For structure, listen for a repeated or contrasting phrase.',
        '辨认织体时，听有几条独立的旋律线。辨认结构时，听乐句何处重复、何处形成对比。'
      ]
    ),
    d: exercise(
      'D(ii)',
      'rhythm',
      'd',
      five.d.title,
      [
        'Tap the rhythm of an extract from the same piece and distinguish simple metres from 6/8.',
        '拍回同曲片段，再辨别二拍、三拍、四拍或八六拍。'
      ],
      [
        'In 6/8, listen for two main beats, each divided into three. Compare that pulse with the divisions of simple duple time.',
        '八六拍通常有两个大拍，每个大拍分成三份。用同样速度打大拍，再比较它和单二拍子的细分。'
      ]
    )
  };
  const eight = {
    a: recall(true),
    cad: cadence(true),
    ch: chords(true),
    b: sight(true),
    mod: modulation('C', false),
    minor: modulation('C', true),
    desc: exercise(
      'D',
      'describe',
      'c',
      ['Describe the music', '描述音乐特征'],
      [
        'Listen to a piece and give your own description before comparing it with listening notes.',
        '听完乐曲，先自己描述听到的特征，再与参考听辨要点对照。'
      ],
      [
        'Pick two details you can point to in the music. Explain how a particular change in texture, phrasing or harmony creates the character you hear.',
        '挑出两处具体细节，说明织体、乐句或和声的变化怎样形成你听到的音乐性格。'
      ]
    )
  };
  const byGrade = { 5: five, 7: seven, 8: eight };
  window.Curriculum = {
    grades: [5, 7, 8],
    parts(grade) {
      return Object.keys(byGrade[grade] || {});
    },
    skill(grade, key) {
      return Object.hasOwn(byGrade[grade] || {}, key) ? byGrade[grade][key] : undefined;
    }
  };
})();
