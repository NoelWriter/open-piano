"""Piano Trainer server: serves the web app and songs/, and relays a PC-connected piano.

  py server.py         run (prints the address for the iPad)
  py server.py check   parse every song in songs/
"""
import json
import os
import queue
import socket
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

import midi_file
import pc_midi

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, 'web')
SONGS = os.path.normpath(os.path.join(HERE, '..', 'songs'))
PORT = int(os.environ.get('PORT', 8000))

pc = pc_midi.Broadcaster()


def list_songs():
    return sorted(f for f in os.listdir(SONGS) if f.lower().endswith(('.mid', '.midi')))


class Handler(SimpleHTTPRequestHandler):
    # Windows can map .js to text/plain from the registry; module scripts need a JS type
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css'}

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WEB, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')  # always pick up a new version of the app
        super().end_headers()

    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == '/songs':
            return self.send_json(list_songs())
        if path.startswith('/songs/'):
            name = unquote(path[len('/songs/'):])
            if name not in list_songs():  # also blocks path traversal
                return self.send_json({'error': 'Song not found'}, 404)
            try:
                return self.send_json(midi_file.read_song(os.path.join(SONGS, name)))
            except Exception as e:
                return self.send_json({'error': f'Could not read this MIDI file ({e})'}, 500)
        if path == '/events':
            return self.events()
        self.path = path
        return super().do_GET()  # static files from web/

    def events(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.end_headers()
        q = pc.subscribe()
        try:
            while True:
                try:
                    line = q.get(timeout=15)
                except queue.Empty:
                    line = 'ping'
                self.wfile.write(f'data: {line}\n\n'.encode())
                self.wfile.flush()
        except OSError:
            pass
        finally:
            pc.unsubscribe(q)

    def log_message(self, *a):
        pass


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))  # no packet is sent
        return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()


if __name__ == '__main__':
    if sys.argv[1:] == ['check']:
        for f in list_songs():
            d = midi_file.read_song(os.path.join(SONGS, f))
            print(f'{f}: {len(d["notes"])} notes, {len(d["bars"])} bars, {d["duration"]:.1f}s, tracks {d["tracks"]}')
        sys.exit()
    pc_midi.start(pc)
    print(f'Open on iPad:  http://{lan_ip()}:{PORT}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
