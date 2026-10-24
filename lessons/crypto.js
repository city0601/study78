/* 解鎖：影片內容（題目、旁白）全部加密存放。
   與根目錄練習站共用同一組密碼與金鑰（同網站的 localStorage "tk78-key"），在練習站解鎖過就不用再輸入。
   加密格式：PBKDF2-SHA256 → AES-GCM；檔案內容 = 12 位元組 IV + 密文。 */
(function(){
'use strict';
const KEYSTORE = 'tk78-key';
let KEY = null;
const urls = new Map();
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const meta = async () => (await fetch('../meta.json', {cache: 'no-cache'})).json();
async function derive(pw, m){
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt: b64(m.salt), iterations: m.iter, hash: 'SHA-256'}, base, {name: 'AES-GCM', length: 256}, true, ['decrypt']);
}
async function fetchBuf(path){
  const r = await fetch(path);
  if (!r.ok) throw new Error('http ' + r.status);
  return r.arrayBuffer();
}
const dec = (key, buf) => { const b = new Uint8Array(buf); return crypto.subtle.decrypt({name: 'AES-GCM', iv: b.slice(0, 12)}, key, b.slice(12)); };

function overlay(){
  const st = document.createElement('style');
  st.textContent = `.lk{position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--bg,#eef3fb);color:var(--ink,#1b2438);font-family:var(--font,system-ui,sans-serif)}
  .lk form{display:flex;flex-direction:column;gap:12px;align-items:center;text-align:center;max-width:320px;width:100%}
  .lk input[type=password]{font:inherit;font-size:20px;width:100%;padding:10px;text-align:center;border:2px solid var(--brand,#2f6fde);border-radius:12px;background:var(--panel,#fff);color:inherit}
  .lk button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:10px 24px;background:var(--brand,#2f6fde);color:var(--brand-ink,#fff);cursor:pointer}
  .lk label{font-size:14px;color:var(--muted,#65708a)} .lk .er{color:#d64545;min-height:22px;font-size:14px}`;
  document.head.appendChild(st);
  const d = document.createElement('div'); d.className = 'lk';
  d.innerHTML = `<form><div style="font-size:22px;font-weight:800">數學小教室</div><p style="margin:0">請輸入密碼</p>
    <input type="password" id="lkpw" placeholder="密碼" autocomplete="current-password" required>
    <label><input type="checkbox" id="lkrm" checked> 這台裝置記住密碼</label>
    <button type="submit" id="lkbtn">進入</button><div class="er" id="lker"></div></form>`;
  document.body.appendChild(d);
  return d;
}

async function unlock(probe){
  if (!window.crypto || !crypto.subtle) throw new Error('這個瀏覽器不支援，請用最新版 Chrome 或 Safari（網址要是 https）');
  const m = await meta(), pbuf = await fetchBuf(probe);
  try {
    const saved = JSON.parse(localStorage.getItem(KEYSTORE) || 'null');
    if (saved && saved.salt === m.salt){
      const k = await crypto.subtle.importKey('jwk', saved.jwk, {name: 'AES-GCM'}, true, ['decrypt']);
      await dec(k, pbuf); KEY = k; return;
    }
  } catch (e) {}
  const box = overlay();
  document.getElementById('lkpw').focus();
  return new Promise(resolve => {
    box.querySelector('form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const er = document.getElementById('lker'), btn = document.getElementById('lkbtn');
      er.textContent = ''; btn.disabled = true; btn.textContent = '確認中…';
      try {
        const k = await derive(document.getElementById('lkpw').value, m);
        await dec(k, pbuf); KEY = k;
        if (document.getElementById('lkrm').checked){
          try { localStorage.setItem(KEYSTORE, JSON.stringify({salt: m.salt, jwk: await crypto.subtle.exportKey('jwk', k)})); } catch (e) {}
        }
        box.remove(); resolve();
      } catch (e) {
        er.textContent = e && e.name === 'OperationError' ? '密碼不對，請再試一次' : '載入失敗，請檢查網路後再試';
        btn.disabled = false; btn.textContent = '進入';
      }
    });
  });
}
async function text(path){ return new TextDecoder().decode(await dec(KEY, await fetchBuf(path))); }
async function blobUrl(path, type){
  if (urls.has(path)) return urls.get(path);
  const u = URL.createObjectURL(new Blob([await dec(KEY, await fetchBuf(path))], {type}));
  urls.set(path, u); return u;
}
const exists = path => fetch(path, {method: 'HEAD'}).then(r => r.ok, () => false);
window.Lock = {unlock, text, blobUrl, exists};
})();
