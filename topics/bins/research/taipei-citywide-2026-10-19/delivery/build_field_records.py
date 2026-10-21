"""Generate blank field templates, a portable guide, and the public reading sheet."""
import csv
import html
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parents[2]
if (HERE.parents[4] / "sites/taipei-waste-lab").is_dir():
    SITE = HERE.parents[4] / "sites/taipei-waste-lab"


def e(value):
    return html.escape(value, quote=True)


def load_schema(folder=HERE):
    schema = json.loads((folder / 'field-record-forms.json').read_text())
    assert schema['status'] == 'blank_templates_only'
    assert len(schema['forms']) == 4
    assert len({form['id'] for form in schema['forms']}) == 4
    for form in schema['forms']:
        keys = [field['key'] for field in form['fields']]
        assert len(keys) == len(set(keys))
        assert Path(form['file']).name == form['file'] and form['file'].endswith('.csv')
    return schema


def preflight_templates(folder, schema):
    for form in schema['forms']:
        path = folder / 'templates' / form['file']
        if path.is_symlink():
            raise ValueError(f'Refusing linked template: {path.name}')
        if path.exists():
            with path.open(encoding='utf-8-sig', newline='') as stream:
                rows = list(csv.reader(stream))
            # The header is the only permitted nonempty row. Never erase fieldwork.
            if any(any(cell.strip() for cell in row) for row in rows[1:]):
                raise ValueError(f'Refusing to overwrite filled records: {path.name}')


def render(schema):
    forms = []
    for form in schema['forms']:
        rows = ''.join(
            f'<tr><th scope="row" data-label="欄位">{e(f["label"])}</th>'
            '<td data-label="填寫"><div class="field-record-blank" aria-label="空白填寫欄"></div></td>'
            f'<td data-label="填寫規則">{e(f["rule"])}</td></tr>' for f in form['fields'])
        forms.append(f'<details class="persona-detail field-record-sheet" id="field-form-{form["id"]}">'
                     f'<summary>{e(form["title"])} · 展開空白表與填寫規則</summary>'
                     f'<p>{e(form["unit"])}</p>'
                     '<table class="plan-table"><thead><tr><th scope="col">欄位</th>'
                     '<th scope="col">填寫</th><th scope="col">填寫規則</th></tr></thead>'
                     f'<tbody>{rows}</tbody></table></details>')
    rules = ''.join(f'<li><strong>{e(title)}：</strong>{e(rule)}</li>' for title, rule in schema['rules'])
    cases = ''.join(f'<tr><th scope="row" data-label="驗收案例">{e(title)}<p>{e(given)}</p></th>'
                    f'<td data-label="應有結果">{e(expected)}</td>'
                    f'<td data-label="退回修正">{e(failure)}</td></tr>'
                    for title, given, expected, failure in schema['cases'])
    links = ''.join(f'<a href="#field-form-{form["id"]}">{e(form["title"].replace("｜", " "))}</a>'
                    for form in schema['forms'])
    return f'''<article class="reader-item" id="reader-field-forms" data-reader-item="現勘：旅程與車籃空白紀錄表">
<h3 id="field-forms">投放旅程與車籃垃圾：空白現勘紀錄表</h3>
<p class="research-lead">依 PRD v0.5 的 R3／R4 補齊兩類、四張表。先記一段實際經驗或一次盤點，再判斷證據支持什麼。所有填寫格保持空白，這裡沒有現勘結果。</p>
<p class="definition-status">{e(schema['version'])} · 空白模板與填寫規則已備妥 · 現勘未執行</p>
<nav class="reading-path" aria-label="現勘紀錄表">{links}<a href="#field-form-rules">共通規則</a><a href="#field-form-cases">驗收案例</a></nav>
<h4>先選要記錄的單位</h4><ul>
<li><strong>人的一段投放旅程：</strong>填表1。用餐、遛狗或步行等情境依實際依據記錄，不先套人物標籤。</li>
<li><strong>車籃當下的狀態：</strong>表2A固定盤點範圍與時間，表2B逐籃記錄；兩表一起核對分母。</li>
<li><strong>有人遇見或處理車籃垃圾：</strong>填表2C。有最後投放依據才連表1，同一投放不計兩次。</li></ul>
<p><strong>共同接點：</strong>visit_id連既有訪次與候選，scope_version連範圍；表1的設施列ID連逐設施附表。E01／E02／E06／E15只作問題依據，不會預填到任何現勘表。現有234筆計畫訪次維持未執行。</p>
<p>這些表格供查閱、抄錄或列印，<strong>不會線上儲存或送出</strong>。私人交接包附四份只有欄名的CSV及欄位字典；複製工作副本後再填，實測資料與照片不放入公開頁。</p>
{''.join(forms)}
<section class="research-overview-section" aria-labelledby="field-form-rules"><h4 id="field-form-rules">共通填寫與彙總規則</h4><ol>{rules}</ol></section>
<section class="research-overview-section" aria-labelledby="field-form-cases"><h4 id="field-form-cases">驗收案例：用來檢查填法，不是實測資料</h4>
<p>以下是預期判定。除C04回查既有原文、C11回查清冊外，其餘情境及數字僅供驗收演練；不得寫入正式空白模板或冒充已發生事件。填寫人與覆核人應能一致區分通過與退回修正；尚未進行現場人員演練。</p>
<table class="plan-table"><thead><tr><th scope="col">驗收案例</th><th scope="col">應有結果</th><th scope="col">退回修正</th></tr></thead><tbody>{cases}</tbody></table></section>
<p><a href="#definition-prd-current-needs">回查PRD需求</a> · <a href="#field-record">既有訪次與逐設施規則</a> · <a href="#field-priority">先查哪些點</a> · <a href="#problem">問題原文與未知</a></p>
</article>'''


