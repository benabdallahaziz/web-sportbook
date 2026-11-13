"""Lancement : python run.py"""
import sys

import uvicorn

# La console Windows n'est pas en UTF-8 par défaut : accents et emojis des logs
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

from app import config

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=config.PORT)
