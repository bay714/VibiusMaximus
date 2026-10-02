"""Builds all audio for the how-to video.

    .venv/Scripts/python audio/build.py [vo|music|sfx|all]

- vo:    voiceover lines from src/audio/voiceover.json, read by a Microsoft neural voice
         (edge-tts, needs internet), then trimmed and processed like a studio read: high-pass,
         EQ, de-esser, compressor, loudness-matched to -16 LUFS. Every line is read at a natural
         pace; a line that doesn't fit its slot is reported so the text can be tightened.
         Writes public/audio/vo/*.mp3 and src/audio/manifest.json (start + duration per line).
- music: an 82 s, 96 BPM bed synthesised here (no samples, no licences): pad, electric piano,
         bass, arpeggio and drums, arranged to the scenes: intro 0-5 s, groove 5-30 s,
         lift 30-52.5 s, focus 52.5-70 s, breakdown 70-77.5 s, final chord 77.5-82 s.
         Writes public/audio/music.mp3. To use a licensed track instead, replace that file.
- sfx:   short UI sounds (key click, whoosh, shutter, pop, drop, chime, sparkle).
         Writes public/audio/sfx/*.wav.

Music and SFX are deterministic (fixed random seed).
"""

from __future__ import annotations

import asyncio
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public" / "audio"
WORK = ROOT / "audio" / ".work"
SR = 44100
DURATION = 82.0
REMOTION = ROOT / "node_modules" / ".bin" / ("remotion.exe" if sys.platform == "win32" else "remotion")

rng = np.random.default_rng(714)


# ---------------------------------------------------------------- helpers


def secs(d: float) -> np.ndarray:
    return np.arange(int(round(d * SR))) / SR


def mtof(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def _sos(kind: str, hz, order: int = 2):
    return signal.butter(order, np.asarray(hz) / (SR / 2), kind, output="sos")


def lp(x, hz, order=2):
    return signal.sosfilt(_sos("lowpass", hz, order), x, axis=0)


def hp(x, hz, order=2):
    return signal.sosfilt(_sos("highpass", hz, order), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos("bandpass", [lo, hi], order), x, axis=0)


def sweep_bp(x, f0, f1, width=1.0, chunk=0.02):
    """Band-pass whose centre moves exponentially from f0 to f1 (chunked, state carried)."""
    out = np.zeros_like(x)
    n = int(chunk * SR)
    zi = None
    steps = max(1, int(np.ceil(len(x) / n)))
    for k in range(steps):
        fc = f0 * (f1 / f0) ** (k / max(1, steps - 1))
        sos = _sos("bandpass", [fc / (1 + width), min(fc * (1 + width), SR / 2 * 0.95)])
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        out[k * n : (k + 1) * n], zi = signal.sosfilt(sos, x[k * n : (k + 1) * n], zi=zi)
    return out


def saw(f, t):
    return 2 * ((f * t) % 1.0) - 1


def adsr(n_total: int, a: float, r: float) -> np.ndarray:
    e = np.ones(n_total)
    na, nr = min(n_total, max(1, int(a * SR))), min(n_total, max(1, int(r * SR)))
    e[:na] = np.linspace(0, 1, na) ** 2
    e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


def add(buf: np.ndarray, x: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0):
    """Mix mono or stereo `x` into stereo `buf` at time `at` (equal-power pan for mono)."""
    i = int(round(at * SR))
    if i >= len(buf) or i < 0:
        return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l, x * r], axis=1) * np.sqrt(2)
    n = min(len(x), len(buf) - i)
    buf[i : i + n] += gain * x[:n]


def reverb(x: np.ndarray, seconds=2.6, damp=5000) -> np.ndarray:
    """Wet signal from a synthetic stereo impulse response (decaying filtered noise)."""
    t = secs(seconds)
    decay = np.exp(-t / (seconds / 6.9))
    wet = np.zeros_like(x)
    for ch in range(2):
        ir = lp(rng.standard_normal(len(t)), damp) * decay
        ir[: int(0.018 * SR)] = 0  # pre-delay
        ir /= np.sqrt(np.sum(ir**2))
        wet[:, ch] = signal.fftconvolve(x[:, ch], ir)[: len(x)]
    return wet


