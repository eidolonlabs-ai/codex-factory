"""Independent verification of a stable candidate with frozen command inputs."""
import time
import uuid
from dataclasses import asdict
from .models import Check
from .process import run_process
from .workspace import Workspace, changed_paths, snapshot_candidate

PROTECTED = ('harness', 'harness.json', 'AGENTS.md', '.agents', '.codex', '.github', 'tests', 'schemas', 'benchmarks')


def within(path, prefix):
    return path == prefix or path.startswith(prefix + '/')


def scope_violations(workspace: Workspace, allowed_paths: list[str]) -> list[str]:
    issues = []
    for path in changed_paths(workspace):
        if not any(within(path, p) for p in allowed_paths):
            issues.append(f'outside task scope: {path}')
        if any(within(path, p) for p in PROTECTED):
            issues.append(f'protected change needs human review: {path}')
    return issues


def verify(workspace: Workspace, checks: list[Check], deadline: float) -> dict:
    if not checks:
        return dict(passed=False, reason='No project checks configured', checks=[])
    before = snapshot_candidate(workspace)
    results = []
    for i, check in enumerate(checks):
        remaining = deadline-time.monotonic()
        if remaining <= 0:
            return dict(passed=False, reason='Run deadline exhausted', checks=results)
        log_dir = workspace.run_dir/'checks'/f'{uuid.uuid4().hex}-{i}'
        result = run_process(check.argv, workspace.path, min(remaining, check.timeout_seconds), log_dir)
        results.append(dict(name=check.name, **asdict(result)))
        if result.launch_error:
            return dict(passed=False, reason=f'Check could not start: {check.name}: {result.launch_error}', checks=results)
        if result.returncode or result.timed_out:
            return dict(passed=False, reason=f'Check failed: {check.name}', checks=results)
    after = snapshot_candidate(workspace)
    return dict(passed=before == after, reason='Checks passed' if before == after else 'Candidate changed during verification', checks=results, candidate=before)
