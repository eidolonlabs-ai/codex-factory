"""Atomic evidence writes; evidence is local audit data, not an attestation."""
import json
import os
import tempfile
from pathlib import Path


def write_result(run_dir: Path, result: dict) -> None:
    run_dir.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=run_dir, prefix='.result-')
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(result, f, indent=2, allow_nan=False)
            f.write('\n'); f.flush(); os.fsync(f.fileno())
        os.replace(name, run_dir/'result.json')
    finally:
        Path(name).unlink(missing_ok=True)
