#!/usr/bin/env python3
"""Build six self-contained topic sites from canonical models and the shared UI.

This is an offline, standard-library-only build. Root dist/ is the current
shared web template; generated site files must not become parallel sources.
The existing taipei-waste-lab is deliberately outside this builder's scope.
"""
from __future__ import annotations

import argparse
import html
import importlib.util
import json
from pathlib import Path
import re
import shutil
import tempfile


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "shared/web/topic-sites.json"
TOPIC_IDS = ("shade", "rat", "traffic", "bus", "buildings", "audit")
WEB_FILES = (
    "styles.css", "workspace.css", "mark.svg", "viz.js", "geo.js", "contracts.js",
    "map-ui.js", "map-data.js", "scene-ui.js", "scene-data.js", "scene-builder.js", "basemap3d.js",
)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def js(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def replace_once(text: str, old: str, new: str) -> str:
    """Fail explicitly when a shared-template change needs a reviewed adapter."""
    count = text.count(old)
    if count != 1:
        raise ValueError(f"Shared template changed: expected one {old[:100]!r}, found {count}")
    return text.replace(old, new, 1)


def object_bounds(text: str, name: str) -> tuple[int, int]:
    match = re.search(rf"(?:export\s+)?const\s+{re.escape(name)}\s*=\s*\{{", text)
    if not match:
        raise ValueError(f"Cannot find plain configuration object {name}")
    start = match.end() - 1
    quote = None
    escaped = False
    depth = 0
    for index in range(start, len(text)):
        char = text[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in "\"'`":
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return start, index
    raise ValueError(f"Unterminated configuration object {name}")


def select_members(text: str, name: str, keep: set[str]) -> str:
    """Select members of reviewed plain data objects, without evaluating JS.

    Used only for string/array/object literals such as research summaries and
    icons. Model and renderer functions are copied without parsing their JS.
    """
    start, end = object_bounds(text, name)
    content = text[start + 1:end]
    members = []
    member_start = 0
    quote = None
    escaped = False
    depth = 0
    for index, char in enumerate(content):
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in "\"'`":
            quote = char
        elif char in "{[(":
            depth += 1
        elif char in "}])":
            depth -= 1
        elif char == "," and depth == 0:
            members.append(content[member_start:index])
            member_start = index + 1
    members.append(content[member_start:])
    selected = []
    seen = set()
    for member in members:
        if not member.strip():
            continue
        match = re.match(r"\s*(?:([A-Za-z_$][\w$]*)|'([^']+)'|\"([^\"]+)\")\s*:", member)
        if not match:
            raise ValueError(f"Unsupported member in {name}: {member[:80]!r}")
        key = next(value for value in match.groups() if value is not None)
        if key in keep:
            selected.append(member.strip())
            seen.add(key)
    if not keep.issubset(seen):
        raise ValueError(f"Missing members in {name}: {sorted(keep - seen)}")
    return text[:start + 1] + "\n  " + ",\n  ".join(selected) + ("\n" if selected else "") + text[end:]


def canonical_model(topic_id: str) -> str:
    source = ROOT / "topics" / topic_id / "model.js"
    if not source.is_file():
        source = ROOT / "dist/modules" / f"{topic_id}.js"
    text = read(source)
    # Canonical imports become local within each independently served dist/.
    return (text.replace("../../shared/lib/spatial.js", "./spatial.js")
                .replace("../../shared/lib/contracts.js", "../contracts.js"))


def shared_library(name: str) -> str:
    canonical = ROOT / "shared/lib" / name
    fallback = ROOT / "dist" / (f"modules/{name}" if name == "spatial.js" else name)
    return read(canonical if canonical.is_file() else fallback)


def topic_html(template: str, topic_id: str, config: dict) -> str:
    brand = html.escape(config["brand"])
    title = html.escape(config["title"])
    text = re.sub(r'<meta name="description" content="[^"]*">',
                  '<meta name="description" content="' + html.escape(config["description"], quote=True) + '">', template, count=1)
    text = re.sub(r"<title>.*?</title>", f"<title>{brand}｜{title}</title>", text, count=1)
    text = re.sub(r'<a class="brand"[\s\S]*?</a>',
                  f'<a class="brand" href="#{topic_id}" aria-label="{brand}首頁"><img src="./mark.svg" width="42" height="42" alt=""><span>台北<strong>{brand.removeprefix("台北")}</strong></span></a>', text, count=1)
    text = re.sub(r'\s*<a class="home-link"[^>]*>[\s\S]*?</a>', '', text, count=1)
    text = text.replace('選擇城市問題', '本站研究導覽').replace('選一個你在意的問題', '本題研究')
    text = text.replace('aria-label="七個城市問題"', 'aria-label="本站研究"')
    text = replace_once(text, '<a href="#explore" class="topbar-title">城市問題，研究回答</a>',
                        f'<a href="#{topic_id}" class="topbar-title">{title}，從證據開始</a>')
    text = text.replace('匯出七題結論與研究包', '匯出本題結論與研究包')
    text, count = re.subn(r'<section id="city-intro"[\s\S]*?</section>',
                         '<section id="city-intro" hidden><button id="begin-exploring" hidden>閱讀本題結論</button></section>', text, count=1)
    if count != 1:
        raise ValueError('Shared template lost city-intro boundary')
    text = text.replace('正在載入城市資料與情境', '正在載入本題資料與情境')
    text = text.replace('台北城市實驗室是研究試作。', brand + '是研究試作。')
    downloads = (f'<details class="research-downloads"><summary>本題研究文件與資料</summary><div>'
                 '<a href="./RESEARCH.md" download>本題研究說明</a>'
                 '<a href="./data/snapshot.json" download>本題資料快照</a>'
                 f'<a href="./modules/{topic_id}.js" download>本題模型程式</a></div></details>')
    text, count = re.subn(r'<details class="research-downloads">[\s\S]*?</details>', downloads, text, count=1)
    if count != 1:
        raise ValueError('Shared template lost research-downloads boundary')
    return text


def topic_app(template: str, topic_id: str, config: dict) -> str:
    text = select_members(template, 'citizenContent', {topic_id})
    text = select_members(text, 'topicPaths', {topic_id, 'close', 'external'})
    text = replace_once(text, "const storageKey='taipei-city-lab-v1';",
                        f"const storageKey={js(config['directory'] + '-v1')};")
    text, count = re.subn(r"const badgeText=\[[^\n]+\];", f"const badgeText=[{js(config['badge'])}];", text, count=1)
    if count != 1:
        raise ValueError('Shared template lost badgeText boundary')
    text = replace_once(text, "const ordered=[...modules.filter(m=>m.id==='bins'),...modules.filter(m=>m.id!=='bins')];", 'const ordered=modules;')
    text = replace_once(text, "active=modules.find(m=>m.id===id)||modules.find(m=>m.id==='bins');", 'active=modules.find(m=>m.id===id)||modules[0];')
    text = replace_once(text, "document.title=`${topics[index]} — 台北城市實驗室`;", f"document.title={js(config['brand'])}+`｜${{topics[index]}}`;")
    text = replace_once(text, "$('city-intro').hidden=Boolean(id&&id!=='explore');", "$('city-intro').hidden=true;")
    text = replace_once(text, "title:'台北城市實驗室・七題研究包'", 'title:' + js(config['brand'] + '・本題研究包'))
    text = text.replace("download('taipei-city-lab-research.json'", "download(" + js(config['directory'] + '-research.json'))
    text = text.replace('已匯出七題結論、方案、假設與資料來源。', '已匯出本題結論、方案、假設與資料來源。')
    if topic_id != 'audit':
        text = text.replace("from './modules/audit.js'", "from './modules/csv-audit.js'")
    return text


def topic_answers(template: str, topic_id: str) -> str:
    # Bin-specific benchmarks and policy sources belong to the waste site.
    findings = template.index('const findings=')
    text = template[findings:]
    text = select_members(text, 'findings', {topic_id})
    text = replace_once(text, "  if(id==='bins'){answer.snapshot=binSnapshotFacts(data);answer.benchmark=binBenchmark(params,data);answer.references=Object.values(answerSources);}\n", '')
    if topic_id == 'shade':
        text = "import {bboxOf,validFacilities} from './modules/spatial.js';\n" + text
    else:
        text = replace_once(text, "  if(id==='shade')answer.observedCount=validFacilities(data.trees,bboxOf(data)).length;\n", '')
    return text


def load_data_builder():
    path = ROOT / 'scripts/build-topic-data.py'
    if not path.is_file():
        raise ValueError('Run after scripts/build-topic-data.py is available; no network fallback is used.')
    spec = importlib.util.spec_from_file_location('topic_data_builder', path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def research_document(topic_id: str, config: dict, snapshot: dict) -> str:
    lines = [f"# {config['brand']}｜{config['title']}", '', config['description'], '',
             '## 使用與資料界線', '',
             '- 先讀研究結論、依據與缺口，再展開模型、參數、地圖及明細。',
             '- 真實快照與合成情境分開標示；模型結果不代表實際政策成效或核准方案。',
             '- 本站只載入本題資料。資料健檢站僅帶來源目錄，不附其他題目的觀測陣列。',
             '- 參數方案儲存在本站專屬的瀏覽器儲存空間；CSV 僅在本機處理。',
             '- 模型、圖表與來源說明可離線使用；街道底圖需要連網，底圖失敗不改寫觀測資料。', '',
             '## 快照資訊', '', '```json', json.dumps(snapshot.get('meta', {}), ensure_ascii=False, indent=2), '```', '',
             '## 本題來源', '']
    for key, source in snapshot.get('sources', {}).items():
        lines.append(f"### {source.get('title', key)}")
        integration_status = source.get('integrationStatus', '未提供')
        if topic_id == 'audit' and integration_status == 'loaded':
            integration_status = '原題已載入觀測；本站僅保存目錄'
        lines.extend(['', f"- 來源：{source.get('url', '未提供')}", f"- 整合狀態：{integration_status}",
                      f"- 粒度：{source.get('grain', '未提供')}"])
        limits = source.get('limitations', [])
        if not isinstance(limits, list):
            limits = [limits]
        lines.extend('- 限制：' + str(limit) for limit in limits if limit)
        lines.append('')
    lines.extend(['## 維護方式', '',
                  f"模型來源：`topics/{topic_id}/model.js`；資料來源：`topics/{topic_id}/data/`。",
                  '共用網頁目前取自根目錄 `dist/`；本站 `dist/` 為生成輸出，不直接維護分叉版本。',
                  f"重建：`python scripts/build-topic-sites.py --topic {topic_id}`。", ''])
    return '\n'.join(lines)


def site_readme(topic_id: str, config: dict) -> str:
    return f"""# {config['brand']}

{config['description']}

這是 `{topic_id}` 的獨立靜態網站。`dist/` 包含本站使用的程式、模型、字型、供應商套件與專屬資料快照，不讀取其他站的檔案。

## 單獨啟動

```sh
cd sites/{config['directory']}
python -m http.server 8000 --directory dist
```

開啟 `http://localhost:8000/`。模型、圖表、來源與匯出功能不需要 CDN；街道底圖是 OpenStreetMap 連網服務，無網路仍可使用模型與圖表。

## 修改與重建

- 題目模型：`topics/{topic_id}/model.js`。
- 題目資料與證據：`topics/{topic_id}/data/`。
- 共用模型工具：`shared/lib/`。
- 共用網頁模板：目前為根目錄 `dist/`；本站入口與品牌配置在 `shared/web/topic-sites.json`。
- 生成器：`scripts/build-topic-sites.py`。本站 `dist/` 是生成輸出，請修改來源後重建。

從 repository 根目錄執行：

```sh
python scripts/build-topic-sites.py --topic {topic_id}
python scripts/build-topic-sites.py --check --topic {topic_id}
```

只有本題註冊在 `dist/registry.js`。每站使用自己的 localStorage key、資料快照與研究包；不含七題首頁、跨題導覽或其他題目的下載包。通用 CSV 與 3D 動畫可能共用演算法 helper，但不註冊其他題目或載入其觀測資料。

`.openai/` 是此站自己的託管設定；生成器不會改寫它，也不會自動部署。
"""


def generate(destination: Path, topic_id: str, config: dict, data_builder) -> None:
    target = destination / 'dist'
    target.mkdir(parents=True, exist_ok=True)
    template = ROOT / 'dist'
    for filename in WEB_FILES:
        text = shared_library(filename) if filename in {'geo.js', 'contracts.js'} else read(template / filename)
        write(target / filename, text)
    for directory in ('fonts', 'vendor'):
        shutil.copytree(template / directory, target / directory)
    write(target / 'modules/spatial.js', shared_library('spatial.js'))
    write(target / f'modules/{topic_id}.js', canonical_model(topic_id))
    if topic_id != 'audit':
        csv_helpers = canonical_model('audit').split('const officialChecks =', 1)[0]
        write(target / 'modules/csv-audit.js', csv_helpers.rstrip() + '\n')
    scene_data = read(template / 'scene-data.js')
    for helper in ('traffic', 'bus'):
        if topic_id != helper:
            text = canonical_model(helper).split(f'export const {helper} =', 1)[0]
            write(target / f'modules/{helper}-helpers.js', text.rstrip() + '\n')
            scene_data = scene_data.replace(f"./modules/{helper}.js", f"./modules/{helper}-helpers.js")
    write(target / 'scene-data.js', scene_data)
    write(target / 'registry.js', f"import {{{topic_id}}} from './modules/{topic_id}.js';\nexport const modules=[{topic_id}];\nexport const tones=[{js(config['accent'])}];\nexport const topics=[{js(config['title'])}];\n")
    write(target / 'index.html', topic_html(read(template / 'index.html'), topic_id, config))
    write(target / 'app.js', topic_app(read(template / 'app.js'), topic_id, config))
    write(target / 'answers.js', topic_answers(read(template / 'answers.js'), topic_id))
    write(target / 'research.js', select_members(read(template / 'research.js'), 'research', {topic_id}))
    workflow_ids = {topic_id} if topic_id in {'rat', 'buildings'} else set()
    write(target / 'workflows.js', select_members(read(template / 'workflows.js'), 'workflowDefs', workflow_ids))
    snapshot = data_builder.per_topic_snapshot(topic_id)
    if not isinstance(snapshot.get('meta'), dict) or not isinstance(snapshot.get('sources'), dict):
        raise ValueError(f'{topic_id}: snapshot must contain meta/sources objects')
    if topic_id != 'shade' and 'trees' in snapshot:
        raise ValueError(f'{topic_id}: unrelated tree observations leaked into snapshot')
    if 'bins' in snapshot:
        raise ValueError(f'{topic_id}: unrelated bin observations leaked into snapshot')
    write(target / 'data/snapshot.json', json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    write(target / 'RESEARCH.md', research_document(topic_id, config, snapshot))
    write(destination / 'README.md', site_readme(topic_id, config))
    package = {'name': config['directory'], 'version': '1.0.0', 'private': True, 'type': 'module',
               'scripts': {'build': f'python ../../scripts/build-topic-sites.py --topic {topic_id}',
                           'serve': 'python -m http.server 8000 --directory dist'}}
    write(destination / 'package.json', json.dumps(package, ensure_ascii=False, indent=2) + '\n')


def compare_tree(actual: Path, expected: Path) -> list[str]:
    expected_files = {path.relative_to(expected) for path in expected.rglob('*') if path.is_file()}
    actual_files = {path.relative_to(actual) for path in actual.rglob('*') if path.is_file()} if actual.exists() else set()
    differences = []
    for relative in sorted(expected_files | actual_files):
        if relative not in actual_files:
            differences.append(f'missing {relative}')
        elif relative not in expected_files:
            differences.append(f'unexpected {relative}')
        elif (actual / relative).read_bytes() != (expected / relative).read_bytes():
            differences.append(f'changed {relative}')
    return differences


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--topic', choices=TOPIC_IDS, action='append', help='Build one topic; repeat for several. Default: all six.')
    parser.add_argument('--check', action='store_true', help='Check committed outputs against a temporary offline rebuild, without modifying them.')
    args = parser.parse_args()
    configs = json.loads(read(CONFIG))
    data_builder = load_data_builder()
    failures = []
    with tempfile.TemporaryDirectory(prefix='taipei-topic-sites-') as temporary:
        for topic_id in args.topic or TOPIC_IDS:
            config = configs[topic_id]
            if not re.fullmatch(r'taipei-[a-z-]+-lab', config['directory']) or config['directory'] == 'taipei-waste-lab':
                raise ValueError('Unsafe or out-of-scope destination')
            staged = Path(temporary) / config['directory']
            generate(staged, topic_id, config, data_builder)
            destination = ROOT / 'sites' / config['directory']
            if args.check:
                differences = compare_tree(destination / 'dist', staged / 'dist')
                for filename in ('package.json', 'README.md'):
                    if not (destination / filename).is_file() or (destination / filename).read_bytes() != (staged / filename).read_bytes():
                        differences.append(f'changed {filename}')
                if differences:
                    failures.append(f"{topic_id}: " + ', '.join(differences[:12]))
                else:
                    print(f'{topic_id}: generated site is current')
            else:
                destination.mkdir(parents=True, exist_ok=True)
                if (destination / 'dist').exists():
                    shutil.rmtree(destination / 'dist')
                shutil.copytree(staged / 'dist', destination / 'dist')
                for filename in ('package.json', 'README.md'):
                    shutil.copyfile(staged / filename, destination / filename)
                print(f'{topic_id}: built sites/{config["directory"]}/dist')
    if failures:
        raise SystemExit('\n'.join(failures))


if __name__ == '__main__':
    main()
