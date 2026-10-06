"""Builds all audio for the Legion how-to video (the Roman-officer cut).

    .venv/Scripts/python audio/legion.py [vo|music|sfx|all]

- vo:    voiceover lines from src/legion/audio/voiceover.json, read by a Microsoft neural voice
         (edge-tts, needs internet) at the file's rate and pitch. Each line goes through
         build.py's studio chain, then a "legate" colour: long sentence pauses tightened to
         0.5 s, +2 dB low shelf at 180 Hz, gentle tape-style saturation and a short stone-hall
         room (0.6 s tail, 25 ms pre-delay, ~7 % wet) whose tail is kept inside the line's slot.
         Loudness-matched to -16 LUFS. A line that doesn't fit its slot is reported.
         Writes public/audio/legion/vo/*.mp3 and src/legion/audio/manifest.json.
- music: a 201 s martial bed synthesised here (no samples): war drums, field snare, low
         string drone, low horns, galloping string ostinato, a cornu (Roman horn) call and a
         male "ahh" choir for the finale. D minor, ~88 BPM, and every scene change lands on a
         beat (each section gets the whole number of beats nearest 88 BPM). Sections follow
         src/legion/timeline.ts: open 0-6.5, light briefing 6.5-30, march 30-95.5, full 95.5-147.5,
         light 147.5-186.5, breakdown 186.5-192, finale 192-201. The 1-4 kHz band is kept clear for the voice.
         Writes public/audio/legion/music.mp3.
- sfx:   build.py's UI sounds (click, whoosh, shutter, pop, drop, chime, sparkle) plus Roman
         ones (drum, stamp, horn, scroll, shield, sword). Writes public/audio/legion/sfx/*.wav.

Imports its helpers from build.py (which it does not change). Music and SFX are deterministic.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import numpy as np
from scipy import signal

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build  # noqa: E402
from build import (  # noqa: E402
    ROOT,
    SR,
    SFX,
    WORK,
    _biquad_peak,
    _follow,
    add,
    bp,
    compress,
    ffmpeg,
    hp,
    lp,
    media_duration,
    mtof,
    normalise,
    process_voice,
    read_wav,
    reverb,
    secs,
    sweep_bp,
    write_wav,
)

PUBLIC = ROOT / "public" / "audio" / "legion"
SRC = ROOT / "src" / "legion" / "audio"
LWORK = WORK / "legion"
CFG = json.loads((SRC / "voiceover.json").read_text("utf8"))
DURATION = float(CFG["duration"])  # from voiceover.json

rng = np.random.default_rng(753)  # ab urbe condita


def reseed():
    """Fresh, fixed random state here and in build.py (its reverb() and SFX use build.rng)."""
    global rng
    rng = np.random.default_rng(753)
    build.rng = np.random.default_rng(714)


# ---------------------------------------------------------------- shared DSP


def biquad_low_shelf(f0, gain_db):
    a_ = 10 ** (gain_db / 40)
    w = 2 * np.pi * f0 / SR
    cw, alpha = np.cos(w), np.sin(w) / 2 * np.sqrt(2)
    sa = 2 * np.sqrt(a_) * alpha
    b = [a_ * ((a_ + 1) - (a_ - 1) * cw + sa), 2 * a_ * ((a_ - 1) - (a_ + 1) * cw), a_ * ((a_ + 1) - (a_ - 1) * cw - sa)]
    a = [(a_ + 1) + (a_ - 1) * cw + sa, -2 * ((a_ - 1) + (a_ + 1) * cw), (a_ + 1) + (a_ - 1) * cw - sa]
    return np.array(b) / a[0], np.array(a) / a[0]


def sweep_lp(x: np.ndarray, c0: float, c1: float, chunk=0.02, curve=1.0) -> np.ndarray:
    """Low-pass whose cutoff moves exponentially from c0 to c1 (chunked, state carried; mono)."""
    out = np.zeros_like(x)
    n = int(chunk * SR)
    steps = max(1, int(np.ceil(len(x) / n)))
    zi = np.zeros((1, 2))
    for k in range(steps):
        fc = c0 * (c1 / c0) ** ((k / max(1, steps - 1)) ** curve)
        sos = signal.butter(2, min(fc, SR / 2 * 0.95) / (SR / 2), "lowpass", output="sos")
        out[k * n : (k + 1) * n], zi = signal.sosfilt(sos, x[k * n : (k + 1) * n], zi=zi)
    return out


def env_ar(n: int, a: float, r: float) -> np.ndarray:
    e = np.ones(n)
    na, nr = min(n, max(1, int(a * SR))), min(n, max(1, int(r * SR)))
    e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    e[-nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return e


def noise(n: int) -> np.ndarray:
    return rng.standard_normal(n)


def mono_room(x: np.ndarray, rt=2.0, damp=4000, pre=0.02, taps=()) -> np.ndarray:
    """Wet mono signal from a unit-energy synthetic IR: early reflections plus a diffuse tail."""
    t = secs(rt * 1.1)
    ir = lp(noise(len(t)), damp) * np.exp(-t / (rt / 6.9))
    ir *= np.clip((t - pre - 0.008) / 0.02, 0, 1)  # diffuse tail builds just after the pre-delay
    level = np.sqrt(np.mean(ir[int((pre + 0.03) * SR) : int((pre + 0.08) * SR)] ** 2))
    for d, g in taps:  # discrete early reflections off the stone walls
        ir[int(d * SR)] += g * level * 6
    ir[: int(pre * SR)] = 0
    ir /= np.sqrt(np.sum(ir**2))
    return signal.fftconvolve(x, ir)[: len(x)]


# ---------------------------------------------------------------- voiceover

PAUSE_CAP = 0.5  # s: neural voices leave ~1 s between sentences; a briefing keeps it brisker
ROOM_WET = 0.07
TAIL_MAX = 0.25  # s of room tail allowed after the last word, if the slot has room
MP3_SAFETY = 0.08  # s: LAME framing adds ~0.05 s to the WAV length


def cap_pauses(x: np.ndarray, cap=PAUSE_CAP) -> np.ndarray:
    """Shorten internal silences (< -40 dB) longer than `cap`, cutting out their middle."""
    env = _follow(x, 10)
    quiet = env < np.max(env) * 10 ** (-40 / 20)
    loud = np.nonzero(~quiet)[0]
    if len(loud) == 0:
        return x
    edges = np.diff(np.concatenate([[0], quiet[loud[0] : loud[-1]].astype(np.int8), [0]]))
    starts, ends = np.nonzero(edges == 1)[0] + loud[0], np.nonzero(edges == -1)[0] + loud[0]
    half, xf = int(cap / 2 * SR), int(0.01 * SR)
    out, pos = x[:0], 0
    for s, e in zip(starts, ends):
        if e - s > cap * SR:
            piece, pos = x[pos : s + half], e - half
            out = np.concatenate([out[:-xf], out[-xf:] * np.linspace(1, 0, xf) + piece[:xf] * np.linspace(0, 1, xf), piece[xf:]]) if len(out) else piece
    piece = x[pos:]
    if pos:
        return np.concatenate([out[:-xf], out[-xf:] * np.linspace(1, 0, xf) + piece[:xf] * np.linspace(0, 1, xf), piece[xf:]])
    return x


def legate(x: np.ndarray, tail: float) -> np.ndarray:
    """Warmth, tape saturation and a short stone-hall room on a processed, trimmed line."""
    b, a = biquad_low_shelf(180, 2.0)
    x = signal.lfilter(b, a, x)
    x = normalise(x, 0.9)
    drive, bias = 1.4, 0.06  # tanh with a touch of asymmetry (even harmonics), blended in lightly
    sat = (np.tanh(drive * (x + bias)) - np.tanh(drive * bias)) / np.tanh(drive)
    x = hp(0.75 * x + 0.25 * sat, 40)
    # tame the "s" sounds: the saturation sharpened them into hiss on bright speakers
    b, a = build._biquad_high_shelf(6500, -5.0)
    x = lp(signal.lfilter(b, a, x), 10000, 2)
    n_tail = int(round(tail * SR))
    x = np.concatenate([x, np.zeros(n_tail)])
    taps = [(0.025, 0.9), (0.031, 0.6), (0.039, 0.7), (0.047, 0.45), (0.058, 0.4), (0.071, 0.3)]
    wet = hp(mono_room(x, rt=0.6, damp=4200, pre=0.025, taps=taps), 220)
    x = x + ROOM_WET * wet
    fade = int(min(0.06, max(0.012, tail * 0.5)) * SR)
    x[-fade:] *= np.linspace(1, 0, fade) ** 2
    return normalise(x, 0.9)


async def _tts(text: str, voice: str, rate: str, pitch: str, out: Path):
    import edge_tts

    await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(str(out))


def build_vo():
    reseed()
    lines = CFG["lines"]
    voice, rate, pitch = CFG["voice"], CFG.get("rate", "+0%"), CFG.get("pitch", "+0Hz")
    print(f"  {voice}  rate {rate}  pitch {pitch}")
    (PUBLIC / "vo").mkdir(parents=True, exist_ok=True)
    LWORK.mkdir(parents=True, exist_ok=True)
    manifest, over = [], 0
    for i, line in enumerate(lines):
        end = lines[i + 1]["start"] - 0.12 if i + 1 < len(lines) else DURATION - 0.3
        slot = end - line["start"]
        raw, decoded = LWORK / f"{line['id']}.mp3", LWORK / f"{line['id']}.wav"
        cleaned, out = LWORK / f"{line['id']}.clean.wav", PUBLIC / "vo" / f"{line['id']}.mp3"
        asyncio.run(_tts(line["text"], voice, rate, pitch, raw))
        ffmpeg("-i", str(raw), "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", str(decoded))
        x = process_voice(cap_pauses(read_wav(decoded)))
        tail = float(np.clip(slot - len(x) / SR - MP3_SAFETY, 0.0, TAIL_MAX))
        write_wav(cleaned, legate(x, tail))
        ffmpeg("-i", str(cleaned), "-af", "loudnorm=I=-16:TP=-1.5:LRA=7,aresample=44100",
               "-ac", "1", "-c:a", "libmp3lame", "-b:a", "192k", str(out))
        dur = media_duration(out)
        flag = "ok" if dur <= slot else f"OVER by {dur - slot:.2f}s"
        over += dur > slot
        print(f"  {line['id']:<15} {dur:5.2f}s in {slot:5.2f}s slot  (room tail {tail:.2f}s)  {flag}")
        manifest.append({"id": line["id"], "start": line["start"], "duration": round(dur, 3)})
    path = SRC / "manifest.json"
    path.write_text(json.dumps({"voice": voice, "vo": manifest}, indent=2) + "\n", "utf8")
    print(f"  wrote {path.relative_to(ROOT)}" + (f"  ({over} line(s) too long)" if over else ""))


# ---------------------------------------------------------------- music: instruments

BPM = 88
DRUM_TUNE = 1.5  # war_drum() pitches below are written an octave-ish low; this lifts them into taiko range
CHORDS = {
    "Dm": [38, 45, 50, 53],  # D2 A2 D3 F3
    "Bb": [34, 46, 50, 53],  # Bb1 Bb2 D3 F3
    "F": [41, 48, 53, 57],  # F2 C3 F3 A3
    "C": [36, 43, 48, 52],  # C2 G2 C3 E3
    "G": [43, 50, 55, 59],  # G2 D3 G3 B3 (the dorian IV)
    "Dsus": [38, 45, 50, 52],  # D2 A2 D3 E3
    "D": [38, 45, 50, 54, 57],  # D major, the last chord
}
CHOIR = {"Bb": [46, 50, 53], "C": [48, 52, 55], "D": [45, 50, 54, 57]}
PROGS = {"march": ["Dm", "Bb", "Dm", "C"], "full": ["Dm", "Bb", "F", "C"], "light": ["Dm", "G", "Dm", "C"], "break": ["Dsus"]}
SECTIONS = [  # (name, start, end, style); ends match src/legion/timeline.ts
    ("open", 0.0, 6.5, "open"),
    ("briefing", 6.5, 30.0, "light"),
    ("setup", 30.0, 42.0, "march"),
    ("dictate", 42.0, 60.0, "march"),
    ("capture", 60.0, 95.5, "march"),
    ("send", 95.5, 109.5, "full"),
    ("carry", 109.5, 121.0, "full"),
    ("board", 121.0, 147.5, "full"),
    ("macros", 147.5, 186.5, "light"),
    ("hotkeys", 186.5, 192.0, "break"),
    ("finale", 192.0, DURATION, "finale"),
]
FINALE = 192.0
START = {name: start for name, start, _, _ in SECTIONS}


def war_drum(f=50.0, size=1.0) -> np.ndarray:
    """Taiko-style membrane: pitch-dropping fundamental, inharmonic modes, skin and stick."""
    t = secs(1.0 + 0.8 * size)
    f = f * (1 + 0.04 * rng.uniform(-1, 1))
    fe = f * (1 + 0.6 * np.exp(-t / 0.035))
    body = np.sin(2 * np.pi * np.cumsum(fe) / SR) * np.exp(-t / (0.32 * size))
    hum = np.sin(2 * np.pi * f * 0.985 * t) * np.exp(-t / (0.55 * size)) * 0.35
    modes = sum(g * np.sin(2 * np.pi * f * r * t + rng.random() * 6) * np.exp(-t / d)
                for r, g, d in [(1.59, 0.35, 0.12), (2.14, 0.18, 0.07), (2.65, 0.08, 0.05)])
    skin = bp(noise(len(t)), 150, 1100) * np.exp(-t / 0.04) * 0.8
    stick = lp(noise(len(t)), 2200) * np.exp(-t / 0.004) * 0.25
    shell = lp(noise(len(t)), 140) * np.exp(-t / (0.45 * size)) * 0.5
    x = (body + hum + modes + skin + stick + shell) * np.minimum(1, t / 0.0015)
    return np.tanh(1.4 * x) / np.tanh(1.4)


def field_snare(vel=1.0) -> np.ndarray:
    """Rope-tension field drum, kept dark. The wires are band-limited (3-6.5 kHz): open-ended
    high-passed noise read as hiss/static once dozens of strokes stacked up in a roll."""
    t = secs(0.3)
    tone = (np.sin(2 * np.pi * 182 * t) + 0.5 * np.sin(2 * np.pi * 324 * t)) * np.exp(-t / 0.035)
    wires = (bp(noise(len(t)), 2500, 5000) + 0.25 * bp(noise(len(t)), 900, 2200)) * np.exp(-t / (0.04 + 0.03 * vel))
    return (0.85 * tone + 0.28 * wires) * np.minimum(1, t / 0.002)


def snare_roll(dur: float, g0: float, g1: float) -> np.ndarray:
    """Pickup into a downbeat. Was a buzz roll of noise strokes, which read as bursts of
    static; now a few soft low tom strokes with a crescendo from g0 to g1."""
    out = np.zeros(int((dur + 0.6) * SR))
    step = 60 / BPM / 4
    n = max(1, int(dur / step))
    for k in range(n):
        g = (g0 + (g1 - g0) * (k / max(1, n - 1))) * 1.6
        t = secs(0.35)
        f = 120 - 20 * k / max(1, n - 1)
        tom = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.3 * np.exp(-t / 0.02))) / SR) * np.exp(-t / 0.12)
        i = int(k * step * SR)
        seg = tom * g
        out[i : i + len(seg)] += seg[: len(out) - i]
    return out

def strings(notes, dur, attack=0.8, release=0.8, c0=700.0, c1=None) -> np.ndarray:
    """Low string drone: detuned saws per note, stereo, through a (moving) low-pass."""
    t = secs(dur)
    out = np.zeros((len(t), 2))
    for m in notes:
        for cents, side in [(-7, 0), (2, 0), (-2, 1), (7, 1)]:
            f = mtof(m) * 2 ** (cents / 1200)
            vib = 1 + 0.0015 * np.sin(2 * np.pi * (4.6 + rng.random()) * t + rng.random() * 6)
            ph = np.cumsum(f * vib) / SR + rng.random()
            out[:, side] += 2 * (ph % 1.0) - 1
    for ch in range(2):
        out[:, ch] = sweep_lp(out[:, ch], c0, c1 or c0)
    return out / (len(notes) * 2) * env_ar(len(t), attack, release)[:, None]


def brass(m, dur, bright=900.0, attack=0.06, release=0.25, vib=0.004, scoop=True, partials=40) -> np.ndarray:
    """Additive brass (the cornu): harmonics whose brightness follows the envelope, a lip
    scoop into the note, delayed vibrato and a little breath."""
    t = secs(dur)
    f0 = mtof(m)
    amp = env_ar(len(t), attack, release)
    pitch = 1 - (0.017 * np.exp(-t / 0.05) if scoop else 0)
    pitch = pitch * (1 + vib * np.clip((t - 0.18) / 0.3, 0, 1) * np.sin(2 * np.pi * 5.2 * t))
    phase = 2 * np.pi * np.cumsum(f0 * pitch) / SR
    b = bright * (0.35 + 0.65 * amp) * (1 + 0.8 * np.exp(-t / 0.08) * (t > 0.02))
    x = np.zeros(len(t))
    for k in range(1, partials + 1):
        if k * f0 > 9000:
            break
        x += k**-0.7 * np.exp(-k * f0 / b) * np.sin(k * phase)
    breath = bp(noise(len(t)), 600, 2500) * 0.015 * amp
    return (x / np.max(np.abs(x) + 1e-9) + breath) * amp


def horn_call(notes) -> np.ndarray:
    """A cornu phrase: [(midi, seconds), ...], slurred with slight overlaps; last note held."""
    total = sum(d for _, d in notes) + 0.9
    out = np.zeros(int(total * SR))
    at = 0.0
    for j, (m, d) in enumerate(notes):
        last = j == len(notes) - 1
        x = brass(m, d + (0.8 if last else 0.05), bright=1300 if last else 1100, attack=0.03 if j else 0.05,
                  release=0.6 if last else 0.04, scoop=j == 0 or m - notes[j - 1][0] > 4)
        i = int(at * SR)
        out[i : i + len(x)] += x[: len(out) - i] * (1.0 if last else 0.85)
        at += d
    return lp(out, 2600)


def choir(notes, dur, attack=1.2, release=2.0) -> np.ndarray:
    """Low male "ahh": vibrato saws through vowel formants (730, 1090, 2440 Hz), stereo."""
    t = secs(dur)
    src = np.zeros((len(t), 2))
    for m in notes:
        for v in range(3):
            f = mtof(m) * 2 ** (rng.uniform(-8, 8) / 1200)
            vib = 1 + 0.006 * np.sin(2 * np.pi * rng.uniform(4.8, 5.8) * t + rng.random() * 6)
            ph = np.cumsum(f * vib) / SR + rng.random()
            src[:, v % 2] += 2 * (ph % 1.0) - 1
    out = sum(g * bp(src, lo, hi) for lo, hi, g in [(560, 900, 1.0), (900, 1300, 0.45), (2200, 2700, 0.08)])
    out += 0.35 * lp(src, 400)
    return out / (len(notes) * 3) * env_ar(len(t), attack, release)[:, None]


def gallop(m, dur=0.22) -> np.ndarray:
    """A short low string stroke for the ostinato."""
    t = secs(dur)
    f = mtof(m)
    x = sum(2 * ((f * c * t + rng.random()) % 1.0) - 1 for c in (0.997, 1.003))
    x = sweep_lp(x, 2400, 650)
    return x * np.exp(-t / 0.09) * np.minimum(1, t / 0.006)


def sub(m, dur) -> np.ndarray:
    t = secs(dur)
    return np.sin(2 * np.pi * mtof(m) * t) * env_ar(len(t), 0.4, 0.6)


def swell(dur) -> np.ndarray:
    """Dark reverse-cymbal-ish rise into a hit."""
    t = secs(dur)
    return lp(sweep_bp(noise(len(t)), 200, 2400, width=0.7), 3000) * (t / dur) ** 2.5


# ---------------------------------------------------------------- music: arrangement


def grid(start, end):
    n = max(1, round((end - start) * BPM / 60))
    return n, (end - start) / n


def build_music():
    reseed()
    n = int(DURATION * SR)
    drums, strs, low, ost, pizz, horns, voices, fx = (np.zeros((n, 2)) for _ in range(8))

    def drum(at, f, size, g, pan=0.0):
        add(drums, war_drum(f * DRUM_TUNE, size), at, g * (0.92 + 0.16 * rng.random()), pan)

    def snare(at, g, pan=0.15):
        add(drums, field_snare(min(1, g * 4)), at, g, pan)

    for name, start, end, style in SECTIONS:
        nb, B = grid(start, end)

        if style == "open":
            # one great hit and a cornu call, then the drums gather towards 6.5 s
            drum(0.0, 38, 1.8, 1.0)
            drum(0.0, 52, 1.0, 0.45)
            add(horns, horn_call([(57, 0.3), (62, 0.22), (69, 1.0)]), 0.08, 0.55, pan=-0.1)
            add(strs, strings([38, 45, 50, 57], end + 0.8, attack=4.5, release=0.8, c0=300, c1=1400), 0.0, 1.1)
            add(low, sub(38, end + 0.5), 0.0, 0.18)
            Bo = 60 / BPM
            for k, g in [(8, 0.3), (6, 0.32), (4, 0.38), (3, 0.36), (2, 0.45), (1.5, 0.4), (1, 0.5), (0.5, 0.48)]:
                drum(end - k * Bo, 50 if k % 1 else 46, 0.9, g, pan=0.2 * ((k * 2) % 3 - 1))
            add(drums, snare_roll(2 * Bo, 0.03, 0.22), end - 2 * Bo, 1.0, pan=0.15)
            add(fx, swell(2 * Bo), end - 2 * Bo, 0.18)
            continue

        if style == "finale":
            # the last word: Bb - C - D major, great hit and cornu, choir, decay to silence
            drum(start, 36, 2.2, 1.0)
            drum(start, 50, 1.2, 0.6)
            add(fx, build.impact(), start, 0.45)
            add(horns, horn_call([(50, 0.3), (57, 0.22), (62, 1.5)]), start + 0.02, 0.55)
            t_c, t_d = start + 1.6, start + 3.2  # D major lands on the tagline line
            for ch, a, b in [("Bb", start, t_c), ("C", t_c, t_d), ("D", t_d, end)]:
                last = ch == "D"
                dur = (b - a) + (0 if last else 0.5)
                notes = CHORDS[ch] + [CHORDS[ch][-2] + 12, CHORDS[ch][-1] + 12]
                add(strs, strings(notes, dur, attack=0.05 if a == start else 0.3, release=4.5 if last else 0.5,
                                  c0=2000, c1=700 if last else 1800), a, 1.2)
                add(voices, choir(CHOIR[ch], dur, attack=0.5, release=4.0 if last else 0.5), a, 1.0)
                add(low, brass(CHORDS[ch][0] + 12, dur, bright=420, attack=0.4, release=3.5 if last else 0.5,
                               vib=0, scoop=False), a, 0.22)
                add(low, sub(CHORDS[ch][0], dur), a, 0.2)
            drum(t_c, 52, 0.9, 0.4)
            drum(t_c + 0.75 * 60 / BPM, 50, 0.9, 0.35)
            add(drums, snare_roll(60 / BPM, 0.03, 0.18), t_d - 60 / BPM, 1.0)
            drum(t_d, 38, 2.0, 0.75)
            continue

        prog = PROGS[style]
        block = 8 if style != "break" else nb
        for bi, b0 in enumerate(range(0, nb, block)):
            beats = min(block, nb - b0)
            a, dur = start + b0 * B, beats * B
            ch = prog[bi % len(prog)]
            notes = CHORDS[ch]
            cut = {"march": 950, "full": 1800, "light": 1500, "break": 650}[style]
            if style in ("full", "light"):
                notes = notes + [notes[-2] + 12, notes[-1] + 12]
            first = b0 == 0
            add(strs, strings(notes, dur + 0.7, attack=1.2 if first else 0.5, release=0.7, c0=cut * (0.7 if first else 1), c1=cut),
                a, {"light": 1.35, "break": 0.9}.get(style, 1.0))
            if style in ("full", "march"):
                add(low, sub(notes[0] if notes[0] < 40 else notes[0] - 12, dur + 0.5), a, 0.14 if style == "full" else 0.1)
            if style == "full":
                root = notes[0] + 12 if notes[0] < 40 else notes[0]
                for m in (root + 12, root + 19):
                    add(low, brass(m, dur + 0.6, bright=520, attack=1.4, release=0.7, vib=0, scoop=False), a, 0.12)

            # ostinato: galloping low strings in the full sections, light 8ths in the macros
            if style in ("full", "light"):
                root = notes[0] + 12 if notes[0] < 40 else notes[0]
                for k in range(beats):
                    bt = a + k * B
                    if style == "full":
                        for off, g, oct_ in [(0, 0.55, 0), (0.5, 0.32, 0), (0.75, 0.38, 12 if k % 2 else 0)]:
                            add(ost, gallop(root + oct_), bt + off * B, g, pan=-0.25 if off else 0.25)
                    else:
                        for off, g in [(0, 0.45), (0.5, 0.3)]:
                            add(ost, gallop(root + (7 if (k % 2 and off) else 0)), bt + off * B, g, pan=-0.2 if off else 0.2)
                        tones = [notes[2] + 12, notes[1] + 12, notes[3] + 12, notes[1] + 12]
                        for h in range(2):
                            add(pizz, build.pluck(tones[(2 * k + h) % 4], 0.4), bt + h * B / 2, 0.55 if h == 0 else 0.4,
                                pan=0.35 if h else -0.35)

        # drums
        for b in range(nb):
            bt, bar_pos = start + b * B, b % 4
            last_beat = b == nb - 1
            if style == "march":
                if bar_pos == 0:
                    drum(bt, 50, 1.0, 0.5)
                if bar_pos == 2:
                    drum(bt, 58, 0.8, 0.28, pan=0.2)
                for off, g in {1: [(0, 0.13)], 3: [(0, 0.13), (0.75, 0.06)], 2: [(0.5, 0.05)]}.get(bar_pos, []):
                    snare(bt + off * B, g)
            elif style == "full":
                if b % 8 == 0:
                    drum(bt, 38, 1.6, 0.55)
                for off, f, s, g in {0: [(0, 46, 1.2, 0.6), (0.5, 55, 0.8, 0.22)], 1: [(0.5, 55, 0.8, 0.3)],
                                     2: [(0, 50, 1.0, 0.5)], 3: [(0, 58, 0.8, 0.3), (0.5, 58, 0.8, 0.34)]}[bar_pos]:
                    drum(bt + off * B, f, s, g, pan=0.25 if f > 52 else -0.1)
                for off, g in {0: [(0.5, 0.06)], 1: [(0, 0.22), (0.75, 0.09)], 2: [(0.5, 0.1)],
                               3: [(0, 0.22), (0.25, 0.08), (0.5, 0.1), (0.75, 0.13)]}[bar_pos]:
                    snare(bt + off * B, g)
                if b % 8 == 7 and not last_beat:
                    add(drums, snare_roll(B, 0.03, 0.12), bt, 1.0, pan=0.15)
            elif style == "light":
                if bar_pos == 0:
                    drum(bt, 52, 0.9, 0.5)
                if bar_pos == 2:
                    drum(bt, 58, 0.7, 0.2, pan=0.2)
                if b % 8 == 6:
                    drum(bt, 60, 0.7, 0.18, pan=0.25)
                if bar_pos == 3:
                    snare(bt, 0.08)
            elif style == "break":
                drum(bt, 46, 0.6, 0.2 if b % 2 else 0.26)

        if style == "break":
            add(drums, snare_roll(2 * B, 0.02, 0.32), end - 2 * B, 1.0)
            add(fx, swell(2 * B), end - 2 * B, 0.25)

    # soft accents on the chapter changes, cornu calls at Dispatch and the Campaign
    for t_ in [start for _, start, _, _ in SECTIONS[1:-1]]:
        drum(t_, 40, 1.5, 0.6 if t_ == 6.5 else 0.42)
    for t_ in (START["setup"], START["send"], START["board"]):
        add(horns, horn_call([(45, 0.26), (50, 0.95)]), t_ + 0.02, 0.32, pan=0.15)

    dry = 0.62 * drums + 0.3 * strs + 0.5 * low + 0.22 * ost + 0.07 * pizz + 0.3 * horns + 0.18 * voices + 0.5 * fx
    wet = reverb(0.18 * drums + 0.35 * strs + 0.12 * ost + 0.2 * pizz + 0.55 * horns + 0.45 * voices + 0.2 * fx,
                 seconds=3.2, damp=3800)
    mix = hp(dry + 0.32 * wet, 28)
    b, a = biquad_low_shelf(120, -4.5)  # big drums, but not mud
    mix = signal.lfilter(b, a, mix, axis=0)
    # keep the voice's band clear: a broad dip around 2.5 kHz
    b, a = _biquad_peak(2500, -3.0, 0.7)
    mix = signal.lfilter(b, a, mix, axis=0)

    # tame the top end: nothing synthesised here needs much above 9 kHz, and the noise in
    # the drums turned to hiss up there
    b, a = build._biquad_high_shelf(7000, -6.0)
    mix = signal.lfilter(b, a, mix, axis=0)
    mix = lp(mix, 11000, 2)

    mix = compress(normalise(mix, 0.9), thr_db=-10, ratio=2.2)
    mix = np.tanh(0.7 * normalise(mix, 0.95)) / np.tanh(0.7)  # gentle: harder clipping added grit
    fade = np.ones(n)
    fade[: int(0.03 * SR)] = np.linspace(0, 1, int(0.03 * SR))
    fade_len = int(3.0 * SR)  # the held chord dies away to silence at the very end
    fade[-fade_len:] = np.linspace(1, 0, fade_len) ** 2
    mix = normalise(mix * fade[:, None])

    LWORK.mkdir(parents=True, exist_ok=True)
    wav = LWORK / "music.wav"
    write_wav(wav, mix)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    ffmpeg("-i", str(wav), "-c:a", "libmp3lame", "-b:a", "256k", str(PUBLIC / "music.mp3"))
    print(f"  wrote public/audio/legion/music.mp3 ({DURATION:.1f} s, ~{BPM} BPM)")
    report_music(mix)


def report_music(mix: np.ndarray):
    """Per-section loudness and how much energy sits in the voice band (1-4 kHz)."""
    m = mix.mean(axis=1)
    band = bp(m, 1000, 4000)
    for name, s, e, style in SECTIONS:
        i, j = int(s * SR), int(e * SR)
        rms = 20 * np.log10(np.sqrt(np.mean(m[i:j] ** 2)) + 1e-9)
        share = 10 * np.log10(np.mean(band[i:j] ** 2) / (np.mean(m[i:j] ** 2) + 1e-12) + 1e-12)
        print(f"    {name:<8} {s:5.1f}-{e:5.1f}s  {rms:6.1f} dBFS rms   1-4 kHz {share:6.1f} dB")


# ---------------------------------------------------------------- sfx


def sfx_drum():
    x = war_drum(40, 1.6)[: int(1.6 * SR)]
    hi = war_drum(52, 0.9)
    x[: len(hi)] += 0.5 * hi[: len(x)]
    x = x + 0.12 * mono_room(x, rt=1.6, damp=3000, pre=0.02)
    t = secs(len(x) / SR)
    return x * np.minimum(1, (t[-1] - t) / 0.08)


def sfx_stamp():
    t = secs(0.45)
    thud = np.sin(2 * np.pi * np.cumsum(62 + 70 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.07)
    press = lp(noise(len(t)), 900) * np.exp(-t / 0.03) * 0.6
    knock = bp(noise(len(t)), 250, 1100) * np.exp(-t / 0.012) * 0.7
    # paper: a few crackles just after the impact, as the sheet flexes
    crackle = np.zeros(len(t))
    for _ in range(14):
        i = int(rng.uniform(0.004, 0.12) * SR)
        crackle[i] += rng.uniform(-1, 1)
    crackle = bp(crackle, 1800, 6000) * np.exp(-t / 0.06) * 3.5
    squish = bp(noise(len(t)), 300, 800) * np.exp(-((t - 0.05) / 0.03) ** 2) * 0.15
    return (thud + press + knock + crackle + squish) * np.minimum(1, t / 0.0008)


def sfx_horn():
    x = horn_call([(57, 0.28), (62, 0.2), (69, 0.6)])
    x = x[: int(1.6 * SR)]
    x = x + 0.2 * mono_room(x, rt=1.2, damp=3500, pre=0.025)
    n = len(x)
    x[-int(0.25 * SR) :] *= np.linspace(1, 0, int(0.25 * SR)) ** 2
    return x[:n]


def sfx_scroll():
    """A soft paper swish and a small flap as the scroll settles. No crackle layer: random
    impulses read as static on playback."""
    t = secs(0.6)
    n = len(t)
    density = np.sin(np.pi * np.clip(t / 0.5, 0, 1)) ** 1.2  # swells and fades as it unrolls
    swish = lp(sweep_bp(noise(n), 500, 1800, width=0.7), 2800) * density * 0.5
    flap = np.sin(2 * np.pi * 140 * t) * np.exp(-np.maximum(0, t - 0.45) / 0.03) * (t > 0.45) * 0.35
    flap += lp(noise(n), 600) * np.exp(-np.maximum(0, t - 0.45) / 0.02) * (t > 0.45) * 0.3
    x = swish + flap
    return x * np.minimum(1, t / 0.02) * np.minimum(1, (t[-1] - t) / 0.04)


def sfx_shield():
    t = secs(0.55)
    wood = sum(g * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, g, d in [(105, 1.0, 0.09), (178, 0.6, 0.06), (310, 0.35, 0.035)])
    knock = bp(noise(len(t)), 400, 1500) * np.exp(-t / 0.015) * 0.9
    ring = sum(g * np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t / d)
               for f, g, d in [(1340, 0.16, 0.22), (2215, 0.1, 0.18), (3470, 0.06, 0.12), (4890, 0.03, 0.08)])
    x = wood + knock + ring + lp(noise(len(t)), 300) * np.exp(-t / 0.04) * 0.5
    return x * np.minimum(1, t / 0.0008)


def sfx_sword():
    t = secs(0.85)
    n = len(t)
    # the draw: scraping friction rising in pitch, rough amplitude, then free of the scabbard
    rough = 0.6 + 0.4 * lp(np.abs(noise(n)), 60) / 0.5
    draw_env = np.clip(t / 0.03, 0, 1) * np.clip((0.42 - t) / 0.06, 0, 1) * (0.5 + t / 0.42)
    scrape = sweep_bp(noise(n), 2200, 6500, width=0.35) * rough * draw_env
    # the shing: a bright inharmonic ring as the tip leaves the scabbard
    t_r = np.maximum(0, t - 0.38)
    on = t > 0.38
    ring = sum(g * np.sin(2 * np.pi * f * t_r + rng.random() * 6) * np.exp(-t_r / d)
               for f, g, d in [(2380, 1.0, 0.28), (3720, 0.7, 0.22), (5150, 0.45, 0.16), (6930, 0.3, 0.1), (8840, 0.15, 0.06)])
    ring *= on * (1 + 0.15 * np.sin(2 * np.pi * 7 * t_r))
    click = bp(noise(n), 2500, 6000) * np.exp(-t / 0.003) * 0.3
    x = 0.55 * scrape + 0.35 * ring + click
    return x * np.minimum(1, (t[-1] - t) / 0.05)


LEGION_SFX = {
    "drum": sfx_drum,
    "stamp": sfx_stamp,
    "horn": sfx_horn,
    "scroll": sfx_scroll,
    "shield": sfx_shield,
    "sword": sfx_sword,
}


def build_sfx():
    reseed()  # build.SFX use build.rng, so this reproduces the old video's UI sounds exactly
    def soften(x: np.ndarray) -> np.ndarray:
        # nothing here needs much above 7 kHz; up there the noise in clicks and shutters
        # read as static
        b, a = build._biquad_high_shelf(5000, -6.0)
        return lp(signal.lfilter(b, a, x), 7000, 2)

    for name, fn in SFX.items():
        write_wav(PUBLIC / "sfx" / f"{name}.wav", normalise(soften(fn()), 0.8))
    for name, fn in LEGION_SFX.items():
        write_wav(PUBLIC / "sfx" / f"{name}.wav", normalise(soften(fn()), 0.8))
    print(f"  wrote {len(SFX) + len(LEGION_SFX)} sounds to public/audio/legion/sfx/")


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    LWORK.mkdir(parents=True, exist_ok=True)
    if what in ("sfx", "all"):
        print("sfx")
        build_sfx()
    if what in ("music", "all"):
        print("music")
        build_music()
    if what in ("vo", "all"):
        print("voiceover")
        build_vo()
