"""Background development server started by start-local.ps1."""

import os
import sys
from pathlib import Path

import uvicorn

backend = Path(__file__).resolve().parents[1] / "backend"
os.chdir(backend)
sys.path.insert(0, str(backend))
uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
