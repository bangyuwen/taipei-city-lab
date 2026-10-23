"""Export missing reading notes from the site's existing content owners.

This is a private, one-way reading export, not a second authoring source.
Only the Python standard library is required; no JavaScript or network is run.
"""
import argparse
import hashlib
import json
import os
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'notes'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
        'meta', 'param', 'source', 'track', 'wbr'}
SKIP = {'nav', 'script', 'style', 'button', 'select', 'input', 'textarea',
        'canvas', 'svg', 'iframe'}
BLOCK = {'article', 'section', 'header', 'footer', 'main', 'div', 'p',
         'figure', 'figcaption', 'details', 'summary', 'dl', 'dd'}


@dataclass
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root = Node('document')
        self.stack = [self.root]
        self.feed(text)
        self.close()

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, text):
        self.stack[-1].children.append(text)

    def select(self, selector):
        nodes = [n for n in self.root.walk() if
                 (n.attrs.get('id') == selector[1:] if selector.startswith('#')
                  else n.tag == selector)]
        if len(nodes) != 1:
            raise ValueError(f'Expected one {selector}, found {len(nodes)}')
        return nodes[0]


def skipped(node):
    # Hidden panels and closed disclosures contain real reading material.
    return node.tag in SKIP or node.attrs.get('aria-hidden') == 'true'


def text_content(node):
    if isinstance(node, str):
        return node
    return ''.join(text_content(c) for c in node.children)


def clean(text):
    text = re.sub(r'[ \t]+\n', '\n', text)
    return re.sub(r'\n{3,}', '\n\n', text).strip()


def relative(path, directory=None):
    return quote(os.path.relpath(path, directory or OUTPUT), safe='/.-_')


class Markdown:
    def __init__(self, source):
        self.source = source

    def target(self, value):
        parts = urlsplit(value)
        if parts.scheme or parts.netloc or value.startswith('/'):
            return value
        path = self.source.parent / parts.path if parts.path else self.source
        if path.is_dir():
            path = path / 'index.html'
        return relative(path) + ('?' + parts.query if parts.query else '') + (
            '#' + parts.fragment if parts.fragment else '')

    def render(self, node):
        if isinstance(node, str):
            # Escape Markdown syntax in source text, without changing its words.
            text = re.sub(r'\s+', ' ', node)
            return re.sub(r'([\\`*_[\]<>])', r'\\\1', text)
        if skipped(node):
            return ''
        tag = node.tag
        body = ''.join(self.render(c) for c in node.children)
        if re.fullmatch(r'h[1-6]', tag):
            return '\n\n' + '#' * int(tag[1]) + ' ' + clean(body) + '\n\n'
        if tag == 'a':
            href = node.attrs.get('href')
            return f'[{clean(body)}](<{self.target(href)}>)' if href and body.strip() else body
        if tag == 'img':
            src = node.attrs.get('src')
            alt = node.attrs.get('alt', '')
            return f'\n\n![{alt}](<{self.target(src)}>)\n\n' if src and alt else ''
        if tag in {'strong', 'b'}:
            return f'**{body.strip()}**' if body.strip() else ''
        if tag in {'em', 'i'}:
            return f'*{body.strip()}*' if body.strip() else ''
        if tag == 'code':
            return '`' + text_content(node).replace('`', '\\`') + '`'
        if tag == 'pre':
            return '\n\n```\n' + text_content(node).strip() + '\n```\n\n'
        if tag in {'ul', 'ol'}:
            rows = []
            start = int(node.attrs.get('start', 1))
            for child in node.children:
                if not isinstance(child, Node) or child.tag != 'li':
                    continue
                value = clean(self.render(child))
                if not value:
                    continue
                marker = f'{start}. ' if tag == 'ol' else '- '
                start += 1
                lines = value.splitlines()
                rows.append(marker + lines[0] + ''.join(
                    '\n' + ' ' * len(marker) + line for line in lines[1:]))
            return '\n\n' + '\n\n'.join(rows) + '\n\n'
        if tag == 'table':
            return self.table(node)
        if tag == 'blockquote':
            return '\n\n' + '\n'.join('> ' + s for s in clean(body).splitlines()) + '\n\n'
        if tag == 'dt':
            return '\n\n**' + clean(body) + '**\n\n'
        if tag == 'br':
            return '<br>'
        if tag == 'hr':
            return '\n\n---\n\n'
        if tag in BLOCK:
            return '\n\n' + clean(body) + '\n\n' if body.strip() else ''
        return body

    def table(self, node):
        rows = []
        caption = ''
        for child in node.walk():
            if child.tag == 'caption':
                caption = clean(self.render(child)) + '\n\n'
            if child.tag != 'tr':
                continue
            cells = [c for c in child.children if isinstance(c, Node) and c.tag in {'td', 'th'}]
            if any(c.attrs.get('rowspan', '1') != '1' or c.attrs.get('colspan', '1') != '1' for c in cells):
                raise ValueError('Spanning table cells need an explicit reading representation')
            values = [re.sub(r'\n+', '<br>', clean(self.render(c))).replace('|', '\\|') for c in cells]
            if values:
                rows.append(values)
        if not rows:
            return '\n\n' + caption
        width = max(map(len, rows))
        rows = [row + [''] * (width - len(row)) for row in rows]
        rows.insert(1, ['---'] * width)
        return '\n\n' + caption + '\n'.join('| ' + ' | '.join(r) + ' |' for r in rows) + '\n\n'


