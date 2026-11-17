"""Run with python3 -m harness. All paths are resolved before dispatch."""
import argparse
import json
import re
import sys
import time
import uuid
from pathlib import Path
from .doctor import doctor
from .intake import run_intake
from .models import load_config, load_task
from .runner import run_task
from .verify import verify
from .workspace import Workspace, git, storage


def main() -> int:
    parser = argparse.ArgumentParser(description='Codex solo developer harness')
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('doctor')
    run = commands.add_parser('run'); run.add_argument('task', type=Path); run.add_argument('--config', type=Path)
    check = commands.add_parser('verify'); check.add_argument('--config', type=Path)
    status = commands.add_parser('status'); status.add_argument('run_id')
    intake = commands.add_parser('intake'); intake.add_argument('source', type=Path); intake.add_argument('--timeout', type=int, default=1200); intake.add_argument('--model')
    benchmark = commands.add_parser('benchmark'); benchmark.add_argument('--timeout', type=int, default=1200); benchmark.add_argument('--model')
    args = parser.parse_args()
    repo = args.repo.resolve()
    try:
        if args.command == 'doctor':
            result = doctor(repo); success = result['healthy']
        elif args.command in ('intake', 'benchmark'):
            if args.timeout <= 0:
                raise ValueError('timeout must be positive')
            source = args.source.resolve() if args.command == 'intake' else repo/'benchmarks/chronograph/input/original.docx'
            result = run_intake(source, storage(repo)/'intake-runs', args.timeout, model=args.model)
            success = result['status'] in ('needs_clarification', 'ready_for_planning')
        elif args.command == 'status':
            if not re.fullmatch('[0-9a-f]{32}', args.run_id):
                raise ValueError('Invalid run ID')
            root = storage(repo)
            paths = [root/'runs'/args.run_id/'result.json', root/'intake-runs'/args.run_id/'result.json']
            found = next((p for p in paths if p.is_file()), None)
            if found is None:
                raise ValueError('Unknown run ID')
            result = json.loads(found.read_text()); success = True
        else:
            config = load_config((args.config or repo/'harness.json').resolve())
            if args.command == 'run':
                result = run_task(repo, load_task(args.task.resolve()), config)
                success = result['status'] == 'ready_for_human_review'
            else:
                run_dir = storage(repo)/'verification'/uuid.uuid4().hex
                w = Workspace(repo, run_dir, run_dir/'unused-lock', git(repo, 'rev-parse', 'HEAD'), '')
                result = verify(w, config.checks, time.monotonic()+config.limits.run_seconds)
                success = result['passed']
        print(json.dumps(result, indent=2))
        return 0 if success else 1
    except (ValueError, OSError) as e:
        print(f'error: {e}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
