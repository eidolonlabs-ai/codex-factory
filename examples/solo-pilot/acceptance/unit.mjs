import assert from 'node:assert/strict';
import {normalizeTitle} from '../src/title.mjs';
assert.equal(normalizeTitle('  hello  '),'hello');
assert.equal(normalizeTitle(' \t\n '),'');
assert.equal(normalizeTitle(null),'');
console.log('Title normalization passed');
