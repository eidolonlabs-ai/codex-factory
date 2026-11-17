"""One bounded Codex task. No queue, automatic merge, or implicit resume."""
import hashlib
import json
import time
import uuid
from dataclasses import asdict
from pathlib import Path
from .evidence import write_result
from .models import Task, Config
from .process import run_process
from .review import review_candidate
from .verify import verify, scope_violations
from .workspace import prepare_workspace, release_workspace, snapshot_candidate

AGENT_SCHEMA = {'type': 'object', 'properties': {'summary': {'type': 'string'}, 'completed': {'type': 'boolean'}}, 'required': ['summary', 'completed'], 'additionalProperties': False}


def run_task(repo: Path, task: Task, config: Config, codex: str = 'codex') -> dict:
    if not config.checks:
        raise ValueError('Configure project checks before running an implementation task')
    started = time.monotonic()
    deadline = started + config.limits.run_seconds
    run_id = uuid.uuid4().hex
    w = prepare_workspace(repo, task, run_id)
    result = dict(schema_version=1, run_id=run_id, status='created', phase='created', base=w.base, branch=w.branch, workspace=str(w.path), run_dir=str(w.run_dir), lock=str(w.lock), attempts=[])
    def save(status, reason=None):
        result['status'] = status
        if status not in ('failed', 'timed_out', 'interrupted'):
            result['phase'] = status
        if reason:
            result['reason'] = reason
        result['duration_seconds'] = time.monotonic()-started
        write_result(w.run_dir, result)
    try:
        for name, value in [('task', asdict(task)), ('config', asdict(config)), ('agent-report.schema', AGENT_SCHEMA)]:
            (w.run_dir/f'{name}.json').write_text(json.dumps(value, indent=2)+'\n')
        result['config_sha256'] = hashlib.sha256((w.run_dir/'config.json').read_bytes()).hexdigest()
        save('created')
        feedback = ''
        for attempt in range(1, config.limits.attempts+1):
            if time.monotonic() >= deadline:
                save('timed_out', 'Whole-run deadline exhausted'); return result
            save('running' if attempt == 1 else 'repairing')
            log = w.run_dir/f'attempt-{attempt}'
            log.mkdir()
            final = log/'agent-report.json'
            argv = [codex, '-c', 'approval_policy="never"', 'exec', '--sandbox', 'workspace-write', '--json', '--output-schema', str(w.run_dir/'agent-report.schema.json'), '--output-last-message', str(final)]
            if config.model:
                argv.extend(['--model', config.model])
            argv.append('-')
            prompt = ('Implement the approved task below. Follow AGENTS.md. Stay within allowed_paths. '
                      'Do not edit harness controls, acceptance tests, or commit/publish/merge. '
                      'Report completed=false if requirements are ambiguous or access is blocked. '
                      'Your completion report is not the verification result.\nTASK DATA:\n' + json.dumps(asdict(task)) + '\nPREVIOUS VERIFICATION:\n' + feedback)
            p = run_process(argv, w.path, min(config.limits.agent_seconds, deadline-time.monotonic()), log, prompt)
            entry = dict(number=attempt, process=asdict(p)); result['attempts'].append(entry)
            if p.timed_out:
                save('timed_out', 'Agent invocation deadline exhausted'); return result
            if p.returncode:
                save('failed', 'Codex process failed; inspect logs (no automatic infrastructure retry)'); return result
            try:
                report = json.loads(final.read_text())
                if set(report) != {'summary', 'completed'} or not isinstance(report['summary'], str) or type(report['completed']) is not bool:
                    raise ValueError('Report fields invalid')
            except (OSError, ValueError, TypeError):
                save('failed', 'Missing or malformed agent report'); return result
            entry['report'] = report
            if not report['completed']:
                save('failed', 'Agent requires clarification or could not complete task'); return result
            violations = scope_violations(w, task.allowed_paths)
            if violations:
                save('failed', '\n'.join(violations)); return result
            save('verifying')
            validation = verify(w, config.checks, deadline)
            entry['verification'] = validation
            if validation['passed']:
                result['candidate'] = validation['candidate']
                save('reviewing')
                review = review_candidate(w, result['candidate'], min(deadline, time.monotonic()+config.limits.agent_seconds), codex)
                result['review'] = review
                if review['collected'] and time.monotonic() < deadline and snapshot_candidate(w) == result['candidate']:
                    save('ready_for_human_review', 'Required checks passed; inspect review findings before merging')
                else:
                    save('timed_out' if time.monotonic() >= deadline or review.get('process', {}).get('timed_out') else 'failed', review['reason'])
                return result
            if time.monotonic() >= deadline or any(c['timed_out'] for c in validation['checks']):
                save('timed_out', validation['reason']); return result
            if any(c.get('launch_error') for c in validation['checks']) or validation['reason'] == 'Candidate changed during verification':
                save('failed', validation['reason']); return result
            feedback = json.dumps(validation)
            # Include a bounded tail for useful repair feedback without filling context.
            for c in validation['checks']:
                for name in ('stdout.log', 'stderr.log'):
                    path = Path(c['log_dir'])/name
                    with path.open('rb') as f:
                        f.seek(max(0, path.stat().st_size-4000))
                        feedback += '\n' + f.read().decode(errors='replace')
        save('failed', 'Implementation attempt budget exhausted')
    except KeyboardInterrupt:
        save('interrupted', 'Interrupted by operator')
    except Exception as e:
        save('failed', f'{type(e).__name__}: {e}')
    finally:
        release_workspace(w)
    return result
