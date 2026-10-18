"""Package preserved research inputs and field templates for private offline use."""
import html
import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
DOCS = ('bin-reduction.md', 'bin-removal-history.md', 'global-bin-practices.md', 'bin-design.md')
MARKER_OWNERS = {
    'research-synthesis': 'panel-materials',
    'research-paper-records': 'panel-sources',
    'research-literature': 'panel-sources',
    'research-practice-records': 'panel-sources',
}


def inline_markdown(text):
    """Render only escaped text, emphasis and source links from local notes."""
    text = html.escape(text)
    text = re.sub(r'\[([^\]]+)\]\((https://[^\s)]+)\)',
                  r'<a href="\2" target="_blank" rel="noopener noreferrer">\1 ↗</a>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    return re.sub(r'\*([^*]+)\*', r'<em>\1</em>', text)


def reference_record(item):
    esc = html.escape
    kind = '論文' if item['kind'] == 'academic' else '實務紀錄'
    method_label = '研究怎麼做' if item['kind'] == 'academic' else '實際怎麼做'
    sources = (item.get('sources') or [{'label': item['sourceLabel'], 'url': item['url']}])
    links = ''.join(f'<a href="{esc(source["url"], quote=True)}" target="_blank" rel="noopener noreferrer">{esc(source["label"])}</a>' for source in sources)
    return (f'<article class="research-reference" aria-labelledby="reference-{esc(item["id"])}">'
            f'<h4 id="reference-{esc(item["id"])}" tabindex="-1">{esc(item["title"])}</h4>'
            f'<p class="research-reference-meta">{esc(item["id"])} · {kind} · {esc(item["attribution"])}</p>'
            f'<p class="research-reference-method"><strong>{method_label}：</strong>{esc(item["method"])}</p>'
            '<dl class="research-reference-facts">'
            f'<div><dt>得到什麼</dt><dd>{esc(item["finding"])}</dd></div>'
            f'<div><dt>對台北的啟發 · 本站解讀</dt><dd>{esc(item["lesson"])}</dd></div></dl>'
            f'<p class="research-reference-limit"><strong>判讀界線：</strong>{esc(item["limitation"])}</p>'
            f'<div class="research-reference-source"><p><strong>查閱範圍：</strong>{esc(item["readingScope"])}</p><p>{esc(item["citation"])}</p>{links}</div></article>')


def literature_records(literature, catalog):
    """Keep one detailed record per paper, preferring the reviewed guide where present."""
    papers = re.findall(r'^### (L\d{2}) ([^\n]+)\n(.*?)(?=^### |^## |\Z)',
                        literature, re.M | re.S)
    assert len(papers) == 13
    reviewed = {item['id']: item for item in catalog['items'] if item['kind'] == 'academic'}
    records = []
    directory = []
    for key, title, body in papers:
        label = reviewed[key]['title'] if key in reviewed else title
        directory.append(f'<li><a href="#reference-{key}" data-research-target="reference-{key}">{key} · {html.escape(label)}</a></li>')
        if key in reviewed:
            records.append(reference_record(reviewed[key]))
        else:
            paragraphs = [p for p in body.strip().split('\n\n') if p.startswith('**')]
            assert len(paragraphs) == 4, f'Incomplete literature record: {key}'
            records.append(f'<article class="research-reference" aria-labelledby="reference-{key}">'
                           f'<h4 id="reference-{key}" tabindex="-1">{key} · {html.escape(title)}</h4>' +
                           ''.join('<p>' + inline_markdown(p) + '</p>' for p in paragraphs) + '</article>')
    assert set(reviewed) <= {key for key, _, _ in papers}
    return '\n'.join(directory), '\n'.join(records)


def render_references(index_text, catalog, literature):
    items = catalog['items']
    by_id = {item['id']: item for item in items}
    assert len(items) == len(by_id), 'Duplicate reference ID'
    for item in items:
        assert re.fullmatch(r'[A-Z][0-9]{2}', item['id']), 'Invalid reference ID'
        assert item['kind'] in ('academic', 'practice'), 'Invalid reference kind'
        for source in (item.get('sources') or [{'label': item['sourceLabel'], 'url': item['url']}]):
            assert source['url'].startswith('https://'), 'Reference source must use HTTPS'
    directory, records = literature_records(literature, catalog)
    sections = {
        'research-paper-records': directory,
        'research-literature': records,
        'research-practice-records': '\n'.join(reference_record(item) for item in items if item['kind'] == 'practice')
    }
    contexts = [
        ('siting', '配置與服務缺口',
         '需確認實際步行路徑、通行空間、服務時段與清運責任；清冊少列不能當作服務不足。',
         '已有使用困擾的留言線索，但逐則時間與事件位置未完整核實；各點需求、桶況與通行阻礙仍待查，也不能由清冊差異認定撤除或遷移。',
         [('feedback-findings', '對照本批回饋與限制'), ('siting', '看台北的分布與差異'), ('countries', '比較各地設置做法')]),
        ('collection', '清運與維護',
         '基本巡收、接單與故障備援須有人承接；感測方案需要實際調班能力。',
         '尚無可連結留言場景的巡收、滿溢、清洗與工時紀錄，也未驗證垃圾來源；海外設備規格與本批回饋都不是台北營運成效。',
         [('feedback-findings', '對照本批回饋與限制'), ('history', '看台北的歷程與紀錄'), ('countries', '比較各地清運做法')]),
        ('household', '家戶垃圾分流',
         '本期聚焦行人服務；家戶研究與回饋保留作背景，後續是否啟動另行決定。',
         '留言揭露時段不便的情境，但未核實各戶可用的合法管道，也未量化混入來源、方案接受度或成效；付費或改入口是否有效仍未知。',
         [('feedback-findings', '對照本批回饋與限制'), ('countries', '比較家戶收運案例'), ('design', '看方案的概念示意')])
    ]
    assert len(catalog['synthesis']) == len(contexts)
    synthesis = []
    for item, (slug, topic, condition, unknown, paths) in zip(catalog['synthesis'], contexts):
        links = []
        for key in item['references']:
            assert key in by_id, f'Unknown synthesis reference: {key}'
            label = html.escape(f'{key} · {by_id[key]["title"]}', quote=True)
            links.append(f'<a href="#reference-{key}" data-research-target="reference-{key}" aria-label="{label}" title="{label}">{key}</a>')
        path_links = ''.join(f'<a href="#{target}">{html.escape(label)}</a>' for target, label in paths)
        synthesis.append(f'<article class="research-synthesis-item" aria-labelledby="conclusion-{slug}"><h3 id="conclusion-{slug}" tabindex="-1">' +
                         html.escape(topic) + '：' + html.escape(item['title']) + '</h3><p>' +
                         html.escape(item['takeaway']) + '</p><p><strong>可以先做：</strong>' + html.escape(item['action']) +
                         '</p><p><strong>成立條件：</strong>' + html.escape(condition) +
                         '</p><p class="research-unknown"><strong>仍未知：</strong>' + html.escape(unknown) +
                         '</p><p><strong>如何確認有用：</strong>' + html.escape(item['check']) +
                         '</p><div class="research-synthesis-sources"><span>文獻與實務依據</span>' + ''.join(links) +
                         '</div><div class="research-related-paths">' + path_links + '</div></article>')
    sections['research-synthesis'] = '\n'.join(synthesis)
    for marker, body in sections.items():
        before = index_text.split(f'<!-- {marker}-start -->')[0]
        panels = re.findall(r'<section\b[^>]*\bid="(panel-[^"]+)"', before)
        assert panels and panels[-1] == MARKER_OWNERS[marker], f'Incorrect panel owner for {marker}'
        index_text, count = re.subn(f'<!-- {marker}-start -->.*?<!-- {marker}-end -->',
                                   lambda match: f'<!-- {marker}-start -->\n{body}\n<!-- {marker}-end -->',
                                   index_text, flags=re.S)
        assert count == 1, f'Missing reference marker: {marker}'
    return index_text



PLAN_SECTIONS = {
    '建議執行基準': ('scope', '規模與完成條件'),
    '前十天先取得能執行的承接安排': ('owners', '前十天的決定'),
    '百日時程與階段成果': ('schedule', '階段成果'),
    '選點與設備規格一起確認': ('sites', '選點與規格'),
    '採購要有，而且從第一天開始準備': ('procurement', '沿用、採購與工期'),
    '清運能力決定能設多少，也決定每天花多少': ('operations', '清運與排班'),
    '人員訓練以獨立作業能力驗收': ('training', '人員訓練'),
    '預算用完整服務成本核定': ('budget', '完整預算'),
    '我們可以做的和外部必須承接的事項': ('responsibilities', '我方與市府分工'),
    '現場驗證與第 100 天交付': ('acceptance', '驗收與交接'),
    '異常決策不留到最後一天': ('risks', '延誤與缺口處理'),
}
PLAN_LINKS = {
    '../service-strategy-2026-10-15/README.md': '#implementation-heading',
    '../budget-2026-10-15/README.md': '#budget-heading',
    '../budget-2026-10-15/inputs.json': '#budget-heading',
}


def plan_inline(text):
    """Keep the plan's source links readable without publishing attachments."""
    for target in re.findall(r'\[[^\]]+\]\(([^\s)]+)\)', text):
        if target in PLAN_LINKS:
            text = text.replace('](' + target + ')', '](' + PLAN_LINKS[target] + ')')
        elif not target.startswith('https://'):
            raise ValueError(f'Unmapped public plan link: {target}')
    rendered = inline_markdown(text)
    return re.sub(r'\[([^\]]+)\]\((#[a-z-]+)\)', r'<a href="\2">\1</a>', rendered)


def render_hundred_day_plan(index_text, markdown):
    """Render the reviewed plan's paragraphs and tables from its single source."""
    lines = markdown.strip().splitlines()
    assert lines[0].startswith('# '), 'Missing plan title'
    title = html.escape(lines[0][2:])
    body, seen = [], []
    section = '百日計畫'
    blocks = re.split(r'\n\s*\n', '\n'.join(lines[1:]).strip())
    for block in blocks:
        heading = re.fullmatch(r'\*\*([^*]+)\*\*', block)
        if heading:
            section = heading[1]
            slug, _ = PLAN_SECTIONS[section]
            seen.append(section)
            body.append(f'<h3 id="plan-{slug}" tabindex="-1">{html.escape(section)}</h3>')
        elif block.startswith('|'):
            rows = [[cell.strip() for cell in line.strip().strip('|').split('|')]
                    for line in block.splitlines()]
            headers, separator, *records = rows
            assert all(re.fullmatch(r':?-+:?', cell) for cell in separator), 'Invalid plan table'
            assert all(len(row) == len(headers) for row in rows), 'Uneven plan table'
            columns = ''.join(f'<th scope="col" role="columnheader">{plan_inline(label)}</th>' for label in headers)
            rendered_rows = []
            for row in records:
                cells = ''.join(f'<td role="cell"><span class="plan-cell-label" aria-hidden="true">{html.escape(label)}</span>{plan_inline(cell)}</td>'
                                for label, cell in zip(headers, row))
                rendered_rows.append(f'<tr role="row">{cells}</tr>')
            body.append('<table class="plan-table" role="table">'
                        f'<caption class="visually-hidden">{html.escape(section)}</caption>'
                        f'<thead role="rowgroup"><tr role="row">{columns}</tr></thead>'
                        '<tbody role="rowgroup">' + ''.join(rendered_rows) + '</tbody></table>')
        else:
            assert not re.match(r'^(?:#|[-+] |\d+\. )', block), 'Unsupported plan block'
            body.append('<p>' + plan_inline(block.replace('\n', ' ')) + '</p>')
    assert seen == list(PLAN_SECTIONS), 'Plan sections changed; update public navigation'
    contents = ''.join(f'<a href="#plan-{slug}">{html.escape(label)}</a>'
                       for slug, label in PLAN_SECTIONS.values())
    rendered = (f'<header class="research-page-heading"><h2 id="plan-heading">{title}</h2>'
                '<p class="research-update">規劃提案 · 尚未啟動；點位、經費、採購與營運承接仍待確認。</p></header>'
                '<div class="plan-reading-layout"><nav class="plan-contents" aria-label="百日計畫章節">'
                + contents + '</nav><div class="plan-body">' + '\n'.join(body) + '</div></div>')
    marker = 'hundred-day-plan'
    before = index_text.split(f'<!-- {marker}-start -->')[0]
    assert re.findall(r'<section\b[^>]*\bid="(panel-[^"]+)"', before)[-1] == 'panel-plan'
    updated, count = re.subn(f'<!-- {marker}-start -->.*?<!-- {marker}-end -->',
                            lambda _: f'<!-- {marker}-start -->\n{rendered}\n<!-- {marker}-end -->',
                            index_text, flags=re.S)
    assert count == 1, 'Missing public plan marker'
    return updated


def render_service_continuity(index_text):
    """Render a public, fictional demonstration from the retained research source."""
    source = ROOT / 'research/service-continuity-2026-10-18'
    summary = (source / 'public-summary.html').read_text()
    prototype = (source / 'source/prototype-v0.1.html').read_text()
    # Keep the frozen participant source intact; adapt heading depth for this page.
    prototype = prototype.replace('h2', 'h4').replace('h3', 'h5')
    rendered = summary.replace('{{prototype}}', prototype)
    updated, count = re.subn(r'<!-- service-continuity-start -->.*?<!-- service-continuity-end -->',
                            lambda _: '<!-- service-continuity-start -->\n' + rendered + '\n<!-- service-continuity-end -->',
                            index_text, flags=re.S)
    assert count == 1, 'Missing service-continuity marker'
    return updated


def main():
    subprocess.run([sys.executable, str(ROOT / 'scripts/analyze-feedback.py')], check=True)
    canonical = ROOT.parent.parent / 'topics/bins/research'
    docs = {name: (ROOT / 'data/research' / name).read_text() for name in DOCS}
    if canonical.is_dir():
        if (ROOT / 'research').exists():
            shutil.rmtree(ROOT / 'research')
        shutil.copytree(canonical, ROOT / 'research',
                        ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    # The portable copy links to the retained flat documents, not monorepo docs/.
    for note in (ROOT / 'research').rglob('*.md'):
        note.write_text(re.sub(r'(?<=\]\()\.\./\.\./docs/',
                               '../../dist/research/', note.read_text()))
    destination = DIST / 'research'
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(ROOT / 'research', destination,
                    ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    for note in destination.rglob('*.md'):
        text = re.sub(r'(?<=\]\()\.\./\.\./dist/data/', '../../data/', note.read_text())
        text = re.sub(r'(?<=\]\()\.\./\.\./dist/research/', '../', text)
        note.write_text(text)
    for name, text in docs.items():
        (destination / name).write_text(re.sub(r'(?<=\]\()\.\./data/history/', '../data/', text))
    literature = (ROOT / 'research/literature-2026-10-15/README.md').read_text()
    index = DIST / 'index.html'
    text = index.read_text()
    catalog = json.loads((ROOT / 'research/reference-guide-2026-10-16/catalog.json').read_text())
    text = render_references(text, catalog, literature)
    text = render_hundred_day_plan(text, (ROOT / 'research/hundred-day-plan-2026-10-17/README.md').read_text())
    text = render_service_continuity(text)
    index.write_text(text)

    # Preserve the original relative paths so lineage checks work after extraction.
    paths = [p for p in (ROOT / 'research').rglob('*')
             if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc']
    paths += [p for p in (DIST / 'data').glob('*') if p.is_file()]
    paths += [p for p in (DIST / 'research').glob('*.md') if p.is_file()]
    paths += [ROOT / 'data/research' / name for name in DOCS]
    paths += [DIST / 'index.html', ROOT / 'scripts/package-research.py',
              ROOT / 'scripts/prepare-research-execution.py',
              ROOT / 'scripts/compare-snapshots.py', ROOT / 'scripts/analyze-coordinate-distances.py',
              ROOT / 'scripts/estimate-budget.py', ROOT / 'scripts/analyze-feedback.py',
              ROOT / 'scripts/feedback_access.py', ROOT / 'scripts/feedback_removal.py']
    destination = DIST / 'research/research-execution-2026-10-15.zip'
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(set(paths)):
            info = zipfile.ZipInfo(path.relative_to(ROOT).as_posix(), (2026, 10, 15, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            payload = path.read_bytes()
            if path.parent == DIST / 'research' and path.suffix == '.md':
                # The archive keeps full notes under research/, not duplicate subtrees.
                payload = re.sub(r'(?<=\]\()\.\./research/', '../../research/',
                                 payload.decode('utf-8')).encode('utf-8')
            archive.writestr(info, payload)
    print(f'Packaged {len(set(paths))} files and 13 unique literature records: {destination.name}')


if __name__ == '__main__':
    main()
