import sys
from pathlib import Path

# Permet "from app import elo" quand on lance pytest depuis stats-service/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
