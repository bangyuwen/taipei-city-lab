import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access, copyFile, cp, mkdtemp, readFile, rm, unlink, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceAudit = 'research/execution-2026-10-15/source-audit';
const sourceRecovery = 'research/source-recovery-2026-10-15';
const verifierRelative = `${sourceAudit}/verify_source_audit.py`;
const canonicalVerifier = resolve(siteRoot, '..', '..', 'topics/bins/research/execution-2026-10-15/source-audit/verify_source_audit.py');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function makeFixture(t) {
  const fixture = await mkdtemp(join(tmpdir(), 'waste-source-audit-'));
  await cp(resolve(siteRoot, sourceAudit), resolve(fixture, sourceAudit), {recursive: true});
  await cp(resolve(siteRoot, sourceRecovery), resolve(fixture, sourceRecovery), {recursive: true});
  try {
    await access(canonicalVerifier);
    await copyFile(canonicalVerifier, resolve(fixture, verifierRelative));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  t.after(() => rm(fixture, {recursive: true, force: true}));
  return fixture;
}

function runVerifier(fixture) {
  const result = spawnSync('python3', [verifierRelative], {cwd: fixture, encoding: 'utf8'});
  assert.equal(result.error, undefined, result.error?.message);
  return result;
}

async function readReport(fixture) {
  return JSON.parse(await readFile(resolve(fixture, sourceAudit, 'verification.json'), 'utf8'));
}

test('valid frozen source audit produces identical report and annual CSV on repeated CLI runs', async t => {
  const fixture = await makeFixture(t);
  const first = runVerifier(fixture);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const firstReportText = await readFile(resolve(fixture, sourceAudit, 'verification.json'));
  const firstAnnual = await readFile(resolve(fixture, sourceAudit, 'annual-values.csv'));
  const report = JSON.parse(firstReportText);
  assert.equal('verified_at_utc' in report, false);
  assert.equal(typeof report.source_ids_and_dates.statistics_request_time_utc, 'string');
  assert.equal(report.all_manifest_files_match, true);
  assert.equal(report.all_required_observations_pass, true);

  const second = runVerifier(fixture);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.deepEqual(await readFile(resolve(fixture, sourceAudit, 'verification.json')), firstReportText);
  assert.deepEqual(await readFile(resolve(fixture, sourceAudit, 'annual-values.csv')), firstAnnual);
});

test('missing or corrupted unused manifest files preserve diagnostics and exit nonzero', async t => {
  for (const state of ['missing', 'corrupted']) {
    await t.test(state, async t => {
      const fixture = await makeFixture(t);
      const manifestPath = resolve(fixture, sourceRecovery, 'manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      const expectedBytes = Buffer.from('frozen unused input\n');
      const unusedPath = 'raw/unused-manifest-input.json';
      manifest.files[unusedPath] = {bytes: expectedBytes.length, sha256: hash(expectedBytes)};
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      if (state === 'corrupted') {
        await writeFile(resolve(fixture, sourceRecovery, unusedPath), 'changed input\n');
      }

      const result = runVerifier(fixture);
      assert.notEqual(result.status, 0, result.stdout);
      const report = await readReport(fixture);
      assert.equal(report.all_manifest_files_match, false);
      assert.equal(report.all_required_observations_pass, true);
      assert.deepEqual(report.manifest_file_checks.at(-1), {
        path: unusedPath,
        exists: state === 'corrupted',
        expected_bytes: expectedBytes.length,
        actual_bytes: state === 'corrupted' ? Buffer.byteLength('changed input\n') : null,
        expected_sha256: hash(expectedBytes),
        actual_sha256: state === 'corrupted' ? hash(Buffer.from('changed input\n')) : null,
        match: false,
      });
      assert.equal(report.datasets['2024-10-18-archive'].rows, 1971);
      assert.ok((await readFile(resolve(fixture, sourceAudit, 'annual-values.csv'))).length > 0);
    });
  }
});

test('a false required observation exits nonzero after an internally consistent manifest check', async t => {
  const fixture = await makeFixture(t);
  const manifestPath = resolve(fixture, sourceRecovery, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const catalogPath = resolve(fixture, sourceRecovery, 'raw/catalog-parsed.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  catalog.number_of_data = 2008;
  const catalogBytes = Buffer.from(`${JSON.stringify(catalog, null, 2)}\n`);
  await writeFile(catalogPath, catalogBytes);
  manifest.files['raw/catalog-parsed.json'] = {bytes: catalogBytes.length, sha256: hash(catalogBytes)};
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const result = runVerifier(fixture);
  assert.notEqual(result.status, 0, result.stdout);
  const report = await readReport(fixture);
  assert.equal(report.all_manifest_files_match, true);
  assert.equal(report.required_observations.catalog_number_of_data_is_2009, false);
  assert.equal(report.all_required_observations_pass, false);
});

test('a missing CSV required for aggregation exits nonzero', async t => {
  const fixture = await makeFixture(t);
  await unlink(resolve(fixture, sourceRecovery, 'taipei-bins-2024-10-18-archive-utc.csv'));
  await unlink(resolve(fixture, sourceAudit, 'verification.json'));

  const result = runVerifier(fixture);
  assert.notEqual(result.status, 0, result.stdout);
});