def compress(x: np.ndarray, thr_db=-12.0, ratio=2.0, attack=0.01, release=0.18) -> np.ndarray:
    """Feed-forward bus compressor (stereo-linked peak detector, smoothed gain)."""
    level = np.max(np.abs(x), axis=1)
    a_r = np.exp(-1 / (release * SR))
    env = signal.lfilter([1 - a_r], [1, -a_r], level)
    over = np.maximum(0, 20 * np.log10(env + 1e-9) - thr_db)
    gain_db = -over * (1 - 1 / ratio)
    a_a = np.exp(-1 / (attack * SR))
    gain_db = signal.lfilter([1 - a_a], [1, -a_a], gain_db)
    return x * (10 ** (gain_db / 20))[:, None]


def normalise(x: np.ndarray, peak=0.89) -> np.ndarray:
    return x * (peak / max(1e-9, np.max(np.abs(x))))


def write_wav(path: Path, x: np.ndarray):
    path.parent.mkdir(parents=True, exist_ok=True)
    x = np.clip(x, -1, 1)
    if x.ndim == 1:
        x = x[:, None]
    with wave.open(str(path), "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def ffmpeg(*args: str):
    subprocess.run([str(REMOTION), "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def media_duration(path: Path) -> float:
    out = subprocess.run(
        [str(REMOTION), "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return float(out.strip().splitlines()[-1])


# ---------------------------------------------------------------- voiceover

def _biquad_peak(f0, gain_db, q):
    a_ = 10 ** (gain_db / 40)
    w = 2 * np.pi * f0 / SR
    alpha = np.sin(w) / (2 * q)
    b = [1 + alpha * a_, -2 * np.cos(w), 1 - alpha * a_]
    a = [1 + alpha / a_, -2 * np.cos(w), 1 - alpha / a_]
    return np.array(b) / a[0], np.array(a) / a[0]


def _biquad_high_shelf(f0, gain_db):
    a_ = 10 ** (gain_db / 40)
    w = 2 * np.pi * f0 / SR
    cw, alpha = np.cos(w), np.sin(w) / 2 * np.sqrt(2)
    sa = 2 * np.sqrt(a_) * alpha
    b = [a_ * ((a_ + 1) + (a_ - 1) * cw + sa), -2 * a_ * ((a_ - 1) + (a_ + 1) * cw), a_ * ((a_ + 1) + (a_ - 1) * cw - sa)]
    a = [(a_ + 1) - (a_ - 1) * cw + sa, 2 * ((a_ - 1) - (a_ + 1) * cw), (a_ + 1) - (a_ - 1) * cw - sa]
    return np.array(b) / a[0], np.array(a) / a[0]


def _follow(x, ms):
    k = np.exp(-1 / (ms / 1000 * SR))
    return signal.lfilter([1 - k], [1, -k], np.abs(x))


def process_voice(x: np.ndarray) -> np.ndarray:
    """Studio-style chain: trim silence, high-pass, de-box, presence and air, de-ess, compress."""
    gate = np.max(np.abs(x)) * 10 ** (-45 / 20)
    loud = np.nonzero(np.abs(x) > gate)[0]
    x = x[max(0, loud[0] - int(0.02 * SR)) : loud[-1] + int(0.06 * SR)]
    x = hp(x, 75, 4)
    for b, a in (_biquad_peak(280, -2.5, 1.1), _biquad_peak(3200, 2.0, 1.0), _biquad_high_shelf(10000, 2.5)):
        x = signal.lfilter(b, a, x)
    # de-esser: duck only the 5-9.5 kHz band when it gets hot relative to the whole signal
    band = bp(x, 5000, 9500)
    ratio = _follow(band, 4) / (_follow(x, 4) + 1e-9)
    g = np.clip((0.35 / np.maximum(ratio, 1e-9)) ** 0.7, 0.35, 1.0)
    x = x - band + band * signal.lfilter([0.2], [1, -0.8], g)
    # compressor: 2.8:1 above -20 dB (relative to peak), fast attack, musical release
    x = normalise(x, 0.9)
    lvl = 20 * np.log10(_follow(x, 10) + 1e-9)
    gain_db = -np.maximum(0, lvl + 20) * (1 - 1 / 2.8)
    k = np.exp(-1 / (0.14 * SR))
    gain_db = signal.lfilter([1 - k], [1, -k], gain_db)
    x = x * 10 ** (gain_db / 20)
    fade = np.minimum(1, np.minimum(np.arange(len(x)), np.arange(len(x))[::-1]) / (0.008 * SR))
    return normalise(x * fade, 0.9)


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768
        return data.reshape(-1, w.getnchannels()).mean(axis=1)


async def _tts(text: str, voice: str, out: Path):
    import edge_tts

    await edge_tts.Communicate(text, voice).save(str(out))


def build_vo():
    cfg = json.loads((ROOT / "src" / "audio" / "voiceover.json").read_text("utf8"))
    lines = cfg["lines"]
    (PUBLIC / "vo").mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    manifest, over = [], 0
    for i, line in enumerate(lines):
        end = lines[i + 1]["start"] - 0.12 if i + 1 < len(lines) else DURATION - 0.3
        slot = end - line["start"]
        raw = WORK / f"{line['id']}.mp3"
        out = PUBLIC / "vo" / f"{line['id']}.mp3"
        asyncio.run(_tts(line["text"], cfg["voice"], raw))
        decoded, cleaned = WORK / f"{line['id']}.wav", WORK / f"{line['id']}.clean.wav"
        ffmpeg("-i", str(raw), "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", str(decoded))
        write_wav(cleaned, process_voice(read_wav(decoded)))
        ffmpeg("-i", str(cleaned), "-af", "loudnorm=I=-16:TP=-1.5:LRA=7,aresample=44100,apad=pad_dur=0.08",
               "-ac", "1", "-c:a", "libmp3lame", "-b:a", "192k", str(out))
        dur = media_duration(out)
        flag = "ok" if dur <= slot else f"OVER by {dur - slot:.2f}s"
        over += dur > slot
        print(f"  {line['id']:<14} {dur:5.2f}s in {slot:5.2f}s slot  {flag}")
        manifest.append({"id": line["id"], "start": line["start"], "duration": round(dur, 3)})
    path = ROOT / "src" / "audio" / "manifest.json"
    path.write_text(json.dumps({"voice": cfg["voice"], "vo": manifest}, indent=2) + "\n", "utf8")
    print(f"  wrote {path.relative_to(ROOT)}" + (f"  ({over} line(s) too long: tighten the text)" if over else ""))


# ---------------------------------------------------------------- music

BPM = 96
BEAT = 60 / BPM  # 0.625 s
BAR = 4 * BEAT  # 2.5 s
N_BARS = int(np.ceil(DURATION / BAR))
END_BAR = 31  # 77.5 s: the wordmark lands here
CHORDS = {
    "F": [53, 57, 60, 64, 67],  # Fmaj9
    "G": [55, 59, 62, 64],  # G6
    "Em": [52, 55, 59, 62],  # Em7
    "Am": [57, 60, 64, 67],  # Am7
    "C": [48, 52, 55, 59, 62],  # Cmaj9
}
ROOTS = {"F": 41, "G": 43, "Em": 40, "Am": 45, "C": 36}
PROG = ["F", "G", "Em", "Am"]


def chord_of(bar: int) -> str:
    if bar >= END_BAR:
        return "C"
    if bar == END_BAR - 1:
        return "G"
    return PROG[bar % 4]


def section(bar: int) -> str:
    if bar < 2:
        return "intro"  # 0-5 s
    if bar < 12:
        return "groove"  # 5-30 s: dictate + capture
    if bar < 21:
        return "lift"  # 30-52.5 s: send + board
    if bar < 28:
        return "focus"  # 52.5-70 s: macros
    if bar < END_BAR:
        return "break"  # 70-77.5 s: lightweight stats
    return "end"


def kick() -> np.ndarray:
    t = secs(0.45)
    f = 48 + 110 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    return body + hp(rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.003) * 0.3


def clap() -> np.ndarray:
    t = secs(0.35)
    noise = bp(rng.standard_normal(len(t)), 900, 3200)
    env = np.zeros(len(t))
    for k, d in enumerate([0, 0.011, 0.022]):
        i = int(d * SR)
        env[i:] += np.exp(-(t[: len(t) - i]) / (0.008 if k < 2 else 0.12))
    return noise * env * 0.8


def hat(open_: bool = False) -> np.ndarray:
    t = secs(0.25 if open_ else 0.06)
    return hp(rng.standard_normal(len(t)), 7000, 4) * np.exp(-t / (0.08 if open_ else 0.014))


def pluck(m: float, dur=0.5) -> np.ndarray:
    t = secs(dur)
    f = mtof(m)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return x * np.exp(-t / 0.11) * np.minimum(1, t / 0.002)


def epiano(m: float, dur: float) -> np.ndarray:
    """FM electric piano: soft bark on the attack, tine shimmer, long decay."""
    t = secs(dur)
    f = mtof(m)
    index = 1.6 * np.exp(-t / 0.3) + 0.35
    tone = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * f * t))
    tine = 0.12 * np.sin(2 * np.pi * f * 14 * t) * np.exp(-t / 0.025)
    return (tone + tine) * np.exp(-t / 1.1) * adsr(len(t), 0.003, 0.12)


def pad_chord(notes, dur, attack, cutoff) -> np.ndarray:
    t = secs(dur)
    out = np.zeros((len(t), 2))
    for m in notes:
        for cents, side in [(-9, 0), (0, 0), (0, 1), (9, 1)]:
            out[:, side] += saw(mtof(m) * 2 ** (cents / 1200), t + rng.random())
    out = lp(out, cutoff, 2) / (len(notes) * 2)
    return out * adsr(len(t), attack, 0.8)[:, None]


def bass_note(m, dur) -> np.ndarray:
    t = secs(dur)
    f = mtof(m)
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.15 * lp(saw(f, t), 500)
    return x * (0.55 + 0.45 * np.exp(-t / 0.18)) * adsr(len(t), 0.006, 0.06)


def riser(dur: float) -> np.ndarray:
    t = secs(dur)
    return sweep_bp(rng.standard_normal(len(t)), 300, 7000, width=0.6) * (t / dur) ** 2.2


def impact() -> np.ndarray:
    t = secs(3.0)
    boom = np.sin(2 * np.pi * np.cumsum(40 + 30 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.8)
    air = lp(rng.standard_normal(len(t)), 1800) * np.exp(-t / 0.4) * 0.35
    return boom + air


def build_music():
    n = int(DURATION * SR)
    pad, keys, bass, drums, arp, fx = (np.zeros((n, 2)) for _ in range(6))
    kicks: list[float] = []
    k, c = kick(), clap()
    swing = 0.07 * BEAT  # late off-beat 16ths

    for bar in range(N_BARS):
        t0 = bar * BAR
        sec = section(bar)
        name = chord_of(bar)
        notes = CHORDS[name]

        # pad: dark in the intro, brightest in the lift; one long chord at the end
        if sec != "end" or bar == END_BAR:
            cutoff = {"intro": 450 + 550 * bar, "groove": 1300, "lift": 2300, "focus": 1500, "break": 1100, "end": 1600}[sec]
            length = DURATION - t0 if sec == "end" else BAR + 0.8
            add(pad, pad_chord(notes, length, 2.0 if bar == 0 else 0.3, cutoff), t0, 0.85 if sec == "focus" else 1.0)

        # electric piano comping (strummed slightly), the lead colour of the track
        if sec in ("groove", "lift", "focus", "break") or bar == END_BAR:
            hits = {"groove": [(0, 1.4, 0.55), (2.5, 1.2, 0.4)], "lift": [(0, 1.4, 0.7), (1.5, 0.9, 0.45), (2.5, 1.4, 0.55)],
                    "focus": [(0, 1.4, 0.75), (2.5, 1.2, 0.55), (3.5, 0.5, 0.35)], "break": [(0, 3.5, 0.55)],
                    "end": [(0, 7.0, 0.8)]}[sec]
            for beat, length, vel in hits:
                for j, m in enumerate(notes):
                    add(keys, epiano(m + (12 if m < 55 else 0), length * BEAT + 0.6), t0 + beat * BEAT + j * 0.009, vel, pan=-0.3 + 0.15 * j)

        # bass: dotted rhythm; a held root under the final chord
        if sec in ("groove", "lift", "focus"):
            for beat, length in [(0, 1.5), (1.5, 1.5), (3, 1.0)]:
                add(bass, bass_note(ROOTS[name], length * BEAT * 0.92), t0 + beat * BEAT)
        elif bar == END_BAR:
            hold = DURATION - t0
            add(bass, bass_note(ROOTS[name], hold) * np.linspace(1, 0, int(round(hold * SR))), t0)

        # drums
        if sec in ("groove", "lift", "focus"):
            for b in range(4):
                kicks.append(t0 + b * BEAT)
                add(drums, k, t0 + b * BEAT, 0.9 if sec != "focus" else 0.75)
                add(drums, hat(), t0 + (b + 0.5) * BEAT, 0.22, pan=0.25)
                if sec in ("lift", "focus"):
                    add(drums, hat(), t0 + (b + 0.25) * BEAT + swing, 0.06, pan=-0.3)
                    add(drums, hat(), t0 + (b + 0.75) * BEAT + swing, 0.08, pan=-0.3)
                if sec == "lift" and b in (1, 3):
                    add(drums, c, t0 + b * BEAT, 0.5)
            if sec == "lift":
                add(drums, hat(True), t0 + 3.5 * BEAT, 0.12, pan=0.25)
        elif sec == "break":
            for b in range(4):
                add(drums, hat(), t0 + (b + 0.5) * BEAT, 0.12, pan=0.25)

        # arpeggio: swung 16ths through the chord tones, octave jumps in the lift
        if 1 <= bar < END_BAR or bar == END_BAR:
            tones = [m + 12 for m in notes[:4]]
            pattern = [0, 1, 2, 3, 2, 1, 2, 3] * 2
            steps = 16 if bar != END_BAR else 4
            for s in range(steps):
                m = tones[pattern[s] % len(tones)]
                if sec == "lift" and s % 4 == 3:
                    m += 12
                vel = (0.9 if s % 4 == 0 else 0.6) * {"intro": 0.45, "focus": 0.7, "break": 0.55}.get(sec, 1.0)
                add(arp, pluck(m), t0 + s * BEAT / 4 + (swing if s % 2 else 0), vel, pan=-0.35 if s % 2 else 0.35)

    # transitions: risers into the groove, the lift and the final hit
    add(fx, riser(BAR * 0.9), 2 * BAR - BAR * 0.9, 0.35)
    add(fx, riser(BEAT * 2), 12 * BAR - BEAT * 2, 0.3)
    add(fx, riser(BAR * 1.6), END_BAR * BAR - BAR * 1.6, 0.4)
    add(fx, impact(), END_BAR * BAR, 0.8)
    add(drums, k, END_BAR * BAR, 1.0)

    # sidechain pumping on pad, keys and bass while the kick plays
    t = np.arange(n) / SR
    duck = np.ones(n)
    for kt in kicks:
        i = int(kt * SR)
        seg = t[i : i + int(0.4 * SR)] - kt
        duck[i : i + len(seg)] = np.minimum(duck[i : i + len(seg)], 1 - 0.4 * np.exp(-seg / 0.11))
    for part in (pad, keys, bass):
        part *= duck[:, None]

    # ping-pong delay on the arp (dotted eighth)
    d = int(0.75 * BEAT * SR)
    echo = np.zeros_like(arp)
    for tap in range(1, 5):
        shifted = np.zeros_like(arp)
        shifted[tap * d :] = arp[: n - tap * d][:, ::-1] if tap % 2 else arp[: n - tap * d]
        echo += shifted * (0.36**tap)
    arp = arp + lp(echo, 4000)

    dry = 0.2 * pad + 0.2 * keys + 0.42 * bass + 0.55 * drums + 0.13 * arp + 0.5 * fx
    wet = reverb(0.3 * pad + 0.25 * keys + 0.35 * arp + 0.08 * drums + 0.3 * fx)
    mix = hp(dry + 0.3 * wet, 30)

    mix = compress(normalise(mix, 0.9), thr_db=-10, ratio=2.2)
    mix = np.tanh(1.2 * normalise(mix, 0.95)) / np.tanh(1.2)
    fade = np.ones(n)
    fade[: int(0.05 * SR)] = np.linspace(0, 1, int(0.05 * SR))
    fade[-int(2.0 * SR) :] = np.linspace(1, 0, int(2.0 * SR)) ** 1.5
    mix = normalise(mix * fade[:, None])

    wav = WORK / "music.wav"
    write_wav(wav, mix)
    ffmpeg("-i", str(wav), "-c:a", "libmp3lame", "-b:a", "256k", str(PUBLIC / "music.mp3"))
    print(f"  wrote public/audio/music.mp3 ({DURATION:.0f} s, {BPM} BPM)")


# ---------------------------------------------------------------- sfx


def sfx_click():
    t = secs(0.09)
    thock = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.016)
    tick = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.004)
    return 0.6 * thock + 0.6 * tick


def sfx_whoosh():
    t = secs(0.7)
    return sweep_bp(rng.standard_normal(len(t)), 350, 2800, width=0.8) * np.sin(np.pi * t / t[-1]) ** 2


def sfx_shutter():
    t = secs(0.3)
    x = np.zeros(len(t))
    for d in (0.0, 0.065):
        i = int(d * SR)
        x[i:] += hp(rng.standard_normal(len(t) - i), 1800) * np.exp(-t[: len(t) - i] / 0.006)
    x += 0.6 * np.sin(2 * np.pi * 85 * t) * np.exp(-t / 0.05)
    return x + 0.25 * bp(rng.standard_normal(len(t)), 600, 4000) * np.exp(-t / 0.05)


def sfx_pop():
    t = secs(0.18)
    f = 520 + 600 * np.exp(-t / 0.025)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045) * np.minimum(1, t / 0.001)


def sfx_drop():
    t = secs(0.2)
    f = 80 + 110 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.06)
    return body + hp(rng.standard_normal(len(t)), 2000) * np.exp(-t / 0.004) * 0.25


