import json
import tempfile
import unittest
from pathlib import Path
from harness.evidence import write_result

class EvidenceTests(unittest.TestCase):
    def test_failed_serialization_preserves_previous_record(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)
            write_result(p, {'status':'running'})
            with self.assertRaises(TypeError): write_result(p, {'bad':object()})
            self.assertEqual(json.loads((p/'result.json').read_text()), {'status':'running'})
            self.assertEqual([x.name for x in p.iterdir()], ['result.json'])
