import os
import tempfile
import unittest

import mido

import midi_file


def make_midi(path):
    """4/4 at 120 bpm for 2 bars, then 3/4 at 60 bpm; a right-hand and a left-hand track, plus drums."""
    mid = mido.MidiFile(ticks_per_beat=480)
    rh = mido.MidiTrack(); rh.name = 'Piano RH'
    rh.append(mido.MetaMessage('time_signature', numerator=4, denominator=4, time=0))
    rh.append(mido.MetaMessage('set_tempo', tempo=500000, time=0))
    rh.append(mido.Message('note_on', note=72, velocity=90, time=0))
    rh.append(mido.Message('note_off', note=72, velocity=0, time=480))      # 0.0 - 0.5 s
    rh.append(mido.MetaMessage('time_signature', numerator=3, denominator=4, time=3360))  # tick 3840 = bar 3
    rh.append(mido.MetaMessage('set_tempo', tempo=1000000, time=0))
    rh.append(mido.Message('note_on', note=74, velocity=70, time=0))        # 4.0 s
    rh.append(mido.Message('note_on', note=74, velocity=0, time=480))       # off via velocity 0 -> 1.0 s long
    lh = mido.MidiTrack(); lh.name = ''
    lh.append(mido.Message('note_on', note=48, velocity=60, time=960))      # 1.0 s
    lh.append(mido.Message('note_off', note=48, time=960))
    drums = mido.MidiTrack(); drums.name = 'Drums'
    drums.append(mido.Message('note_on', channel=9, note=36, velocity=100, time=0))
    drums.append(mido.Message('note_off', channel=9, note=36, time=240))
    mid.tracks += [rh, lh, drums]
    mid.save(path)


class ReadSongTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.dir.name, 't.mid')
        make_midi(self.path)
        self.song = midi_file.read_song(self.path)

    def tearDown(self):
        self.dir.cleanup()

    def test_notes_follow_tempo_map(self):
        self.assertEqual(self.song['notes'], [
            [0.0, 0.5, 72, 0, 90],
            [1.0, 1.0, 48, 1, 60],
            [4.0, 1.0, 74, 0, 70],
        ])

    def test_drums_and_empty_tracks_dropped_and_names_filled(self):
        self.assertEqual(self.song['tracks'], ['Piano RH', 'Track 2'])

    def test_bars_follow_time_signatures(self):
        # 4/4 at 120 bpm: bars at 0, 2 s; then 3/4 at 60 bpm from 4 s (bar = 3 s)
        self.assertEqual(self.song['bars'][:3], [0.0, 2.0, 4.0])

    def test_duration(self):
        self.assertEqual(self.song['duration'], 5.0)


if __name__ == '__main__':
    unittest.main()
