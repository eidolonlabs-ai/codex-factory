"""Capability checks, not a promise of authenticated model access."""
import platform
import subprocess
import sys
from pathlib import Path
from .models import load_config
from .workspace import git


def doctor(repo: Path, codex: str = 'codex') -> dict:
    result = dict(healthy=True, errors=[], python=platform.python_version(), platform=platform.system(), authentication='not tested')
    if sys.version_info < (3, 11) or platform.system() not in ('Darwin', 'Linux'):
        result['errors'].append('Requires Python 3.11+ on macOS or Linux (WSL supported as Linux)')
    try:
        result['base'] = git(repo, 'rev-parse', '--verify', 'HEAD')
        if git(repo, 'status', '--porcelain'):
            result['errors'].append('Repository is dirty; commit or move changes before a managed run')
    except (ValueError, OSError, subprocess.TimeoutExpired) as e:
        result['errors'].append(f'Git repository: {e}')
    try:
        c = load_config(repo/'harness.json')
        if not c.checks:
            result['errors'].append('Project verification checks are not configured')
    except (ValueError, OSError) as e:
        result['errors'].append(f'Project configuration: {e}')
    try:
        for args, required in [(('--version',), ()), (('exec', '--help'), ('--sandbox', '--json', '--output-schema', '--output-last-message')), (('review', '--help'), ('--base',))]:
            p = subprocess.run([codex, *args], capture_output=True, text=True, timeout=10)
            if p.returncode or any(flag not in p.stdout for flag in required):
                raise ValueError(f'Unsupported Codex capabilities for {args}')
            if args == ('--version',):
                result['codex_version'] = p.stdout.strip()
    except (ValueError, OSError, subprocess.TimeoutExpired) as e:
        result['errors'].append(f'Codex: {e}')
    result['healthy'] = not result['errors']
    return result
