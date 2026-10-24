"""把 lessons-src/ 的單元內容與旁白錄音加密成 lessons/ 底下的 .bin 檔（公開網站只放加密檔）。

用法（在 repo 根目錄；密碼用環境變數傳入，不要寫進檔案）：
    pip install cryptography
    ENC_PASSWORD='你的密碼' python3 lessons/tools/build.py          # 加密 lessons-src → lessons/
    ENC_PASSWORD='你的密碼' python3 lessons/tools/build.py --pull   # 反向：把 lessons/ 的 .bin 解回 lessons-src/

密碼就是根目錄練習站的密碼，並以 data.bin 驗證，輸錯會直接停止。
金鑰參數（salt、iter）讀根目錄的 meta.json，所以兩個網站共用同一組密碼與金鑰。
lessons-src/ 不會被提交（見 .gitignore）：它只放在這台電腦或私人 repo。
格式：PBKDF2-SHA256 → AES-GCM；檔案 = 12 位元組 IV + 密文（與瀏覽器 WebCrypto 相同）。
"""
import base64, hashlib, json, os, pathlib, sys
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

repo = pathlib.Path(__file__).resolve().parent.parent.parent
src, out = repo / "lessons-src", repo / "lessons"
meta = json.loads((repo / "meta.json").read_text())
pw = os.environ.get("ENC_PASSWORD")
if not pw:
    sys.exit("請用環境變數 ENC_PASSWORD 提供密碼。")
aes = AESGCM(hashlib.pbkdf2_hmac("sha256", pw.encode(), base64.b64decode(meta["salt"]), meta["iter"], 32))

def dec(blob): return aes.decrypt(blob[:12], blob[12:], None)
def enc(data): iv = os.urandom(12); return iv + aes.encrypt(iv, data, None)

if not os.environ.get("ENC_SKIP_VERIFY"):          # 只給測試用
    try: dec((repo / "data.bin").read_bytes())
    except InvalidTag: sys.exit("密碼不對（無法解開 data.bin），已停止。")

def write_if_changed(path, data, old_plain=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        try:
            if dec(path.read_bytes()) == data: return False
        except InvalidTag: pass
    path.write_bytes(enc(data)); return True

if "--pull" in sys.argv:
    for b in sorted(out.glob("units/*.bin")) + sorted(out.glob("audio/*/*.bin")):
        rel = b.relative_to(out)
        target = src / rel.with_suffix(".mp3" if rel.parts[0] == "audio" else ".js")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(dec(b.read_bytes())); print("解開", rel)
else:
    n = 0
    for f in sorted(src.glob("units/*.js")):
        n += write_if_changed(out / "units" / (f.stem + ".bin"), f.read_bytes())
    for f in sorted(src.glob("audio/*/*.mp3")):
        n += write_if_changed(out / "audio" / f.parent.name / (f.stem + ".bin"), f.read_bytes())
    print(f"完成，更新了 {n} 個加密檔")
