import json
import sys
from pathlib import Path
from harness.runner import run_task
from harness.models import Config, Check, Limits
from tests.test_workspace import GitCase

class RunnerTests(GitCase):
    def fake(self, body):
        p = Path(self.temp.name)/'codex'
        p.write_text('#!/usr/bin/env python3\nimport sys,json\nfrom pathlib import Path\n' + body)
        p.chmod(0o755)
        return str(p)

    def config(self, code='pass'):
        return Config(1, [Check('test', [sys.executable, '-c', code], 5)], Limits(3, 10, 60))

    def test_false_success_retries_exactly_three_times(self):
        fake = self.fake("Path(sys.argv[sys.argv.index('--output-last-message')+1]).write_text(json.dumps({'summary':'done','completed':True}))\n")
        r = run_task(self.repo, self.task, self.config('raise SystemExit(1)'), codex=fake)
        self.assertEqual(r['status'], 'failed')
        self.assertEqual(len(r['attempts']), 3)
        self.assertFalse(Path(r['lock']).exists())
        self.assertTrue(Path(r['run_dir'], 'result.json').exists())

    def test_nonzero_agent_failure_not_retried(self):
        r = run_task(self.repo, self.task, self.config(), codex=self.fake('sys.exit(3)\n'))
        self.assertEqual(r['status'], 'failed')
        self.assertEqual(len(r['attempts']), 1)

    def test_success_requires_review_and_preserves_inputs(self):
        fake = self.fake("if 'exec' in sys.argv:\n Path('src/a').write_text('done')\n Path(sys.argv[sys.argv.index('--output-last-message')+1]).write_text(json.dumps({'summary':'done','completed':True}))\nelse:\n print('A review with a finding')\n")
        r = run_task(self.repo, self.task, self.config(), codex=fake)
        self.assertEqual(r['status'], 'ready_for_human_review')
        self.assertTrue(r['review']['collected'])
        self.assertTrue(Path(r['run_dir'], 'task.json').exists())

    def test_worker_cannot_replace_frozen_checks(self):
        fake = self.fake("Path('harness.json').write_text('{}')\nPath(sys.argv[sys.argv.index('--output-last-message')+1]).write_text(json.dumps({'summary':'done','completed':True}))\n")
        r = run_task(self.repo, self.task, self.config(), codex=fake)
        self.assertEqual(r['status'], 'failed')
        self.assertIn('protected', r['reason'])

    def test_malformed_report_is_not_success(self):
        fake = self.fake("Path(sys.argv[sys.argv.index('--output-last-message')+1]).write_text('{}')\n")
        r = run_task(self.repo, self.task, self.config(), codex=fake)
        self.assertEqual(r['status'], 'failed')
        self.assertEqual(len(r['attempts']), 1)

    def test_missing_check_executable_is_not_retried(self):
        fake = self.fake("Path(sys.argv[sys.argv.index('--output-last-message')+1]).write_text(json.dumps({'summary':'done','completed':True}))\n")
        config = Config(1,[Check('missing',['/nonexistent-check'])],Limits(3,10,60))
        r=run_task(self.repo,self.task,config,codex=fake)
        self.assertEqual(r['status'],'failed')
        self.assertEqual(len(r['attempts']),1)
