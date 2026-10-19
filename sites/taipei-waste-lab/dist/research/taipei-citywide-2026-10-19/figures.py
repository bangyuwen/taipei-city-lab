"""Source-linked citywide figures with editable Matplotlib code."""
import csv,json,math
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ticker import StrMethodFormatter
ROOT=Path(__file__).resolve().parent

def create_figures():
 out=ROOT/'results/figures';out.mkdir(exist_ok=True)
 font=Path('/System/Library/Fonts/Supplemental/Arial Unicode.ttf')
 if font.exists():
  font_manager.fontManager.addfont(str(font));plt.rcParams['font.family']=font_manager.FontProperties(fname=font).get_name()
 plt.rcParams.update({'font.size':12,'axes.spines.top':False,'axes.spines.right':False,'text.color':'#173b43','axes.labelcolor':'#173b43','figure.facecolor':'white'})
 s=json.loads((ROOT/'results/summary.json').read_text());districts=s['districts'];city=districts[:12]
 fig,ax=plt.subplots(figsize=(11,7.6));fig.subplots_adjust(left=.15,right=.82,bottom=.18,top=.86)
 rows=sorted(city,key=lambda r:-r['events']);ax.barh([r['source_area'] for r in rows],[r['events'] for r in rows],color='#235963',height=.62);ax.invert_yaxis();ax.set_xlim(0,max(r['events'] for r in rows)*1.30)
 for i,r in enumerate(rows):ax.text(r['events']+18000,i,f"{r['events']:,} · {r['eligible_stations']} 站",va='center',fontsize=11)
 ax.xaxis.set_major_formatter(StrMethodFormatter('{x:,.0f}'));ax.set_xlabel('七月檔已觀測借還端點事件（次）；全區啟用有效站');ax.grid(axis='x',alpha=.15);ax.set_axisbelow(True)
 fig.suptitle('全臺北市 12 區活動分布：用同一規則比較',x=.05,ha='left',fontsize=18,fontweight='bold')
 campus=districts[12];fig.text(.05,.04,f"校區另列：{campus['eligible_stations']} 站、{campus['events']:,} 次，不重複算入12區。\n來源：2026-07借還檔 × 2026-10-18站點。日期有缺口，非完整月總量、人數或垃圾量。",fontsize=11)
 fig.savefig(out/'district-activity.png',dpi=170);plt.close(fig)
 fig,axes=plt.subplots(1,2,figsize=(11,7.3),sharey=True);fig.subplots_adjust(left=.12,right=.95,bottom=.18,top=.83,wspace=.22)
 for ax,key,title,color in zip(axes,['street_rows','venue_rows'],['街道清冊：位置列數','場所清冊：服務場所列數'],['#235963','#aa6e36']):
  vals=[r[key] for r in city];ax.barh([r['source_area'] for r in city],vals,color=color,height=.62);ax.set_title(title,fontsize=14);ax.set_xlim(0,max(vals)*1.25)
  for i,n in enumerate(vals):ax.text(n+max(vals)*.03,i,str(n),va='center')
  ax.grid(axis='x',alpha=.12);ax.set_axisbelow(True)
 axes[0].invert_yaxis();fig.suptitle('清冊覆蓋必須先查：零列不等於現場沒有桶',x=.05,ha='left',fontsize=18,fontweight='bold')
 fig.text(.05,.04,'街道681列（2026-09-30）與場所130列（2026-08-18）粒度不同，不能相加成桶數。\n北投0街道列、南港4列先補查；清冊完整性與現場可用均未核實。',fontsize=11)
 fig.savefig(out/'catalog-coverage.png',dpi=170);plt.close(fig)
 with (ROOT/'results/stations.csv').open(encoding='utf-8-sig') as f:stations=list(csv.DictReader(f))
 fig,ax=plt.subplots(figsize=(12,10));fig.subplots_adjust(left=.10,right=.75,bottom=.17,top=.86)
 valid=[r for r in stations if r['eligible']=='True'];x=[float(r['lon']) for r in valid];y=[float(r['lat']) for r in valid]
 ax.scatter(x,y,s=8,color='#a7b9bd',alpha=.65,label='全部啟用有效站')
 colors=plt.get_cmap('tab20').colors
 for i,d in enumerate(districts):
  pts=[c for c in s['candidates'] if c['source_area']==d['source_area']]
  ax.scatter([c['lon'] for c in pts],[c['lat'] for c in pts],s=60,facecolors='white',edgecolors=colors[i],linewidths=2,label=d['source_area'])
 ax.set_aspect(1/math.cos(math.radians(25.06)));ax.set_xlabel('經度');ax.set_ylabel('緯度');ax.grid(alpha=.15);ax.legend(loc='upper left',bbox_to_anchor=(1.01,1),fontsize=10,ncol=1,frameon=False)
 fig.suptitle('全市 36 處首輪查核錨點，另列校區 3 處',x=.05,ha='left',fontsize=18,fontweight='bold')
 fig.text(.05,.04,'各區依活動量挑3點，同區點間至少300m直線；完整站點皆保留。\n座標圖沒有道路或行政區界，不是實走路徑、服務缺口圖或新桶配置圖。\n所有區納入規劃；彩色圈只代表首輪查核，不代表其餘地區不需服務。',fontsize=11)
 fig.savefig(out/'citywide-context.png',dpi=170);plt.close(fig)
 return out
if __name__=='__main__':print(create_figures())
