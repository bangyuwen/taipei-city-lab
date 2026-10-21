import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('MRT comparison preserves cohort, radius, source-row and venue-unit boundaries',()=>{
  execFileSync('python', [fileURLToPath(new URL('../research/mrt-bin-comparison-2026-10-22/test_analysis.py',import.meta.url))], {stdio:'pipe'});
});
