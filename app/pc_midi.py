"""Fallback input: a piano plugged into the PC, streamed to every open page over SSE."""
import json
import queue
import threading
import time

import mido


class Broadcaster:
    def __init__(self):
        self._clients = []
        self._lock = threading.Lock()

    def subscribe(self):
        q = queue.Queue()
        with self._lock:
            self._clients.append(q)
        return q

    def unsubscribe(self, q):
        with self._lock:
            self._clients.remove(q)

    def send(self, line):
        with self._lock:
            for q in self._clients:
                q.put(line)


def watch(broadcaster, interval=2.0):
    """Open every MIDI input and keep picking up ones plugged in later. Runs forever."""
    def on_message(msg):
        if msg.type == 'note_on' and msg.velocity > 0:
            broadcaster.send(f'on {msg.note} {msg.velocity}')
        elif msg.type in ('note_off', 'note_on'):
            broadcaster.send(f'off {msg.note}')

    opened = {}
    while True:
        try:
            names = set(mido.get_input_names())
            for name in names - opened.keys():
                try:
                    opened[name] = mido.open_input(name, callback=on_message)
                    print('PC MIDI connected:', name, flush=True)
                except Exception as e:
                    print('PC MIDI open failed:', name, e, flush=True)
            for name in opened.keys() - names:
                print('PC MIDI disconnected:', name, flush=True)
                try:
                    opened.pop(name).close()
                except Exception:
                    pass
            broadcaster.send('ports ' + json.dumps(sorted(opened)))
        except Exception as e:
            print('PC MIDI scan error:', e, flush=True)
        time.sleep(interval)


def start(broadcaster):
    threading.Thread(target=watch, args=(broadcaster,), daemon=True).start()
