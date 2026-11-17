from pathlib import Path
import time
from harness.review import review_candidate
from harness.workspace import git, snapshot_candidate
from tests.test_workspace import GitCase

class ReviewTests(GitCase):
    def test_review_covers_committed_and_dirty_and_untracked(self):
        w = self.workspace()
        (w.path/'src/a').write_text('committed'); git(w.path, 'add', '.'); git(w.path, 'commit', '-m', 'worker')
        (w.path/'src/b').write_text('new file')
        (w.path/'src/a').write_text('dirty')
        fake = Path(self.temp.name)/'fake-codex'
        fake.write_text('#!/usr/bin/env python3\nimport subprocess,sys\nbase=sys.argv[-1]\nprint(subprocess.check_output(["git","diff","--name-only",base,"HEAD"],text=True))\n')
        fake.chmod(0o755)
        original = snapshot_candidate(w)
        r = review_candidate(w, original, time.monotonic()+10, codex=str(fake))
        self.assertTrue(r['collected'])
        self.assertIn('src/a', Path(r['process']['log_dir'], 'stdout.log').read_text())
        self.assertIn('src/b', Path(r['process']['log_dir'], 'stdout.log').read_text())
        self.assertEqual(original, snapshot_candidate(w))

    def test_failure_or_drift_never_collected(self):
        w = self.workspace()
        r = review_candidate(w, 'stale', time.monotonic()+10, codex='/nonexistent')
        self.assertFalse(r['collected'])
        r = review_candidate(w, snapshot_candidate(w), time.monotonic()+10, codex='/nonexistent')
        self.assertFalse(r['collected'])
