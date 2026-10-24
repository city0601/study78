/* 單元共用的畫面積木：單元檔的 draw() 直接呼叫這些函式 */
function grid(from, to, k, o = {}){
  const cols = o.cols || 10, gray = o.gray || 0; let h = '', i = 0;
  for (let n = from; n <= to; n++){
    const hit = n % k === 0; let c = 'c';
    if (n < gray) c += ' gray';
    if (hit && !o.hideHits) c += n < gray ? ' hit out' : (o.keep === n ? ' keep' : ' hit');
    if (o.mark === n) c += ' mark';
    h += `<div class="${c}" style="--d:${hit ? (i++ * .35) : 0}s">${n}</div>`;
  }
  return `<div class="grid" style="--cols:${cols};--w:${o.w || 560}px">${h}</div>`;
}
function bar(total, a, o){
  const pa = (a - 1) / total * 100, pb = 100 - pa;
  let h = `<div class="bar"><i class="a" style="width:${pa}%">1～${a - 1}</i><i class="b" style="width:${pb}%">${a}～${total}</i></div>`;
  if (o.top) h += `<div class="brace"><div style="width:100%" class="pop">${o.top}</div></div>`;
  if (o.low) h += `<div class="brace"><div class="gr pop" style="width:${pa}%">${o.low}</div></div>`;
  return h;
}
const big = t => `<p class="big pop">${t}</p>`;
const mid = t => `<p class="mid pop">${t}</p>`;
const eq = t => `<div class="eq pop">${t}</div>`;

/* ---- 單元共用的進階積木 ---- */
// 一排數字方塊；cls 可用 'ok' / 'no' 上色
const chips = (arr, cls = '') => `<div class="row">${arr.map((x, i) => `<div class="box ${cls} pop" style="animation-delay:${i * .12}s">${x}</div>`).join('')}</div>`;
// 短除法：ps 是依序除的質數
function shortDiv(n, ps){
  let cur = n, h = '';
  ps.forEach((p, i) => { h += `<div class="sdr pop" style="animation-delay:${i * .4}s"><b>${p}</b><span>${cur}</span></div>`; cur /= p; });
  h += `<div class="sdr pop" style="animation-delay:${ps.length * .4}s"><b></b><span>${cur}</span></div>`;
  return `<div class="sd">${h}</div>`;
}
// 表格：第一列是表頭；儲存格以 * 開頭會標成重點色
function tbl(rows){
  return `<table class="tbl pop">${rows.map((r, i) => `<tr>${r.map(c => {
    const hl = String(c).startsWith('*');
    return `<${i ? 'td' : 'th'}${hl ? ' class="hl"' : ''}>${hl ? String(c).slice(1) : c}</${i ? 'td' : 'th'}>`;
  }).join('')}</tr>`).join('')}</table>`;
}
// w × h 的小方塊排成長方形
const blocks = (w, h, label = '') => `<div class="blk pop"><div class="grid" style="--cols:${w};--w:${Math.min(w * 26, 260)}px;gap:2px">${'<div class="c hit" style="animation:none;border-radius:3px"></div>'.repeat(w * h)}</div><span class="small">${label}</span></div>`;
