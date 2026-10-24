/* 播放器：讀入一個單元（units/<id>.js 呼叫 registerUnit），就能播放、旁白、小測驗與記錄進度 */
const $ = id => document.getElementById(id);
const progKey = id => 'mp:' + id;
function startPlayer(UNIT){
  document.title = UNIT.title + '｜數學小教室';
  $('h1').textContent = UNIT.title;
  $('sub').textContent = UNIT.subtitle;
  if (UNIT.hook) $('hook').innerHTML = UNIT.hook;
  const loadProg = () => { try { return JSON.parse(localStorage.getItem(progKey(UNIT.id))) || {}; } catch (e) { return {}; } };
  const saveProg = patch => { try { localStorage.setItem(progKey(UNIT.id), JSON.stringify(Object.assign(loadProg(), patch))); } catch (e) {} };
const SCENES = UNIT.scenes;
const F = [];
SCENES.forEach((s, si) => {
  if (s.quiz) F.push({si, quiz: s.quiz, cap: s.quiz.cap});
  else s.steps.forEach(st => F.push({si, cap: st.cap, draw: st.draw}));
});
const sceneFrames = SCENES.map((_, si) => F.map((f, i) => f.si === si ? i : -1).filter(i => i >= 0));

$('segs').innerHTML = SCENES.map((s, i) => `<button class="seg" data-s="${i}" aria-label="${s.name}"><b></b></button>`).join('');
$('names').innerHTML = SCENES.map(s => `<span>${s.name}</span>`).join('');
[...$('segs').children].forEach(b => b.onclick = () => { halt(); show(sceneFrames[+b.dataset.s][0]); });

/* ---------- 播放引擎 ---------- */
let idx = 0, playing = false, token = 0, rate = 1, sound = true, cancelWait = null;
const answered = {};
let NAME = '小朋友';
const T = c => c.replaceAll('{n}', NAME);
const named = i => F[i].cap.includes('{n}') && NAME !== '小朋友';
const synth = window.speechSynthesis;

function show(i){
  idx = i; const f = F[i];
  $('cap').textContent = T(f.cap);
  if (f.quiz) renderQuiz(f.quiz, i);
  else $('stage').innerHTML = `<span class="scene-tag">${SCENES[f.si].name}</span>` + f.draw();
  [...$('segs').children].forEach((b, si) => {
    const fr = sceneFrames[si], pos = fr.indexOf(i);
    b.firstChild.style.width = (pos >= 0 ? (pos + 1) / fr.length * 100 : (si < F[i].si ? 100 : 0)) + '%';
  });
  if (f.quiz) speak(T(f.cap), i);
}
let useAudio = false, au = null, voiceName = '';
try { voiceName = localStorage.getItem('voice') || ''; } catch (e) {}
/* 有 audio/0.mp3 就改播真人感錄音檔，沒有就用瀏覽器語音 */
Lock.exists(`audio/${UNIT.id}/0.bin`).then(ok => { useAudio = ok; $('voice').hidden = ok; });
function pickVoice(){
  const vs = synth ? synth.getVoices().filter(v => /^zh/i.test(v.lang)) : [];
  const m = voiceName && vs.find(v => v.name === voiceName);
  if (m) return m;
  const score = v => (/zh[-_]TW/i.test(v.lang) ? 2 : 0) + (/natural|online|premium|enhanced|neural|google/i.test(v.name) ? 5 : 0);
  return vs.sort((a, b) => score(b) - score(a))[0];
}
function fillVoices(){
  const vs = synth ? synth.getVoices().filter(v => /^zh/i.test(v.lang)) : [];
  const cur = pickVoice();
  $('voice').innerHTML = vs.length ? vs.map(v => `<option value="${v.name}"${cur && v.name === cur.name ? ' selected' : ''}>${v.name}</option>`).join('') : '<option>沒有中文語音</option>';
}
const audioFor = i => Lock.blobUrl(`audio/${UNIT.id}/${i}.bin`, 'audio/mpeg').then(u => { const a = new Audio(u); a.playbackRate = rate; return a; });
let spk = 0;
function playAudio(i, my){
  return new Promise(res => {
    cancelWait = () => res('stop');
    audioFor(i).then(a => {
      if (token !== my) return res('stop');
      au = a;
      a.onended = () => res('ok');
      a.onerror = () => { useAudio = false; res('err'); };
      a.play().catch(() => { useAudio = false; res('err'); });
    }, () => { useAudio = false; res('err'); });
  });
}
function speak(t, i){
  if (!sound) return;
  if (useAudio && !named(i)){ const s = ++spk; audioFor(i).then(a => { if (s !== spk) return; if (au) au.pause(); au = a; a.play().catch(() => {}); }); return; }
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(t); u.lang = 'zh-TW'; u.rate = rate;
  const v = pickVoice(); if (v) u.voice = v;
  synth.speak(u);
}
function wait(ms, my){
  return new Promise(res => {
    const t = setTimeout(done, ms);
    function done(){ clearTimeout(t); cancelWait = null; res(); }
    cancelWait = done;
  });
}
async function say(text, my, i){
  if (sound && useAudio && !named(i)){ const r = await playAudio(i, my); if (r !== 'err') return; if (token !== my) return; }
  const min = text.length * 150 / rate, t0 = Date.now();
  if (!synth || !sound){ await wait(Math.max(2600, text.length * 230 / rate), my); return; }
  await new Promise(res => {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-TW'; u.rate = rate;
    const v = pickVoice(); if (v) u.voice = v;
    let fin = false;
    const end = () => { if (fin) return; fin = true; clearTimeout(safe); cancelWait = null; res(); };
    u.onend = u.onerror = end;
    const safe = setTimeout(end, text.length * 500 / rate + 3000);
    cancelWait = end;
    synth.speak(u);
  });
  if (token === my && Date.now() - t0 < min) await wait(min - (Date.now() - t0), my);
}
function halt(){
  playing = false; token++; spk++;
  if (synth) synth.cancel();
  if (au) au.pause();
  if (cancelWait) cancelWait();
  $('play').textContent = '▶ 播放';
}
async function run(){
  const my = ++token; playing = true; $('play').textContent = '⏸ 暫停';
  while (playing && token === my){
    show(idx);
    const f = F[idx];
    if (f.quiz){
      if (answered[idx] && idx < F.length - 1){ idx++; continue; }
      playing = false; $('play').textContent = '▶ 播放'; return;
    }
    await say(T(f.cap), my, idx); if (token !== my) return;
    await wait(500, my); if (token !== my) return;
    if (idx < F.length - 1) idx++;
    else { playing = false; $('play').textContent = '↻ 再看一次'; saveProg({done: true}); return; }
  }
}
function renderQuiz(q, i){
  const ch = q.choices;   // 有 choices 就是選擇題（例如 ['〇', '×']），答案 ans 寫選項文字
  $('stage').innerHTML = `<span class="scene-tag">換你試試看</span><div class="quiz">
    <p class="mid">${q.q}</p>` + (ch
      ? `<div class="row">${ch.map((c, k) => `<button class="main ch" data-k="${k}">${c}</button>`).join('')}</div>`
      : `<input id="qa" type="number" inputmode="numeric" aria-label="你的答案">
    <button class="main" id="qb">送出答案</button>`) + `
    <div class="fb" id="qf"></div></div>`;
  let tries = 0;
  const done = (ok) => {
    answered[i] = true;
    const pr = loadProg(), qz = pr.quiz || {}; qz[i] = ok ? 1 : 0; saveProg({quiz: qz});
    $('qf').className = 'fb ' + (ok ? 'ok' : 'hint');
    $('qf').textContent = (ok ? `答對了，${NAME}好棒！` : `答案是 ${q.ans}。`) + q.expl;
    let nb = $('qb');
    if (!nb){ nb = document.createElement('button'); nb.className = 'main'; nb.id = 'qb'; document.querySelector('.quiz').appendChild(nb); }
    document.querySelectorAll('.ch').forEach(x => { x.disabled = true; });
    nb.textContent = '繼續 ▶';
    nb.onclick = () => { if (i < F.length - 1){ show(i + 1); run(); } };
  };
  if (ch){
    document.querySelectorAll('.ch').forEach(btn => { btn.onclick = () => done(ch[+btn.dataset.k] === q.ans); });
    return;
  }
  $('qb').onclick = () => {
    const v = parseInt($('qa').value, 10); if (isNaN(v)) return;
    if (v === q.ans) return done(true);
    tries++;
    if (tries >= 2) return done(false);
    $('qf').className = 'fb no';
    $('qf').textContent = (q.wrong && q.wrong[v] ? q.wrong[v] + ' ' : '還不對。') + q.hint;
  };
  $('qa').addEventListener('keydown', e => { if (e.key === 'Enter') $('qb').click(); });
}

$('go').onclick = () => {
  NAME = $('nm').value.trim() || '小朋友';
  try { localStorage.setItem('nm', NAME === '小朋友' ? '' : NAME); } catch (e) {}
  $('start').hidden = true; idx = 0; run(); };
$('play').onclick = () => {
  if (playing) return halt();
  if (idx >= F.length - 1 && $('play').textContent.includes('再看')) idx = 0;
  run();
};
$('next').onclick = () => { const was = playing; halt(); show(Math.min(idx + 1, F.length - 1)); if (was) run(); };
$('prev').onclick = () => { const was = playing; halt(); show(Math.max(idx - 1, 0)); if (was) run(); };
$('speed').onclick = () => {
  rate = rate === 1 ? 1.25 : rate === 1.25 ? 0.8 : 1;
  $('speed').textContent = '速度 ' + rate + '×';
};
$('snd').onclick = () => {
  sound = !sound; $('snd').setAttribute('aria-pressed', sound);
  $('snd').textContent = sound ? '🔊 旁白' : '🔇 靜音';
  if (!sound){ if (synth) synth.cancel(); if (au) au.pause(); }
};
if (synth){ synth.onvoiceschanged = fillVoices; }
fillVoices();
$('voice').onchange = () => { voiceName = $('voice').value; try { localStorage.setItem('voice', voiceName); } catch (e) {} };
try { $('nm').value = localStorage.getItem('nm') || ''; } catch (e) {}
$('nm').addEventListener('keydown', e => { if (e.key === 'Enter') $('go').click(); });
$('start').hidden = false;
show(0);
}
