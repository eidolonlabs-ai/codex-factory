"""Review a temporary committed snapshot, including worker commits and dirty files."""
import os
import subprocess
import tempfile
import time
from dataclasses import asdict
from pathlib import Path
from .process import run_process
from .workspace import Workspace, git, snapshot_candidate, storage


def review_candidate(workspace: Workspace, baseline: str, deadline: float, codex: str = 'codex') -> dict:
    if snapshot_candidate(workspace) != baseline:
        return dict(collected=False, reason='Candidate changed before review')
    if deadline <= time.monotonic():
        return dict(collected=False, reason='Run deadline exhausted')
    # A separate index avoids staging or committing the developer's working files.
    with tempfile.TemporaryDirectory(dir=workspace.run_dir, prefix='review-index-') as tmp:
        env = os.environ | dict(GIT_INDEX_FILE=str(Path(tmp)/'index'), GIT_AUTHOR_NAME='Harness Review', GIT_AUTHOR_EMAIL='harness@example.invalid', GIT_COMMITTER_NAME='Harness Review', GIT_COMMITTER_EMAIL='harness@example.invalid')
        def command(*args):
            p = subprocess.run(['git', '-C', str(workspace.path), *args], env=env, capture_output=True, text=True, timeout=30)
            if p.returncode:
                raise ValueError(p.stderr.strip())
            return p.stdout.strip()
        command('read-tree', 'HEAD')
        command('add', '-A', '--', '.')
        tree = command('write-tree')
        commit = command('commit-tree', tree, '-p', workspace.base, '-m', 'Temporary harness review snapshot')
    path = storage(workspace.path)/'reviews'/workspace.run_dir.name
    path.parent.mkdir(exist_ok=True)
    git(workspace.path, 'worktree', 'add', '--detach', str(path), commit)
    review_workspace = Workspace(path, workspace.run_dir, workspace.lock, workspace.base, '')
    before = snapshot_candidate(review_workspace)
    result = run_process([codex, '-c', 'sandbox_mode="read-only"', '-c', 'approval_policy="never"', 'review', '--base', workspace.base], path, max(.001, deadline-time.monotonic()), workspace.run_dir/'review')
    unchanged = snapshot_candidate(workspace) == baseline and snapshot_candidate(review_workspace) == before
    return dict(collected=result.returncode == 0 and not result.timed_out and unchanged, reason='Review collected; human interpretation required' if unchanged else 'Candidate changed during review', snapshot_commit=commit, review_worktree=str(path), process=asdict(result))
