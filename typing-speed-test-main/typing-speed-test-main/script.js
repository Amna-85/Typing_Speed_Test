const $ = (s) => document.querySelector(s);
const FALLBACK = {
  easy: [{ id: 'easy-1', text: 'The sun rose over the quiet town. Birds sang in the trees as people woke up and started their day.' }],
  medium: [{ id: 'medium-1', text: 'Typing quickly requires steady rhythm, relaxed hands, and constant attention to the words ahead of you.' }],
  hard: [{ id: 'hard-1', text: 'The archaeological expedition unearthed artifacts that complicated prevailing theories about Bronze Age trade networks.' }],
};
const LIMIT = 60;

let data, diff = 'hard', mode = 'timed';
let text = '', states = [], pos = 0, keys = 0, errs = 0;
let startTime = 0, timer = null, running = false;

const passageEl = $('#passage');
const best = () => Number(localStorage.getItem('typing-best')) || 0;
const showBest = () => ($('#best').textContent = best() + ' WPM');

async function init() {
  try { data = await (await fetch('data.json')).json(); }
  catch { data = FALLBACK; }
  showBest();
  reset();
}

function pickPassage() {
  const list = data[diff] || Object.values(data)[0];
  text = list[Math.floor(Math.random() * list.length)].text;
}

function render() {
  passageEl.innerHTML = [...text]
    .map((ch, i) => {
      const cls = states[i] || (i === pos && running ? 'cur' : '');
      return `<span class="${cls}">${ch === ' ' ? ' ' : ch.replace('<', '&lt;')}</span>`;
    })
    .join('');
}

function reset() {
  clearInterval(timer);
  running = false; pos = 0; keys = 0; errs = 0; states = [];
  pickPassage();
  passageEl.classList.add('is-idle');
  $('#overlay').classList.remove('hide');
  $('#test').hidden = false;
  $('#results').hidden = true;
  updateStats(0);
  render();
}

function begin() {
  if (running) return;
  running = true;
  startTime = performance.now();
  passageEl.classList.remove('is-idle');
  $('#overlay').classList.add('hide');
  passageEl.focus();
  timer = setInterval(tick, 250);
  render();
}

const elapsed = () => (performance.now() - startTime) / 1000;
const correct = () => states.filter((s) => s === 'c').length;

function tick() {
  const t = elapsed();
  updateStats(t);
  if (mode === 'timed' && t >= LIMIT) finish(LIMIT);
}

function updateStats(t) {
  const wpm = t > 0 ? Math.round(correct() / 5 / (t / 60)) : 0;
  const acc = keys ? Math.round(((keys - errs) / keys) * 100) : 100;
  $('#wpm').textContent = wpm;
  $('#acc').textContent = acc + '%';
  const shown = mode === 'timed' ? Math.max(0, Math.ceil(LIMIT - t)) : Math.floor(t);
  $('#time').textContent = Math.floor(shown / 60) + ':' + String(shown % 60).padStart(2, '0');
}

document.addEventListener('keydown', (e) => {
  if (!$('#results').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!running) {
    // typing while the passage is focused starts the test
    if (document.activeElement === passageEl && e.key.length === 1) begin(); else return;
  }
  if (e.key === 'Backspace') {
    e.preventDefault();
    if (pos > 0) { pos--; states[pos] = undefined; }
  } else if (e.key.length === 1) {
    e.preventDefault();
    const ok = e.key === text[pos];
    states[pos] = ok ? 'c' : 'i';
    keys++; if (!ok) errs++;
    pos++;
    if (pos >= text.length) { render(); return finish(Math.min(elapsed(), mode === 'timed' ? LIMIT : Infinity)); }
  } else return;
  render();
  updateStats(elapsed());
});

function finish(t) {
  clearInterval(timer);
  running = false;
  const wpm = Math.round(correct() / 5 / (Math.max(t, 1) / 60));
  const acc = keys ? Math.round(((keys - errs) / keys) * 100) : 100;
  const prev = localStorage.getItem('typing-best');
  let title = 'Test Complete!', msg = 'Solid run. Keep pushing to beat your high score.', icon = 'icon-completed.svg', smash = false;
  if (prev === null) { title = 'Baseline Established!'; msg = "You've set the bar. Now the real challenge begins: time to beat it."; }
  else if (wpm > Number(prev)) { title = 'High Score Smashed!'; msg = "You're getting faster. That was incredible typing."; icon = 'icon-new-pb.svg'; smash = true; }
  if (prev === null || wpm > Number(prev)) { localStorage.setItem('typing-best', wpm); showBest(); }

  $('#res-title').textContent = title;
  $('#res-msg').textContent = msg;
  $('#res-icon').src = './assets/images/' + icon;
  $('#r-wpm').textContent = wpm;
  $('#r-acc').textContent = acc + '%';
  $('#r-ok').textContent = correct();
  $('#r-bad').textContent = errs;
  $('#results').classList.toggle('smash', smash);
  $('#test').hidden = true;
  $('#results').hidden = false;
}

// Controls
$('#start').addEventListener('click', begin);
passageEl.addEventListener('click', () => { if (!running) begin(); passageEl.focus(); });
$('#restart').addEventListener('click', reset);
$('#again').addEventListener('click', reset);

document.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => {
  diff = b.dataset.diff;
  document.querySelectorAll('[data-diff]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  reset();
}));
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  mode = b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  reset();
}));

init();