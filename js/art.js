(() => {
  'use strict';
  const lines = {
    grid: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.3"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.3"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.3"/><rect x="14" y="14" width="6.5" height="6.5" rx="1.3"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12M3.5 6H4M3.5 12H4M3.5 18H4"/>',
    exam: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><rect fill="var(--paper,#fff)" x="8.5" y="2.7" width="7" height="4.3" rx="1.4"/><path d="M9 11h6m-6 4h4"/>',
    chart: '<path d="M4 3v17h17M8 15v-4m5 4V6m5 9v-7"/>',
    globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    play: '<path d="m8 4.8 11 7.2-11 7.2z" fill="currentColor" stroke="none"/>',
    layers: '<path d="m3.4 7.8 8.6-4.4 8.6 4.4-8.6 4.4zM3.4 12l8.6 4.4 8.6-4.4M3.4 16.4l8.6 4.4 8.6-4.4"/>',
    book: '<path d="M12 6.5C9 4.7 6 4.5 3 5.4v13c3-1 6-.8 9 1 3-1.8 6-2 9-1v-13c-3-.9-6-.7-9 1Zm0 0v13"/>',
    clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 7v5.5l3.8 2.1"/>',
    history: '<path d="M3 5v5h5M3 10a9 9 0 1 1 .9 6.8M12 7v5l3.6 2.3"/>',
    headphones:
      '<path d="M4 13v-2a8 8 0 0 1 16 0v2"/><rect x="3.5" y="12" width="4.5" height="7.8" rx="2"/><rect x="16" y="12" width="4.5" height="7.8" rx="2"/>',
    check: '<path d="m4.5 12 5 5 10-11"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    music:
      '<path d="M9 16V6l11-2v10M9 9l11-2"/><ellipse cx="6.2" cy="17" rx="2.8" ry="2"/><ellipse cx="17.2" cy="15" rx="2.8" ry="2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4"/>',
    repeat: '<path d="M20 4v5h-5M4 20v-5h5M20 9a8 8 0 0 0-14-3M4 15a8 8 0 0 0 14 3"/>'
  };
  function icon(name) {
    return (
      '<svg class="icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
      lines[name] +
      '</svg>'
    );
  }
  function staff() {
    const ruled = [0, 1, 2, 3, 4].map((i) => '<path d="M0 ' + (33 + i * 9) + 'h310"/>').join('');
    const note = (x, y) =>
      '<ellipse cx="' +
      x +
      '" cy="' +
      y +
      '" rx="6.3" ry="4.3" transform="rotate(-21 ' +
      x +
      ' ' +
      y +
      ')"/><path d="M' +
      (x + 5.7) +
      ' ' +
      (y - 1) +
      'v-28" fill="none" stroke="currentColor" stroke-width="2.1"/>';
    return (
      '<g transform="rotate(-9 150 57)"><g fill="none" stroke="currentColor" opacity=".32" stroke-width=".85">' +
      ruled +
      '</g><g fill="currentColor">' +
      note(59, 69) +
      note(101, 60) +
      note(139, 51) +
      note(175, 55.5) +
      note(214, 42) +
      note(251, 51) +
      '</g><path d="m144 23 36 4.5v5l-36-4.5zm76-9 37 9v5l-37-9z" fill="currentColor"/></g>'
    );
  }
  function wave() {
    const lengths = Array.from({ length: 51 }, (_, i) => {
      const peaks = [
        [10, 1, 4],
        [23, 0.75, 3],
        [34, 0.48, 2.6],
        [42, 0.38, 2.8]
      ];
      return (
        2 +
        39 *
          peaks.reduce(
            (v, [center, amp, span]) => v + amp * Math.exp(-((i - center) ** 2) / (2 * span ** 2)),
            0
          ) *
          (0.43 + 0.57 * Math.abs(Math.cos(i * 0.88)))
      );
    });
    return (
      '<path d="M0 61h300" stroke="currentColor" opacity=".28" stroke-dasharray="2 4"/><g stroke="currentColor" stroke-width="3.1" stroke-linecap="round">' +
      lengths
        .map(
          (h, i) =>
            '<path d="M' +
            (19 + i * 5.26).toFixed(2) +
            ' ' +
            (61 - h).toFixed(2) +
            'v' +
            (h * 2).toFixed(2) +
            '"/>'
        )
        .join('') +
      '</g>'
    );
  }
  function resonance() {
    return Array.from({ length: 17 }, (_, i) => {
      const d = Array.from({ length: 91 }, (_, j) => {
        const x = j * 3.6 - 10;
        const y =
          66 +
          (i - 8) * 2.75 +
          Math.sin(x * 0.035 + i * 0.1) * 22 * Math.sin((Math.PI * (x + 20)) / 345) +
          Math.sin(x * 0.017 - i * 0.18) * 11;
        return (j ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }).join('');
      return '<path d="' + d + '" stroke="currentColor" fill="none" stroke-width="1.15"/>';
    }).join('');
  }
  function rhythm() {
    const marks = Array.from({ length: 37 }, (_, i) => {
      const x = 8 + i * 8;
      return '<path d="M' + x + ' 85v-' + (i % 4 === 0 ? 8 : 4) + '"/>';
    }).join('');
    const group = (x, high, count) => {
      let s = '';
      for (let i = 0; i < count; i++) {
        const a = x + i * 14;
        s +=
          '<rect x="' +
          a +
          '" y="' +
          (74 - high) +
          '" width="' +
          (i ? 5 : 8) +
          '" height="' +
          high +
          '" rx="2.5" opacity="' +
          (i ? '.57' : '1') +
          '"/>';
        high = Math.max(12, high - 12);
      }
      return s;
    };
    return (
      '<g transform="rotate(-7 150 60)"><g stroke="currentColor" opacity=".52">' +
      marks +
      '</g><g fill="currentColor">' +
      group(29, 35, 3) +
      group(85, 54, 2) +
      group(141, 39, 4) +
      group(211, 49, 2) +
      group(253, 26, 2) +
      '</g></g>'
    );
  }
  const draw = { a: wave, b: staff, c: resonance, d: rhythm };
  function motif(key) {
    return (
      '<svg class="motif" aria-hidden="true" viewBox="0 0 300 112" preserveAspectRatio="xMidYMid slice">' +
      draw[key]() +
      '</svg>'
    );
  }
  window.Art = { icon, motif };
})();
