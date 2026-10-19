"""Editable notebook figures; also export the same reviewed figures for the site."""
import csv
import json
import math
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ticker import StrMethodFormatter
from analyze import ROOT, CENTER, load_facilities, distance


def create_figures():
    output=ROOT/'results/figures';output.mkdir(exist_ok=True)
    font=Path('/System/Library/Fonts/Supplemental/Arial Unicode.ttf')
    if font.exists():
        font_manager.fontManager.addfont(str(font))
        plt.rcParams['font.family']=font_manager.FontProperties(fname=font).get_name()
    plt.rcParams.update({'font.size':12,'axes.spines.top':False,'axes.spines.right':False,'axes.labelcolor':'#173b43',
        'text.color':'#173b43','xtick.color':'#36565d','ytick.color':'#36565d','figure.facecolor':'#ffffff','axes.facecolor':'#ffffff'})
    summary=json.loads((ROOT/'results/summary.json').read_text());top=summary['shortlist']
    fig,ax=plt.subplots(figsize=(10.5,4.6));fig.subplots_adjust(left=.36,right=.90,bottom=.20,top=.81)
    labels=[r['candidate_id']+' '+r['name'] for r in top]
    values=[r['events'] for r in top]
    ax.barh(labels,values,color='#235963',height=.56);ax.invert_yaxis();ax.set_xlim(0,max(values)*1.14)
    for i,n in enumerate(values):ax.text(n+900,i,f'{n:,}',va='center',fontsize=12)
    ax.set_xlabel('借車＋還車的站點活動事件（次）');ax.xaxis.set_major_formatter(StrMethodFormatter('{x:,.0f}'))
    ax.grid(axis='x',alpha=.15);ax.set_axisbelow(True)
    fig.suptitle('公館周邊優先查核站點：七月檔已觀測活動',x=.04,ha='left',fontsize=17,fontweight='bold')
    share=summary['top5_events']/summary['noncampus_events_500m']*100
    fig.text(.04,.04,f"500 m 內 {summary['noncampus_stations_500m']} 個非校區分類站；前五占已配對活動 {share:.1f}%。檔案日期有缺口，非完整月總量、非人數或垃圾量。",fontsize=10)
    fig.savefig(output/'activity-ranking.png',dpi=180);plt.close(fig)
    with (ROOT/'results/quality-hourly.csv').open(encoding='utf-8-sig') as f:profiles=list(csv.DictReader(f))
    fig,ax=plt.subplots(figsize=(10.5,4.7));fig.subplots_adjust(left=.10,right=.97,bottom=.22,top=.80)
    for kind,label,color,style in [('weekday','平日（22 日）','#235963','-'),('weekend','週末（7 日）','#a56031','--')]:
        rows=[r for r in profiles if r['day_type']==kind]
        ax.plot([int(r['hour']) for r in rows],[float(r['average_per_day']) for r in rows],label=label,color=color,linestyle=style,linewidth=2.5,marker='o',markersize=4)
    ax.set_ylim(bottom=0);ax.set_xticks([0,3,6,9,12,15,18,21,23]);ax.set_xlim(0,23)
    ax.set_xlabel('借／還事件記錄的小時（臺北時間）');ax.set_ylabel('前五站每日期平均事件（次）');ax.grid(alpha=.15);ax.legend(frameon=False)
    fig.suptitle('先觀察 18–19 時，再配一個低量時段作對照',x=.04,ha='left',fontsize=17,fontweight='bold')
    fig.text(.04,.05,'來源：2026-07 借還檔。排除品質標記日 7/10、7/11；其餘日期仍未證明資料完整。暑假樣本不代表全年。',fontsize=10)
    fig.savefig(output/'activity-hours.png',dpi=180);plt.close(fig)
    # Local geographic projection. No road geometry or path claim is implied.
    def xy(lon,lat):return (lon-CENTER[0])*math.pi/180*6371000*math.cos(math.radians(CENTER[1])),(lat-CENTER[1])*math.pi/180*6371000
    fig,ax=plt.subplots(figsize=(7.5,7.2));fig.subplots_adjust(left=.14,right=.95,bottom=.18,top=.82)
    bins=[r for r in load_facilities('bins-2026.csv') if distance(CENTER,(r['lon'],r['lat']))<=500]
    ax.scatter(*zip(*(xy(r['lon'],r['lat']) for r in bins)),marker='s',s=46,facecolors='white',edgecolors='#a56031',label='2026 清潔箱清冊位置')
    pts=[xy(r['lon'],r['lat']) for r in top]
    ax.scatter(*zip(*pts),s=100,color='#235963',alpha=.85,label='活動前五站（C1–C5）')
    offsets=[(30,35),(-150,-10),(-95,65),(50,-35),(-110,-35)]
    for r,pt,offset in zip(top,pts,offsets):ax.annotate(r['candidate_id'],xy=pt,xytext=(pt[0]+offset[0],pt[1]+offset[1]),arrowprops={'arrowstyle':'-','color':'#36565d'},fontweight='bold')
    ax.add_patch(plt.Circle((0,0),500,fill=False,color='#94afb3',linestyle='--'))
    ax.set_xlim(-550,550);ax.set_ylim(-550,550);ax.set_aspect('equal');ax.grid(alpha=.12)
    ax.set_xlabel('距公館 2 號出口東西向距離（m）');ax.set_ylabel('南北向距離（m）')
    ax.legend(loc='upper left',frameon=False,fontsize=10)
    fig.suptitle('五站與既有箱位的相對座標',x=.06,ha='left',fontsize=17,fontweight='bold')
    fig.text(.06,.05,'本圖無道路底圖；圓線是 500 m 直線範圍，非步行路線。\n方框是清冊位置，不保證現場可用；站點圓點不是新設垃圾桶位置。',fontsize=10)
    fig.savefig(output/'station-context.png',dpi=180);plt.close(fig)
    return output


if __name__=='__main__':print(create_figures())