def resolve_source(name):
    """Read the existing owner in the full repository, never a stale site copy."""
    path = ROOT / name
    if path.is_file():
        return path.resolve()
    raise FileNotFoundError(f'Missing content owner or note: {name}')


def build():
    inventory = json.loads((ROOT / 'docs/website-notes.json').read_text())
    documents = {}
    for entry in inventory:
        path = resolve_source(entry['page'])
        if path not in documents:
            documents[path] = Document(path.read_text())
        if entry.get('selector'):
            documents[path].select(entry['selector'])
        for name in entry['notes'] + entry['owners']:
            resolve_source(name)
    index = documents[resolve_source('dist/index.html')]
    panels = {n.attrs['id'] for n in index.root.walk()
              if 'page-panel' in n.attrs.get('class', '').split()}
    mapped = [e['selector'][1:] for e in inventory if e['page'] == 'dist/index.html']
    if len(mapped) != len(set(mapped)) or panels != set(mapped):
        raise ValueError(f'Panel inventory drift: {panels.symmetric_difference(mapped)}')

    outputs = {e['output'] for e in inventory if e.get('output')}
    for entry in inventory:
        if entry.get('reading') and entry['reading'] not in outputs:
            raise ValueError(f'Unknown reading note: {entry["reading"]}')
    files = {}
    report = ['# 網站內容與 Markdown 筆記盤點', '',
              '> 自動產生，請勿手動修改。這是目前本機網站來源的盤點，不代表正式站已部署。', '',
              '由 `npm run prepare-notes` 重建；`npm run check-notes` 檢查是否過期。', '',
              '既有筆記沿用原來源；缺少的完整正文由網站單向產生閱讀副本。修改下列正式來源後，先重建網站，再重建筆記。', '',
              '地圖篩選、3D 狀態與模擬操作保留在網站；筆記不推算互動結果。歷史草稿、未知與未執行狀態照原文保留。', '',
              '| 網站內容 | 原有對應程度 | 既有 Markdown | 補齊的閱讀副本 | 缺口與範圍 |',
              '| --- | --- | --- | --- | --- |']
    for entry in inventory:
        path = resolve_source(entry['page'])
        fragment = entry.get('selector', '')
        page_link = relative(path) + (fragment.replace('#panel-', '#') if fragment.startswith('#') else '')
        notes = ' · '.join(f'[{Path(n).parent.name}/{Path(n).name}](<{relative(resolve_source(n))}>)'
                           for n in entry['notes']) or '—'
        generated = (f'[{entry["reading"]}]({entry["reading"]})'
                     if entry.get('reading') else '—')
        if entry.get('output'):
            name = entry['output']
            if Path(name).name != name or not name.endswith('.md') or name == 'README.md' or name in files:
                raise ValueError(f'Invalid or duplicate note name: {name}')
            body = clean(Markdown(path).render(documents[path].select(entry['selector'])))
            header = [f'# {entry["title"]}', '',
                      '> 自動產生的私人閱讀副本，請勿手動修改；正文仍由下列來源維護。', '',
                      f'[網站對應內容](<{page_link}>)', '',
                      f'盤點時缺口與範圍：{entry["reason"]}', '',
                      '不包含瀏覽器即時計算或互動狀態；原文的未知、提案及歷史狀態均保留。', '',
                      '## 維護來源', '']
            header += [f'- [{n}](<{relative(resolve_source(n))}>)' for n in entry['owners']]
            if entry['notes']:
                header += ['', '相關研究筆記：' + notes]
            header += ['', f'讀取檔案 SHA-256：`{hashlib.sha256(path.read_bytes()).hexdigest()}`', '',
                       '---', '', body, '']
            files[name] = '\n'.join(header)
            generated = f'[{name}]({name})'
        report.append(f'| [{entry["title"]}](<{page_link}>) | {entry["coverage"]} | {notes} | {generated} | {entry["reason"]} |')
    report += ['', f'共盤點 {len(panels)} 個研究區塊及 {len(inventory) - len(panels)} 個其他頁面／介面群組；補齊 {len(files)} 份自動產生的正文筆記。', '',
               '## 使用與公開範圍', '',
               '- 本目錄為可重建的私人閱讀產物，不列入 Git 或公開部署白名單。',
               '- 原有研究 Markdown、JSON、HTML 與生成程式仍是各自內容的唯一維護來源。',
               '- 這次核對內容對應與轉換完整性，沒有重新查證外部來源或執行現勘。', '']
    files['README.md'] = '\n'.join(report)
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail if private notes need regeneration')
    args = parser.parse_args()
    files = build()  # Validate inputs before writing any notes.
    if OUTPUT.is_symlink():
        raise ValueError('Notes output must not be a symlink')
    for name in files:
        if (OUTPUT / name).is_symlink():
            raise ValueError(f'Note must not be a symlink: {name}')
    if args.check:
        stale = [name for name, text in files.items()
                 if not (OUTPUT / name).is_file() or (OUTPUT / name).read_text() != text]
        stale += [str(path.relative_to(OUTPUT)) + ' (not in inventory)'
                  for path in sorted(OUTPUT.rglob('*.md'))
                  if path.relative_to(OUTPUT).as_posix() not in files]
        if stale:
            parser.exit(1, 'Notes need regeneration: ' + ', '.join(stale) + '\n')
    else:
        OUTPUT.mkdir(exist_ok=True)
        for name, text in files.items():
            (OUTPUT / name).write_text(text)
    print(f'{"Checked" if args.check else "Generated"} {len(files) - 1} private reading notes and inventory')


if __name__ == '__main__':
    main()
