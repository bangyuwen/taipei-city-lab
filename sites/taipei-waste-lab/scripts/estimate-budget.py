"""Rebuild planning cost tables from explicit assumptions, never inventory row counts."""
import csv
import html
import json
import re
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT.parent.parent / 'topics/bins/research'
if not RESEARCH.is_dir():
    RESEARCH = ROOT / 'research'
FOLDER = RESEARCH / 'budget-2026-10-15'
D = Decimal


def estimate(model, case, level, rounds=None):
    rates = {key: D(str(value['values'][level])) for key, value in model['rates'].items()}
    n, new = case['sites'], case['new_groups']
    days, months, weeks = case['days'], case['months'], case['weeks']
    scale = case['support_scale']
    rounds = model['rounds_per_day'] if rounds is None else rounds
    hours = (n * rates['minutes'] / 60 + case['routes'] * rates['route_hours']) * rounds
    items = []

    def add(period, label, quantity, unit_rate):
        items.append({'period': period, 'item': label, 'amount': D(quantity) * unit_rate})

    for key, quantity in [('equipment', new), ('installation', new), ('refresh', n-new),
                          ('sign', n), ('information', scale), ('setup', scale)]:
        add('一次性', model['rates'][key]['label'], quantity, rates[key])
    add('營運', '巡收人力（含駕駛）', hours * days * model['people_per_crew'], rates['labor'])
    add('營運', '巡收車輛（不含人員）', hours * days, rates['vehicle'])
    for key, quantity in [('wash', n*months), ('consumables', n*days*rounds),
                          ('repair', n*months), ('treatment', n*days),
                          ('coordination', scale*months)]:
        add('營運', model['rates'][key]['label'], quantity, rates[key])
    add('營運', '熱點勸導與巡查人力', weeks*scale*rates['patrol_hours'], rates['labor'])
    once = sum(i['amount'] for i in items if i['period'] == '一次性')
    operations = sum(i['amount'] for i in items if i['period'] == '營運')
    reserve = (once+operations)*D(str(model['contingency_rate']))
    return {'items': items, 'once': once, 'operations': operations, 'reserve': reserve,
            'total': once+operations+reserve, 'hours_per_day': hours}


def yuan(value):
    return f"{value.quantize(D('1'), rounding=ROUND_HALF_UP):,}"


def wan(value):
    return f"{(value/10000).quantize(D('0.1'), rounding=ROUND_HALF_UP):,}"


def replace_block(path, name, body):
    start, end = f'<!-- {name}-start -->', f'<!-- {name}-end -->'
    text, count = re.subn(re.escape(start)+'.*?'+re.escape(end),
                         lambda _: start+'\n'+body+'\n'+end, path.read_text(), flags=re.S)
    assert count == 1, f'Missing unique {name} block in {path}'
    path.write_text(text)


def main():
    model = json.loads((FOLDER/'inputs.json').read_text())
    cases = model['cases']
    results = [[estimate(model, case, level) for level in range(3)] for case in cases]
    summary = ['| 規模 | 低成本情境 | 基準估算 | 高成本情境 |', '|---|---:|---:|---:|']
    for case, variants in zip(cases, results):
        summary.append('| '+case['label']+' | '+' | '.join(wan(x['total'])+' 萬元' for x in variants)+' |')
    detail = ['| 項目（新臺幣元） | 30 處／180 日 | 100 處／365 日 |', '|---|---:|---:|']
    for a, b in zip(results[0][1]['items'], results[1][1]['items']):
        detail.append(f"| {a['period']}・{a['item']} | {yuan(a['amount'])} | {yuan(b['amount'])} |")
    for key, label in [('once', '一次性小計'), ('operations', '營運小計'), ('reserve', '15% 預備金'), ('total', '合計')]:
        detail.append(f"| **{label}** | **{yuan(results[0][1][key])}** | **{yuan(results[1][1][key])}** |")
    rates = ['| 參數（全部為規劃假設） | 單位 | 低 | 中 | 高 |', '|---|---|---:|---:|---:|']
    for rate in model['rates'].values():
        rates.append('| '+rate['label']+' | '+rate['unit']+' | '+' | '.join(f'{v:,}' for v in rate['values'])+' |')
    sensitivity = []
    for case, variants in zip(cases, results):
        base = variants[1]
        twice = estimate(model, case, 1, rounds=2)
        continued = dict(case, days=365, months=12, weeks=53)
        annual = estimate(model, continued, 1)['operations'] * (1+D(str(model['contingency_rate'])))
        sensitivity.append(f"- {case['label']}：基準每日合計 {base['hours_per_day']:.2f} 車組小時，"
                           f"每車組 2 人；每日 2 輪時總額 {wan(twice['total'])} 萬元，"
                           f"比 1 輪增加 {wan(twice['total']-base['total'])} 萬元。"
                           f"同規模續行全年、無一次性工程時，基準營運加 15% 預備金為 {wan(annual)} 萬元／年。")
    replace_block(FOLDER/'README.md', 'budget-summary', '\n'.join(summary))
    replace_block(FOLDER/'README.md', 'budget-detail', '\n'.join(detail))
    replace_block(FOLDER/'README.md', 'budget-rates', '\n'.join(rates))
    replace_block(FOLDER/'README.md', 'budget-sensitivity', '\n'.join(sensitivity))
    with (FOLDER/'estimate.csv').open('w', newline='', encoding='utf-8-sig') as file:
        writer = csv.writer(file)
        writer.writerow(['scenario', 'cost_level', 'period', 'item', 'amount_TWD'])
        for case, variants in zip(cases, results):
            for label, result in zip(['low', 'central', 'high'], variants):
                for item in result['items']:
                    writer.writerow([case['label'], label, item['period'], item['item'], yuan(item['amount']).replace(',', '')])
                for key in ['reserve', 'total']:
                    writer.writerow([case['label'], label, key, key, yuan(result[key]).replace(',', '')])
    rows = []
    for case, variants in zip(cases, results):
        mid = variants[1]
        rows.append(f'<tr><th scope="row">{html.escape(case["label"])}</th><td>{wan(mid["once"])} 萬</td>'
                    f'<td>{wan(mid["operations"])} 萬</td><td>{wan(mid["reserve"])} 萬</td>'
                    f'<td><strong>{wan(mid["total"])} 萬</strong></td><td>{wan(variants[0]["total"])}–{wan(variants[2]["total"])} 萬</td></tr>')
    replace_block(ROOT/'dist/index.html', 'budget-rows', '\n'.join(rows))
    print('\n'.join(summary+sensitivity))


if __name__ == '__main__':
    main()
