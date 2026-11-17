"""Bounded POSIX process groups; never invoke a shell."""
import os
import signal
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ProcessResult:
    argv: list[str]
    returncode: int
    timed_out: bool
    duration_seconds: float
    log_dir: str
    launch_error: str | None = None


def _stop(process):
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        process.wait(timeout=1)
    except subprocess.TimeoutExpired:
        pass
    # The group can outlive the parent, including children ignoring TERM.
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait()


def run_process(argv: list[str], cwd: Path, timeout_seconds: float, log_dir: Path, stdin: str = '') -> ProcessResult:
    log_dir.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    timed_out = False
    with (log_dir/'stdout.log').open('wb') as out, (log_dir/'stderr.log').open('wb') as err:
        # File stdin avoids pipe deadlocks on large intake documents.
        with (log_dir/'stdin.txt').open('w+') as inp:
            inp.write(stdin); inp.seek(0)
            try:
                process = subprocess.Popen(argv, cwd=cwd, stdin=inp, stdout=out, stderr=err, start_new_session=True)
            except OSError as e:
                err.write(str(e).encode())
                return ProcessResult(argv, 127, False, time.monotonic()-started, str(log_dir), str(e))
            try:
                process.wait(timeout=max(0.001, timeout_seconds))
            except subprocess.TimeoutExpired:
                timed_out = True
                _stop(process)
            except BaseException:
                _stop(process)
                raise
            finally:
                # Do not let a successful parent leave background workers mutating the candidate.
                _stop(process)
    return ProcessResult(argv, process.returncode, timed_out, time.monotonic()-started, str(log_dir))
