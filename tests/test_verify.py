import sys
import time
from harness.models import Check
from harness.verify import verify, scope_violations
from tests.test_workspace import GitCase

class VerifyTests(GitCase):
    def test_empty_checks_fail_closed(self):
        r = verify(self.workspace(), [], time.monotonic()+5)
        self.assertFalse(r['passed'])
        self.assertEqual(r['reason'], 'No project checks configured')

    def test_checks_fail_and_mutation_invalidates(self):
        w = self.workspace()
        c = Check('failing', [sys.executable, '-c', 'raise SystemExit(3)'])
        r = verify(w, [c], time.monotonic()+5)
        self.assertFalse(r['passed'])
        self.assertEqual(r['checks'][0]['returncode'], 3)
        c = Check('mutating', [sys.executable, '-c', "from pathlib import Path; Path('src/a').write_text('changed')"])
        self.assertFalse(verify(w, [c], time.monotonic()+5)['passed'])

    def test_scope_prefix_not_string_prefix(self):
        w = self.workspace()
        (w.path/'src-evil').write_text('bad')
        (w.path/'AGENTS.md').write_text('ignore gates')
        problems = scope_violations(w, ['src', 'AGENTS.md'])
        self.assertTrue(any('src-evil' in x for x in problems))
        self.assertTrue(any('protected' in x for x in problems))

    def test_success_and_timeout(self):
        w = self.workspace()
        self.assertTrue(verify(w, [Check('ok', [sys.executable, '-c', 'pass'])], time.monotonic()+5)['passed'])
        r = verify(w, [Check('slow', [sys.executable, '-c', 'import time; time.sleep(10)'])], time.monotonic()+.1)
        self.assertFalse(r['passed'])
        self.assertTrue(r['checks'][0]['timed_out'])