def bell(f, dur=1.0, tau=0.35):
    t = secs(dur)
    partials = [(1, 1), (2, 0.4), (2.76, 0.22), (5.4, 0.08)]
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (tau / r**0.5)) for r, a in partials)
    return x * np.minimum(1, t / 0.002)


def sfx_chime():
    out = np.zeros(int(1.1 * SR))
    for d, f in [(0, 1318.5), (0.085, 1975.5)]:
        b = bell(f, 1.0)
        i = int(d * SR)
        out[i : i + len(b)] += b[: len(out) - i]
    return out


def sfx_sparkle():
    out = np.zeros(int(1.2 * SR))
    for k, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0, 2637.0, 3136.0]):
        b = bell(f, 0.7, 0.18) * (1 - k * 0.08)
        i = int(k * 0.04 * SR)
        out[i : i + len(b)] += b
    t = secs(1.2)
    return out + 0.15 * hp(rng.standard_normal(len(t)), 6000) * np.exp(-t / 0.25) * np.minimum(1, t / 0.05)


SFX = {
    "click": sfx_click,
    "whoosh": sfx_whoosh,
    "shutter": sfx_shutter,
    "pop": sfx_pop,
    "drop": sfx_drop,
    "chime": sfx_chime,
    "sparkle": sfx_sparkle,
}


def build_sfx():
    for name, fn in SFX.items():
        write_wav(PUBLIC / "sfx" / f"{name}.wav", normalise(fn(), 0.8))
    print(f"  wrote {len(SFX)} sounds to public/audio/sfx/")


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    WORK.mkdir(parents=True, exist_ok=True)
    if what in ("sfx", "all"):
        print("sfx")
        build_sfx()
    if what in ("music", "all"):
        print("music")
        build_music()
    if what in ("vo", "all"):
        print("voiceover")
        build_vo()
