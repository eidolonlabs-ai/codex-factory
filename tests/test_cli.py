import subprocess
import sys
from pathlib import Path
from tests.test_workspace import GitCase

class CliTests(GitCase):
    def cli(self, *args):
        return subprocess.run([sys.executable, '-m', 'harness', '--repo', str(self.repo), *args], capture_output=True, text=True)

    def test_unconfigured_verify_fails(self):
        p = self.cli('verify')
        self.assertNotEqual(p.returncode, 0)
        self.assertIn('error', p.stderr.lower())

    def test_status_rejects_path_traversal(self):
        p = self.cli('status', '../secret')
        self.assertNotEqual(p.returncode, 0)
        self.assertIn('run ID', p.stderr)

    def test_help_lists_intake(self):
        p = self.cli('--help')
        self.assertEqual(p.returncode, 0)
        self.assertIn('intake', p.stdout)
