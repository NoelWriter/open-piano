"""Read a .mid file into the JSON the web app plays.

{tracks: [name], notes: [[start_s, dur_s, pitch, track, velocity]], bars: [start_s], duration: s}
Times honour the full tempo map. Drum notes (channel 10) are skipped, and empty tracks are dropped.
"""
import bisect

import mido

DRUM_CHANNEL = 9
DEFAULT_TEMPO = 500000  # 120 bpm


class TempoMap:
    """Ticks -> seconds across tempo changes."""

    def __init__(self, mid):
        self.tpb = mid.ticks_per_beat
        changes = sorted((t, m.tempo) for t, m in _absolute(mid) if m.type == 'set_tempo')
        self.ticks, self.secs, self.tempos = [0], [0.0], [DEFAULT_TEMPO]
        for tick, tempo in changes:
            if tick == self.ticks[-1]:  # a change at the same tick replaces the previous one
                self.tempos[-1] = tempo
                continue
            self.secs.append(self.to_sec(tick))
            self.ticks.append(tick)
            self.tempos.append(tempo)

    def to_sec(self, tick):
        i = bisect.bisect_right(self.ticks, tick) - 1
        return self.secs[i] + mido.tick2second(tick - self.ticks[i], self.tpb, self.tempos[i])


def read_song(path):
    mid = mido.MidiFile(path)
    tempo = TempoMap(mid)

    notes, names, last_tick = [], [], 0
    for ti, track in enumerate(mid.tracks):
        names.append((track.name or '').strip() or f'Track {ti + 1}')
        held, tick = {}, 0
        for m in track:
            tick += m.time
            if m.type not in ('note_on', 'note_off') or m.channel == DRUM_CHANNEL:
                continue
            key = (m.channel, m.note)
            if m.type == 'note_on' and m.velocity > 0:
                held.setdefault(key, []).append((tick, m.velocity))
            elif held.get(key):
                start, vel = held[key].pop(0)
                s = tempo.to_sec(start)
                notes.append([round(s, 4), round(max(tempo.to_sec(tick) - s, 0.01), 4), m.note, ti, vel])
                last_tick = max(last_tick, tick)

    keep = sorted({n[3] for n in notes})
    remap = {old: new for new, old in enumerate(keep)}
    for n in notes:
        n[3] = remap[n[3]]
    notes.sort()
    duration = max((n[0] + n[1] for n in notes), default=0.0)
    return {
        'tracks': [names[i] for i in keep],
        'notes': notes,
        'bars': _bars(mid, tempo, last_tick),
        'duration': round(duration, 4),
    }


def _bars(mid, tempo, end_tick):
    """Start time of every bar, following time-signature changes."""
    sigs = sorted((t, m.numerator, m.denominator) for t, m in _absolute(mid) if m.type == 'time_signature')
    if not sigs or sigs[0][0] > 0:
        sigs.insert(0, (0, 4, 4))
    bars, tick, i = [], 0, 0
    while tick <= end_tick:
        while i + 1 < len(sigs) and sigs[i + 1][0] <= tick:
            i += 1
        _, num, den = sigs[i]
        bars.append(round(tempo.to_sec(tick), 4))
        step = max(1, round(tempo.tpb * num * 4 / den))
        nxt = tick + step
        if i + 1 < len(sigs) and sigs[i + 1][0] < nxt:  # a new signature starts a new bar
            nxt = sigs[i + 1][0]
        tick = nxt
    return bars


def _absolute(mid):
    for track in mid.tracks:
        tick = 0
        for m in track:
            tick += m.time
            yield tick, m
