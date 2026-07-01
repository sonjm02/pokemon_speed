const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function parseBase() {
  return window.BASE_CSV.trim().split('\n').map(line => {
    const [id, rank, ko, en, t, s] = line.split('|');
    return { id, rank: Number(rank), ko, en, t, s: Number(s) };
  });
}

function parseMegas() {
  const map = {};
  window.MEGA_CSV.trim().split('\n').forEach(line => {
    const [base, ko, en, t, s] = line.split('|');
    if (!map[base]) map[base] = [];
    map[base].push({ ko, en, t, s: Number(s) });
  });
  return map;
}

const BASE = parseBase();
const MEGAS = parseMegas();
const POKEMON = BASE.flatMap(base => [
  { ...base, form: '기본폼', mega: false, quizId: base.id },
  ...(MEGAS[base.id] || []).map((m, i) => ({
    id: `${base.id}-mega-${i + 1}`,
    rank: base.rank,
    ko: m.ko,
    en: m.en,
    t: m.t,
    s: m.s,
    form: '메가폼',
    mega: true,
    source: base.ko,
    quizId: `${base.id}-mega-${i + 1}`
  }))
]);

const KEY = 'championsRankedSinglesSpeedQuizV5';
const state = Object.assign({ total: 0, correct: 0, streak: 0, wrong: [] }, JSON.parse(localStorage.getItem(KEY) || '{}'));
const uniqueSpeeds = [...new Set(POKEMON.map(m => m.s))].sort((a, b) => a - b);
let current = null;
let answered = false;

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function renderStats() {
  $('#totalCount').textContent = state.total;
  $('#accuracy').textContent = state.total ? `${Math.round((state.correct / state.total) * 100)}%` : '0%';
  $('#streak').textContent = state.streak;
}

function currentPool() {
  const mode = $('#poolSelect').value;
  let arr = POKEMON;
  if (mode === 'top20') arr = POKEMON.filter(m => m.rank <= 20);
  if (mode === 'top50') arr = POKEMON.filter(m => m.rank <= 50);
  if (mode === 'base') arr = POKEMON.filter(m => !m.mega);
  if (mode === 'mega') arr = POKEMON.filter(m => m.mega);
  if (mode === 'wrong') arr = POKEMON.filter(m => state.wrong.includes(m.quizId));
  return arr.length ? arr : POKEMON;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function makeChoices(answer) {
  const choices = [answer];
  const near = uniqueSpeeds.filter(v => v !== answer).sort((a, b) => Math.abs(a - answer) - Math.abs(b - answer));
  for (const value of shuffle(near.slice(0, 12))) {
    if (choices.length < 4 && !choices.includes(value)) choices.push(value);
  }
  while (choices.length < 4) {
    const value = pick(uniqueSpeeds);
    if (!choices.includes(value)) choices.push(value);
  }
  return choices.sort((a, b) => a - b);
}

function celebrate() {
  const box = $('#celebration');
  box.innerHTML = `<div class="toast">정답!</div><span class="spark s1">★</span><span class="spark s2">✦</span><span class="spark s3">✓</span>`;
  box.classList.remove('show');
  void box.offsetWidth;
  box.classList.add('show');
  setTimeout(() => {
    box.classList.remove('show');
    box.innerHTML = '';
  }, 430);
}

function renderQuestion() {
  answered = false;
  current = pick(currentPool());
  $('#rankBadge').textContent = `#${current.rank} 사용률 기반`;
  $('#koName').textContent = current.ko;
  $('#enName').textContent = current.en;
  $('#meta').innerHTML = `<span class="chip">${current.t}</span><span class="chip ${current.mega ? 'mega' : ''}">${current.form}</span>`;
  $('#feedback').className = 'feedback';
  $('#feedback').textContent = '정답을 고르면 해설이 표시됩니다.';
  $('#directInput').value = '';

  const mode = $('#answerMode').value;
  $('#answers').classList.toggle('hidden', mode !== 'choice');
  $('#directForm').classList.toggle('show', mode === 'direct');

  if (mode === 'choice') {
    $('#answers').innerHTML = makeChoices(current.s)
      .map(v => `<button class="answer" type="button" data-value="${v}">${v}</button>`)
      .join('');
    $$('.answer').forEach(button => button.addEventListener('click', () => check(Number(button.dataset.value))));
  } else {
    setTimeout(() => $('#directInput').focus(), 0);
  }
}

function check(value) {
  if (answered) return;
  answered = true;
  const ok = value === current.s;
  state.total += 1;

  if (ok) {
    state.correct += 1;
    state.streak += 1;
    state.wrong = state.wrong.filter(id => id !== current.quizId);
    save();
    renderStats();
    celebrate();
    renderQuestion();
    return;
  }

  state.streak = 0;
  if (!state.wrong.includes(current.quizId)) state.wrong.push(current.quizId);
  save();
  renderStats();

  const feedback = $('#feedback');
  feedback.className = 'feedback bad';
  feedback.innerHTML = `오답입니다. 고른 값은 <b>${value}</b>, 정답은 <b>${current.s}</b>입니다.`;

  $$('.answer').forEach(button => {
    const buttonValue = Number(button.dataset.value);
    button.disabled = true;
    if (buttonValue === current.s) button.classList.add('correct');
    else if (buttonValue === value) button.classList.add('wrong');
  });
}

function renderSummary() {
  const megaCount = POKEMON.filter(m => m.mega).length;
  $('#summary').innerHTML = `
    <div class="box"><strong>2026.07.01</strong><span>사용률 업데이트</span></div>
    <div class="box"><strong>${BASE.length}</strong><span>기준 순위</span></div>
    <div class="box"><strong>${POKEMON.length}</strong><span>출제 항목</span></div>
    <div class="box"><strong>${megaCount}</strong><span>메가폼 항목</span></div>`;
}

function renderTable() {
  const query = $('#searchInput').value.trim().toLowerCase();
  const rows = POKEMON.filter(m => `${m.ko} ${m.en} ${m.t} ${m.s} ${m.form}`.toLowerCase().includes(query));
  $('#tbody').innerHTML = rows.map(m => `
    <tr>
      <td class="num">${m.rank}</td>
      <td><b>${m.ko}</b><br><span class="small">${m.en}</span></td>
      <td><span class="form-badge ${m.mega ? 'mega' : ''}">${m.form}</span></td>
      <td>${m.t}</td>
      <td class="num speed">${m.s}</td>
    </tr>`).join('');
}

$('#nextBtn').addEventListener('click', renderQuestion);
$('#poolSelect').addEventListener('change', renderQuestion);
$('#answerMode').addEventListener('change', renderQuestion);
$('#directForm').addEventListener('submit', event => {
  event.preventDefault();
  const value = Number($('#directInput').value);
  if (Number.isFinite(value)) check(value);
});
$('#resetBtn').addEventListener('click', () => {
  if (confirm('퀴즈 기록을 초기화할까요?')) {
    Object.assign(state, { total: 0, correct: 0, streak: 0, wrong: [] });
    save();
    renderStats();
    renderQuestion();
  }
});
$('#clearWrongBtn').addEventListener('click', () => {
  state.wrong = [];
  save();
  renderQuestion();
});
$('#searchInput').addEventListener('input', renderTable);

renderStats();
renderSummary();
renderTable();
renderQuestion();
