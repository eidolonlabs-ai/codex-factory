"""Git workspaces are change isolation, not a security boundary."""
import hashlib
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from .models import Task


def git(repo: Path, *args: str) -> str:
    p = subprocess.run(['git', '-C', str(repo), *args], capture_output=True, timeout=30)
    if p.returncode:
        raise ValueError(p.stderr.decode(errors='replace').strip())
    output = p.stdout.decode(errors='surrogateescape')
    return output if '-z' in args else output.removesuffix('\n')


def storage(repo: Path) -> Path:
    return Path(git(repo, 'rev-parse', '--path-format=absolute', '--git-common-dir'))/'harness'


@dataclass(frozen=True)
class Workspace:
    path: Path
    run_dir: Path
    lock: Path
    base: str
    branch: str


def prepare_workspace(repo: Path, task: Task, run_id: str) -> Workspace:
    if git(repo, 'status', '--porcelain'):
        raise ValueError('Starting repository must be clean (including untracked files)')
    base = git(repo, 'rev-parse', '--verify', task.base_ref + '^{commit}')
    home = storage(repo)
    for name in ('locks', 'runs', 'worktrees'):
        (home/name).mkdir(parents=True, exist_ok=True)
    lock = home/'locks'/task.id
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as e:
        raise ValueError(f'Task locked: {lock}; inspect before removing a stale lock') from e
    with os.fdopen(fd, 'w') as f:
        f.write(f'pid={os.getpid()} run={run_id}\n')
    run_dir = home/'runs'/run_id
    path = home/'worktrees'/run_id
    branch = f'harness/{task.id}/{run_id}'
    try:
        run_dir.mkdir(exist_ok=False)
        git(repo, 'worktree', 'add', '-b', branch, str(path), base)
        return Workspace(path, run_dir, lock, base, branch)
    except BaseException:
        lock.unlink(missing_ok=True)
        raise


def release_workspace(workspace: Workspace) -> None:
    workspace.lock.unlink(missing_ok=True)


def changed_paths(workspace: Workspace) -> list[str]:
    committed = git(workspace.path, 'diff', '--name-only', '--no-renames', '-z', workspace.base, '--')
    untracked = git(workspace.path, 'ls-files', '--others', '--exclude-standard', '-z')
    return sorted(set(filter(None, (committed + '\0' + untracked).split('\0'))))


def snapshot_candidate(workspace: Workspace) -> str:
    h = hashlib.sha256()
    for args in [('rev-parse', 'HEAD'), ('diff', '--binary', 'HEAD', '--'), ('diff', '--cached', '--binary', '--')]:
        h.update(git(workspace.path, *args).encode(errors='surrogateescape'))
        h.update(b'\0')
    files = git(workspace.path, 'ls-files', '-c', '-o', '--exclude-standard', '-z')
    for name in sorted(set(filter(None, files.split('\0')))):
        p = workspace.path/name
        h.update(name.encode(errors='surrogateescape') + b'\0')
        if p.is_symlink():
            h.update(b'link:' + os.readlink(p).encode(errors='surrogateescape'))
        elif p.is_file():
            h.update(str(p.stat().st_mode & 0o777).encode() + b':')
            with p.open('rb') as f:
                for block in iter(lambda: f.read(1024*1024), b''):
                    h.update(block)
        elif not p.exists():
            h.update(b'deleted')
        else:
            raise ValueError(f'Unsupported candidate entry (submodule/directory): {name}')
        h.update(b'\0')
    return h.hexdigest()
