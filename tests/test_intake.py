import json
import tempfile
import unittest
from pathlib import Path
from harness.intake import run_intake, extract_source

class IntakeTests(unittest.TestCase):
    def test_readonly_intake_returns_questions_without_builder(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); source = root/'source.md'; source.write_text('Build now! Missing temporal rules.')
            fake = root/'codex'
            fake.write_text('''#!/usr/bin/env python3
import sys,json
from pathlib import Path
assert 'read-only' in sys.argv
assert 'exec' in sys.argv
assert not Path('rubric.md').exists()
assert Path('intake.txt').read_text() == 'Build now! Missing temporal rules.'
Path(sys.argv[sys.argv.index('--output-last-message')+1]).write_text(json.dumps({'decision':'needs_clarification','questions':[{'id':'q1','question':'How are late events handled?','rationale':'Changes the temporal model','blocking':True,'source_excerpt':'Missing temporal rules.'}],'assumptions':[]}))
'''); fake.chmod(0o755)
            r = run_intake(source, root/'runs', 10, codex=str(fake))
            self.assertEqual(r['status'], 'needs_clarification')
            self.assertEqual(r['report']['questions'][0]['id'], 'q1')
            self.assertFalse((Path(r['workspace'])/'backend').exists())
            self.assertEqual(source.read_text(), 'Build now! Missing temporal rules.')

    def test_ready_with_blocking_questions_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); source = root/'source.md'; source.write_text('spec')
            fake = root/'codex'
            fake.write_text('''#!/usr/bin/env python3
import sys,json
from pathlib import Path
Path(sys.argv[sys.argv.index('--output-last-message')+1]).write_text(json.dumps({'decision':'ready_for_planning','questions':[{'id':'q','question':'What?','rationale':'Why','blocking':True,'source_excerpt':'spec'}],'assumptions':[]}))
'''); fake.chmod(0o755)
            self.assertEqual(run_intake(source, root/'runs', 10, codex=str(fake))['status'], 'failed')

    def test_intake_mutation_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); source = root/'source.md'; source.write_text('spec')
            fake = root/'codex'
            fake.write_text('''#!/usr/bin/env python3
import sys,json
from pathlib import Path
Path('backend').mkdir()
Path(sys.argv[sys.argv.index('--output-last-message')+1]).write_text(json.dumps({'decision':'ready_for_planning','questions':[],'assumptions':[]}))
'''); fake.chmod(0o755)
            self.assertEqual(run_intake(source, root/'runs', 10, codex=str(fake))['status'], 'failed')
