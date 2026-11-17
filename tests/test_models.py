import json
import tempfile
import unittest
from pathlib import Path
from harness.models import load_task, load_config

TASK = dict(schema_version=1, id='demo', title='Demo', specification='Implement sum', acceptance_criteria=['Sum is correct'], allowed_paths=['src'], base_ref='HEAD')

class ModelTests(unittest.TestCase):
    def load(self, data, loader):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)/'input.json'; p.write_text(json.dumps(data))
            return loader(p)

    def test_task_and_defaults(self):
        self.assertEqual(self.load(TASK, load_task).id, 'demo')
        c = self.load(dict(schema_version=1, checks=[]), load_config)
        self.assertEqual(c.limits.attempts, 3)
        self.assertEqual(c.checks, [])

    def test_reject_unsafe_or_incomplete_task(self):
        for patch in [dict(id='../bad'), dict(id='$(bad)'), dict(base_ref='--help'), dict(allowed_paths=['../outside']), dict(allowed_paths=['/tmp']), dict(allowed_paths=['.']), dict(acceptance_criteria=[]), dict(extra=True), dict(schema_version=True)]:
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                self.load(TASK | patch, load_task)

    def test_reject_invalid_configuration(self):
        check = dict(name='test', argv=['python3', '-V'], timeout_seconds=10)
        for patch in [dict(checks=[check, check]), dict(checks=[check | dict(argv=[])]), dict(limits=dict(attempts=True)), dict(limits=dict(run_seconds=0)), dict(limits=dict(unknown=3)), dict(unknown=True)]:
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                self.load(dict(schema_version=1, checks=[]) | patch, load_config)
