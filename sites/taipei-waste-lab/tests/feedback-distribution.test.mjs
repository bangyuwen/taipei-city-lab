import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function python(code) {
  const result = spawnSync(process.env.PYTHON_BIN || 'python3', ['-c', code], {cwd: new URL('../', import.meta.url), encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

const setup = String.raw`
import copy,csv,hashlib,json,runpy,shutil,tempfile
from collections import Counter
from pathlib import Path
m=runpy.run_path('scripts/analyze-feedback.py')
research=Path('research')
data=json.loads((research/'feedback-2026-10-17/summary.json').read_text())
def fails(call,fragment):
 try:call()
 except ValueError as e:assert fragment in str(e),str(e)
 else:raise AssertionError('Invalid source accepted')
`;

test('official row join preserves missing coverage, invalid coordinates and duplicated positions', () => python(setup + String.raw`
joined=m['load_distribution'](data)
with (research/'source-recovery-2026-10-15/taipei-bins-2026-09-30-published.csv').open(encoding='utf-8-sig',newline='') as f:
 rows=list(csv.DictReader(f))
counts=Counter(r['行政區'] for r in rows)
assert len(joined['bins'])==12 and sum(data['districts'].values())==2663
assert sum(g['rows'] for g in joined['bins'].values())==681==len(rows)
for district,g in joined['bins'].items():assert g['rows']==counts[district+'區']
assert joined['bins']['北投']['rows']==0
assert joined['bins']['南港']['rows']==4
assert joined['bins']['文山']['rows']==51 and joined['bins']['文山']['plottable']==50
assert joined['bins']['士林']['rows']==142 and joined['bins']['士林']['distinctPlottableCoordinates']==141
assert sum(g['plottable'] for g in joined['bins'].values())==680
assert joined['source']['inventoryComplete'] is None and joined['source']['surveyDate'] is None
assert joined['source']['sha256']==joined['source']['retainedRawSha256']
`));

test('source drift and incomplete district interpretations fail before publishing new conclusions', () => python(setup + String.raw`
with tempfile.TemporaryDirectory() as directory:
 target=Path(directory)
 for name in ('feedback-2026-10-17','feedback-distribution-2026-10-18','bin-coverage-2026-10-18','source-recovery-2026-10-15'):
  shutil.copytree(research/name,target/name)
 report=target/'feedback-distribution-2026-10-18'
 original=(report/'assessments.json').read_text()
 a=json.loads(original);a['districts'].pop('北投')
 (report/'assessments.json').write_text(json.dumps(a))
 fails(lambda:m['load_distribution'](data,target),'Every feedback district')
 (report/'assessments.json').write_text(original)
 changed=copy.deepcopy(data);changed['districtAnalysis']['松山']['themes']['A']-=1
 fails(lambda:m['load_distribution'](changed,target),'reviewed semantic summary')
 source=target/'source-recovery-2026-10-15/taipei-bins-2026-09-30-published.csv'
 source.write_bytes(source.read_bytes()+b'\n')
 fails(lambda:m['load_distribution'](data,target),'Official CSV changed')
`));

test('joined narrative distinguishes retention requests from shortage and retains inspectable outputs', () => python(setup + String.raw`
joined=m['load_distribution'](data)
md,parts=m['render_district_diagram'](data,joined);text='\n'.join(parts)
assert text.count('data-bin-rows=')==12
assert '主檔未列本區' in text and '公開清單 4 列' in text and '不等於現場桶數' in text
assert '保留既有設施' in text and '互斥票數' in text and '沒有把留言配到某個垃圾桶' in text
assert '偏向增設／恢復／保留桶 92／241（38.2%）' in text
assert '清掃、清運與設備維護 110／241（45.6%）' in text
assert '家戶收運與投放管道 25／135（18.5%）' in text
rows=[line for line in md if line.startswith('|')]
assert len(rows)==14 and all(line.count('|')==6 for line in rows)
report=m['distribution_report'](data,joined)
assert report==(research/'feedback-distribution-2026-10-18/README.md').read_text()
assert report==Path('dist/research/feedback-distribution-2026-10-18/README.md').read_text()
assert '681 位置列、680 列通過既有座標粗篩、2663 則回饋' in report
public=runpy.run_path('scripts/prepare-public.py')['ASSETS']
assert not any('feedback-distribution' in asset for asset in public)
`));


test('venue leads enrich all districts without becoming verified street stock', () => python(setup + String.raw`
joined=m['load_distribution'](data)
expected={'松山':7,'信義':18,'大安':18,'中山':16,'中正':16,'大同':14,'萬華':3,'文山':9,'南港':5,'內湖':7,'士林':7,'北投':10}
assert {d:len(v) for d,v in joined['venues'].items()}==expected
assert sum(map(len,joined['venues'].values()))==130
assert joined['coverage']['addedVerifiedStreetRows']==0
assert joined['bins']['北投']['rows']==0 and joined['bins']['南港']['rows']==4
text='\n'.join(m['render_district_diagram'](data,joined)[1])
assert text.count('data-venue-count=')==12
assert text.count('<article class="coverage-focus-item">')==2
for d in ['北投','南港']:
 for name in joined['venues'][d]:assert name in text
assert '不能直接當成可用投放點' in text and '沒有確認北投全區撤除' in text
assert '北投 0 列、南港 4 列是公開清單的缺口' not in text
`));

test('changed map identity and venue provenance cannot silently retain district interpretations', () => python(setup + String.raw`
with tempfile.TemporaryDirectory() as directory:
 target=Path(directory)
 for name in ('feedback-2026-10-17','feedback-distribution-2026-10-18','bin-coverage-2026-10-18','source-recovery-2026-10-15'):
  shutil.copytree(research/name,target/name)
 manifest=target/'bin-coverage-2026-10-18/source-check.json'
 original=manifest.read_bytes()
 source=target/'bin-coverage-2026-10-18/official-map-data.json'
 raw=source.read_bytes();rows=json.loads(raw);rows[0]=rows[0].replace('中正區','北投區',1)
 source.write_text(json.dumps(rows,ensure_ascii=False))
 fails(lambda:m['load_distribution'](data,target),'Coverage source no longer matches')
 # Even an explicitly refreshed digest must satisfy the same-source comparison.
 receipt=json.loads(original)
 for entry in receipt['sources']:
  if entry['retainedPath'].endswith('/official-map-data.json'):
   entry['sha256']=hashlib.sha256(source.read_bytes()).hexdigest();entry['bytes']=source.stat().st_size
 manifest.write_text(json.dumps(receipt,ensure_ascii=False))
 a_path=target/'feedback-distribution-2026-10-18/assessments.json'
 a=json.loads(a_path.read_text());a['coverageSha256']=hashlib.sha256(manifest.read_bytes()).hexdigest();a_path.write_text(json.dumps(a,ensure_ascii=False))
 fails(lambda:m['load_distribution'](data,target),'Official map and street CSV differ')
 source.write_bytes(raw);manifest.write_bytes(original)
 a['coverageSha256']=hashlib.sha256(original).hexdigest();a_path.write_text(json.dumps(a,ensure_ascii=False))
 venue=target/'source-recovery-2026-10-15/raw/official-tourist.csv'
 venue.write_bytes(venue.read_bytes()+b'\n')
 fails(lambda:m['load_distribution'](data,target),'Coverage source no longer matches')
`));
