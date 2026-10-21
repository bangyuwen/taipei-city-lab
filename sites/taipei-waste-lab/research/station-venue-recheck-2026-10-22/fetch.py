"""Retrieve the bounded official evidence set; retain original bytes and receipts."""
from pathlib import Path
import concurrent.futures, datetime, hashlib, json, urllib.request
ROOT=Path(__file__).resolve().parent
SOURCES={
 'venues.csv':'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=2030d728-9597-437d-81a4-cf2a44c7f114',
 'streets-2026-10-21.csv':'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=267d550f-c6ec-46e0-b8af-fd5a464eb098',
 'catalog.html':'https://data.taipei/dataset/detail?id=a835f3ba-7f50-4b0d-91a6-9df128632d1c',
 'zhongshan-station.html':'https://web.metro.taipei/pages2026/WebStation/053/1',
 'xinsheng-station.html':'https://web.metro.taipei/pages2026/WebStation/089/1',
 'zhongshan-redesign.html':'https://www.metro.taipei/News_Content.aspx?n=30CCEFD2A45592BF&s=6BD780192C794BB9&sms=72544237BBE4C5F6',
 'zhongshan-award.html':'https://www.metro.taipei/News_Content.aspx?n=30CCEFD2A45592BF&s=E19FD70C44C8CF96',
 'metro-signage.html':'https://bilingual.gov.taipei/News.aspx?PageSize=20&n=AD6BEFFD17B96AFF&page=398&sms=07B778C3B77F8F91',
 'zhongshan-map.pdf':'https://web.metro.taipei/img/ALL/INFOPDF/053.pdf',
}
def fetch(pair):
 name,url=pair
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'TaipeiWasteResearch/1.0'}),timeout=45) as r:
  b=r.read();status=r.status;ctype=r.headers.get('Content-Type'); final=r.url
 assert status==200 and b, (name,status)
 if name.endswith('.pdf'):assert b.startswith(b'%PDF')
 if name.endswith('.csv'):assert b'<html' not in b[:300].lower()
 (ROOT/'inputs'/name).write_bytes(b)
 return {'file':'inputs/'+name,'url':url,'final_url':final,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'http_status':status,'content_type':ctype,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
if __name__=='__main__':
 if any((ROOT/'inputs'/name).exists() for name in SOURCES):raise SystemExit('Historical inputs already exist; retrieve later versions into a new dated evidence set.')
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: receipts=list(pool.map(fetch,SOURCES.items()))
 (ROOT/'retrieval.json').write_text(json.dumps(receipts,ensure_ascii=False,indent=2)+'\n')
 for r in receipts:print(r['file'],r['bytes'],r['sha256'])
