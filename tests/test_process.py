import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from harness.process import run_process

class ProcessTests(unittest.TestCase):
    def test_literal_argv_and_failure(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            r = run_process([sys.executable, '-c', 'import sys; print(sys.argv[1]); sys.exit(7)', '$(touch BAD)'], p, 3, p/'logs')
            self.assertEqual(r.returncode, 7)
            self.assertEqual((p/'logs/stdout.log').read_text().strip(), '$(touch BAD)')
            self.assertFalse((p/'BAD').exists())

    def test_timeout_kills_descendant(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            code = "import subprocess,sys,time; subprocess.Popen([sys.executable,'-c',\"import time; from pathlib import Path; time.sleep(1); Path('BAD').touch()\"]); time.sleep(10)"
            r = run_process([sys.executable, '-c', code], p, .15, p/'logs')
            self.assertTrue(r.timed_out)
            time.sleep(1.1)
            self.assertFalse((p/'BAD').exists())

    def test_missing_executable_is_diagnostic(self):
        with tempfile.TemporaryDirectory() as d:
            r = run_process(['/nonexistent/codex'], Path(d), 1, Path(d)/'logs')
            self.assertEqual(r.returncode, 127)
            self.assertFalse(r.timed_out)

    def test_successful_parent_cannot_leave_background_writer(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)
            code="import subprocess,sys; subprocess.Popen([sys.executable,'-c',\"import time; from pathlib import Path; time.sleep(1); Path('BAD').touch()\"])"
            r=run_process([sys.executable,'-c',code],p,3,p/'logs')
            self.assertEqual(r.returncode,0)
            time.sleep(1.1)
            self.assertFalse((p/'BAD').exists())
