"""Score for the SNOW CRAB CO-130 console film: a cool, slow bed (Dm9 / Bbmaj7 / Fmaj7 / C6, 78 bpm), a soft
thud each time leg R2 touches the silt, a click on every button press, a tick for each of the six segment numbers,
a low air swell under the explode and the flip.

    python run_sfx.py sims/snowcrab-shared/score.py

Times mirror snowcrab-shared/film.js (SCRIPT, the cadence ramp, the explode and flip blends).
"""

import math
import os

from sfx.score_kit import airy, bed, chords, hz, thud
from sfx.synth import click

TIMELINE = "../snowcrab-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "snowcrab-score.wav")
TARGET_LUFS = -14.0
SEED = 7

CHORDS = chords("Dm9:D2 A2 C3 E3 F3/D1", "Bbmaj7:Bb1 F2 A2 D3/Bb0", "Fmaj7:F2 C3 E3 A3/F1", "C6sus:C2 F2 G2 A2 D3/C1")
MOTIF = [(0.5, hz("A4")), (1.5, hz("F4")), (2.5, hz("E4"))]

CLICKS = (3.2, 9.4, 10.6, 12.4, 13.6, 16.0, 18.0, 19.0, 20.6, 24.6, 26.0, 28.4, 31.2)
ROWS = [3.2 + 0.9 + i * 0.55 for i in range(6)]
CAD = (26.0, 0.7, 1.3, 1.4)
EXPLODE = ((13.6, 1.0), (19.0, 0.0))
FLIP = ((20.6, 1.0), (24.6, 0.0))


def smoother(x):
    u = min(1.0, max(0.0, x))
    return u * u * u * (u * (u * 6 - 15) + 10)


def blend(evs, t, dur):
    v = 0.0
    for t0, val in evs:
        v += (val - v) * smoother((t - t0) / dur)
    return v


def cad_at(t):
    t0, c0, c1, dur = CAD
    return c0 + (c1 - c0) * smoother((t - t0) / dur)


def touchdowns(dur, dt=1 / 240):
    """Leg R2 (group A) starts its stance each time the gait phase crosses a whole cycle."""
    out, phi, t, prev = [], 0.0, 0.0, 0
    while t <= dur:
        phi += cad_at(t + dt / 2) * dt
        t += dt
        k = math.floor(phi)
        relax = max(blend(EXPLODE, t, 1.3), blend(FLIP, t, 1.6))
        if k != prev and relax < 0.3:
            out.append(t)
        prev = k
    return out


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 78, CHORDS, MOTIF, motif_voice="epiano", kicks=(0,), snares=(), hats=0, swing=0.0, keys_vel=0.62, keys_lp=3000)
    mix.put_stereo(0, left, right, 0.12)
    mix.put(0, low, 0.12)
    mix.put(0, drums, 0.03)
    # deep water under everything
    mix.put(0, airy(dur, 220, 340, 0.5), 0.01)
    for t in touchdowns(dur):
        if t < dur - 0.4:
            mix.put(t, thud(90, 0.03, 0.22), 0.045)
    for t in CLICKS:
        mix.put(t, click(2400, 0.025), 0.055)
    for t in ROWS:
        mix.put(t, click(3400, 0.012), 0.03)
    for t0, _ in EXPLODE + FLIP:
        mix.put(t0, airy(1.5, 500, 1500, 0.6), 0.03)
    mix.put(CAD[0], airy(CAD[3] + 0.6, 420, 1300, 0.6), 0.025)
