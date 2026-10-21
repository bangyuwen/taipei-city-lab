"""Render the bounded venue follow-up into the existing methods reader."""
import html, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parent
SITE=ROOT.parents[1]
if (ROOT.parents[3] / "sites/taipei-waste-lab").is_dir():
    SITE = ROOT.parents[3] / "sites/taipei-waste-lab"
def esc(v):return html.escape(str(v),quote=True)
def table(headers,rows,caption):
    return '<table class="plan-table"><caption>'+esc(caption)+'</caption><thead><tr>'+''.join('<th scope="col">'+esc(h)+'</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td data-label="'+esc(h)+'">'+esc(v)+'</td>' for h,v in zip(headers,row))+'</tr>' for row in rows)+'</tbody></table>'
def build():
    d=json.loads((ROOT/'results.json').read_text());stations=d['stations']
    streets=[]
    for r in stations:
        streets.append([r['station'],*[str(r['baseline_street_rows'][str(n)])+' → '+str(r['rechecked_street_rows'][str(n)]) for n in (300,500)]])
    venue_rows=[[r['source_csv_row'],r['行政區'],r['地址'],r['經度']+'、'+r['緯度'],r['備註']] for r in d['original_venue_records']]
    replacements={'street_table':table(['捷運站','300 m（列）','500 m（列）'],streets,'9/30 → 10/21 街道紀錄｜未加入場所處數'),'venue_table':table(['CSV 列號','行政區','地址','經度、緯度','備註原文'],venue_rows,'三筆場所原文｜位置為場域定位點，沒有逐桶座標'),'zhongshan_distance':f"{stations[0]['nearest_street_record']['distance_m']:.1f}",'xinsheng_distance':f"{stations[1]['nearest_street_record']['distance_m']:.1f}"}
    article=(ROOT/'article.html').read_text()
    for key,value in replacements.items():article=article.replace('{{'+key+'}}',value)
    assert '{{' not in article
    block='<!-- station-venue-recheck-20261022:start -->\n'+article+'<!-- station-venue-recheck-20261022:end -->\n'
    p=SITE/'dist/index.html';s=p.read_text()
    if '<!-- station-venue-recheck-20261022:start -->' in s:s=re.sub(r'<!-- station-venue-recheck-20261022:start -->.*?<!-- station-venue-recheck-20261022:end -->\n',lambda _:block,s,flags=re.S)
    else:
        marker='<article class="reader-item" id="reader-method-selection"';assert s.count(marker)==1;s=s.replace(marker,block+marker)
    link='<a href="#reader-method-station-venues">中山與忠孝新生場所補查</a>'
    if link not in s:s=s.replace('<a href="#reader-method-selection">選點規則與敏感度</a>',link+'<a href="#reader-method-selection">選點規則與敏感度</a>')
    p.write_text(s);print('Rendered two-station venue follow-up.')
if __name__=='__main__':build()
