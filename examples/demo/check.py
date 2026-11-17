"""A labeled wiring demo, not an application acceptance suite."""
from pathlib import Path
assert Path('examples/demo/message.txt').read_text().strip() == 'Codex harness demo'
print('Demo fixture verified (not project acceptance)')
