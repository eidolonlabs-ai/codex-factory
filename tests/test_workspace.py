import tempfile
import unittest
from pathlib import Path
from harness.models import Task
from harness.workspace import prepare_workspace, git, release_workspace, snapshot_candidate, changed_paths
from tests.test_models import TASK

class GitCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)/'repo'; self.repo.mkdir()
        git(self.repo, 'init', '-b', 'main')
        git(self.repo, 'config', 'user.email', 'test@example.invalid')
        git(self.repo, 'config', 'user.name', 'Test')
        (self.repo/'src').mkdir(); (self.repo/'src/a').write_text('base')
        git(self.repo, 'add', '.'); git(self.repo, 'commit', '-m', 'base')
        self.task = Task(**TASK)
    def workspace(self, run_id='one'):
        w = prepare_workspace(self.repo, self.task, run_id)
        self.addCleanup(release_workspace, w)
        return w

class WorkspaceTests(GitCase):
    def test_lock_and_preservation(self):
        w = self.workspace()
        self.assertTrue((w.path/'src/a').exists())
        with self.assertRaises(ValueError): self.workspace('two')
        (w.path/'src/a').write_text('changed')
        self.assertEqual((self.repo/'src/a').read_text(), 'base')

    def test_dirty_and_existing_destination(self):
        (self.repo/'untracked').write_text('keep')
        with self.assertRaises(ValueError): self.workspace()
        self.assertEqual((self.repo/'untracked').read_text(), 'keep')

    def test_snapshot_covers_commits_untracked_modes_and_deletion(self):
        w = self.workspace(); first = snapshot_candidate(w)
        (w.path/'src/a').write_text('committed'); git(w.path, 'add', '.'); git(w.path, 'commit', '-m', 'change')
        (w.path/'new').write_text('untracked')
        self.assertNotEqual(first, snapshot_candidate(w))
        self.assertEqual(set(changed_paths(w)), {'src/a', 'new'})
        second = snapshot_candidate(w); (w.path/'new').chmod(0o755)
        self.assertNotEqual(second, snapshot_candidate(w))

    def test_linked_worktree_common_dir(self):
        w = self.workspace()
        other = prepare_workspace(w.path, Task(**(TASK | dict(id='other'))), 'two')
        self.addCleanup(release_workspace, other)
        self.assertEqual(w.run_dir.parent, other.run_dir.parent)

    def test_unborn_repo_rejected(self):
        p = Path(self.temp.name)/'unborn'; p.mkdir(); git(p, 'init')
        with self.assertRaises(ValueError): prepare_workspace(p, self.task, 'zero')

    def test_leading_newline_filename_content_is_hashed(self):
        w = self.workspace()
        p = w.path/'\nfile'; p.write_text('one')
        first = snapshot_candidate(w)
        self.assertIn('\nfile', changed_paths(w))
        p.write_text('two')
        self.assertNotEqual(first, snapshot_candidate(w))
