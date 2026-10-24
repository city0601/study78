"""把單元的旁白合成為 lessons-src/audio/<單元id>/<編號>.mp3（再用 build.py 加密）。

用法（需要能連網的電腦）：
    pip install edge-tts
    python lessons/tools/make_audio.py multiples-count            # 一個單元
    python lessons/tools/make_audio.py --all                      # 全部單元
    python lessons/tools/make_audio.py multiples-count zh-TW-YunJheNeural   # 換台灣男聲

旁白從 lessons-src/units/<id>.js 裡每一句 cap: '...' 依出現順序抓出來，
{n} 會換成「小朋友」（有輸入名字時，那幾句由瀏覽器語音現場念）。
"""
import asyncio, pathlib, re, sys
import edge_tts

root = pathlib.Path(__file__).resolve().parent.parent.parent / "lessons-src"
args = [a for a in sys.argv[1:] if a != "--all"]
ids = [p.stem for p in sorted((root / "units").glob("*.js")) if p.stem != "catalog"] if "--all" in sys.argv else args[:1]
voice = args[1] if len(args) > 1 and "--all" not in sys.argv else (args[0] if "--all" in sys.argv and args else "zh-TW-HsiaoChenNeural")
if not ids:
    sys.exit(__doc__)

def captions(uid):
    src = (root / "units" / f"{uid}.js").read_text(encoding="utf8")
    return [m.replace("\\'", "'").replace("{n}", "小朋友")
            for m in re.findall(r"\bcap:\s*'((?:[^'\\]|\\.)*)'", src)]

async def main():
    for uid in ids:
        out = root / "audio" / uid
        out.mkdir(parents=True, exist_ok=True)
        for i, text in enumerate(captions(uid)):
            # 稍慢、語調略高，對小朋友比較友善
            await edge_tts.Communicate(text, voice, rate="-8%", pitch="+2Hz").save(str(out / f"{i}.mp3"))
            print("ok", uid, i, text[:16])

asyncio.run(main())
