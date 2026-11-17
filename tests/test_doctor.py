from harness.doctor import doctor
from tests.test_workspace import GitCase

class DoctorTests(GitCase):
    def test_missing_codex_and_checks_are_not_healthy(self):
        result = doctor(self.repo, codex='/nonexistent')
        self.assertFalse(result['healthy'])
        self.assertTrue(any('Codex' in e for e in result['errors']))
        self.assertTrue(any('configuration' in e for e in result['errors']))