def guide(schema):
    lines = ['# 投放旅程與車籃垃圾現勘表', '',
             f'版本：{schema["version"]}；依據：PRD {schema["prd"]}。空白模板，沒有實測資料。', '',
             '複製templates/內CSV後再填；原模板只有欄名。網站表格不會儲存或送出。已填資料與照片維持私人。', '',
             '## 填寫與彙總規則', '']
    lines += [f'{i}. **{title}：**{rule}' for i, (title, rule) in enumerate(schema['rules'], 1)]
    for form in schema['forms']:
        lines += ['', f'## {form["title"]}', '', form['unit'], '',
                  f'空白檔：[templates/{form["file"]}](templates/{form["file"]})', '',
                  '| 欄位 | 名稱 | 填寫規則 |', '|---|---|---|']
        lines += [f'| `{f["key"]}` | {f["label"]} | {f["rule"].replace("|", "&#124;")} |' for f in form['fields']]
    lines += ['', '## 驗收案例', '', '示例不是現場結果；不可寫入正式模板。尚未進行現場人員演練。', '',
              '| 案例 | 輸入情境 | 預期結果 | 退回條件 |', '|---|---|---|---|']
    lines += ['| '+' | '.join(case)+' |' for case in schema['cases']]
    return '\n'.join(lines)+'\n'


def build(folder=HERE, page_path=None):
    schema = load_schema(folder)
    preflight_templates(folder, schema)
    page = None
    if page_path is not None:
        page = page_path.read_text()
        article = render(schema)
        if 'id="reader-field-forms"' in page:
            page, count = re.subn(r'<article[^>]+id="reader-field-forms".*?</article>',
                                  lambda _: article, page, flags=re.S)
            assert count == 1
        else:
            marker = re.search(r'<article[^>]+id="reader-field-record".*?</article>', page, re.S)
            assert marker
            page = page[:marker.end()]+'\n'+article+page[marker.end():]
        link = '<a href="#reader-field-forms">現勘：旅程與車籃空白紀錄表</a>'
        if link not in page:
            marker = '<a href="#reader-field-record">現勘：觀察紀錄與判讀</a>'
            assert page.count(marker) == 1
            page = page.replace(marker, marker+link)
    (folder / 'templates').mkdir(exist_ok=True)
    for form in schema['forms']:
        with (folder / 'templates' / form['file']).open('w', encoding='utf-8-sig', newline='') as stream:
            csv.writer(stream).writerow([f['key'] for f in form['fields']])
    (folder / 'field-record-forms.md').write_text(guide(schema))
    if page is not None:
        page_path.write_text(page)
    return schema


if __name__ == '__main__':
    build(page_path=SITE / 'dist/index.html')
    print('Generated four header-only templates, field guide and public blank forms; no observations added.')
