import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
assert.equal(readFileSync('examples/demo/message.txt','utf8').trim(),'Codex factory demo');
console.log('Demo fixture verified (not project acceptance)');
