import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('citywide analysis preserves eligibility, source and distance boundaries', () => {
  const result = spawnSync(process.env.PYTHON_BIN || 'python3', [fileURLToPath(new URL('../research/taipei-citywide-2026-10-19/test_analysis.py', import.meta.url))], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
