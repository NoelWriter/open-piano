@echo off
cd /d "%~dp0app"
py -m pip install -q mido python-rtmidi
py server.py
pause
