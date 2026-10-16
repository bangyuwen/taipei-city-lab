const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const source = (label, url) => ({ label, url });

export const COUNTRY_STORIES = deepFreeze({
  japan: {
    intro: '大阪道頓堀的 SmaGO 案例把商圈行人收集、店家合作與清運安排放在一起看。照片記錄的是大阪案例設備外觀；本站互動只用來辨認入口與箱體。',
    takeaway: '可參考把點位、滿溢通知與清運責任接起來。營運方的前後觀察沒有同期對照，不能單獨證明桶型造成垃圾減少。',
    stops: [
      {
        title: '先看成對箱體',
        text: '照片裡是並排的黃色箱體，兩側入口形式不同；外觀不能揭示箱內壓縮結構。',
        view: 'overview',
        partId: null,
        kind: 'photo',
        source: source('大阪道頓堀 SmaGO 照片來源 · JTB', 'https://www.jtbcorp.jp/jp/newsroom/2023/11/16_01_dotonbori-clean%EF%BD%B0activities.html'),
      },
      {
        title: '試看左側翻板',
        text: '選擇左側入口翻板只播放模型門片示意；真實鉸點、尺寸與收受品項沒有由這段動畫驗證。',
        view: 'front',
        partId: 'left-flap',
        kind: 'illustration',
        source: null,
      },
      {
        title: '追蹤誰接住清運',
        text: 'NTT 的 2023 公告描述商店會主導、合同衛生公司回收，並依滿溢通知安排清運。',
        view: 'back',
        partId: null,
        kind: 'document',
        source: source('SmaGO 大阪試驗與作業公告 · 2023-11-16', 'https://www.ntt.com/about-us/press-releases/news/article/2023/1116.html'),
      },
    ],
    question: {
      prompt: '這個大阪案例公告描述的清運分工是什麼？',
      options: [
        { id: 'shop-association', label: '商店會主導，合同衛生公司承接回收。' },
        { id: 'fixed-city-route', label: '市府清潔隊依固定每週路線清空。' },
      ],
      answerId: 'shop-association',
      explanation: '公告記錄的是商店會與合同衛生公司的合作安排；不能從模型動畫推定清運週期。',
      source: source('SmaGO 大阪試驗與作業公告 · 2023-11-16', 'https://www.ntt.com/about-us/press-releases/news/article/2023/1116.html'),
    },
    evidence: [
      {
        kind: 'photo',
        text: '大阪道頓堀案例照片可見成對箱體與不同入口；照片不展示箱內機構。',
        source: source('大阪道頓堀 SmaGO 照片來源 · JTB', 'https://www.jtbcorp.jp/jp/newsroom/2023/11/16_01_dotonbori-clean%EF%BD%B0activities.html'),
      },
      {
        kind: 'illustration',
        text: '模型把紙片移入箱內，是互動示意；不證明實際通道、壓縮效果或感測方式。',
        source: null,
      },
      {
        kind: 'document',
        text: '公告說明商店會、合同衛生公司的回收合作與滿溢前通知；前後垃圾量觀察沒有同期對照。',
        source: source('SmaGO 大阪試驗與作業公告 · 2023-11-16', 'https://www.ntt.com/about-us/press-releases/news/article/2023/1116.html'),
      },
      {
        kind: 'unknown',
        text: '公開頁面沒有列單桶價格與完整維護費，也無法把觀察到的變化單獨歸因於設備。',
        source: null,
      },
    ],
    partNotes: {
      'left-flap': {
        observation: '模型左側有深色矩形翻板，右側另有藍色圓形入口。',
        inference: '動畫讓翻板繞軸移動；實際軸位、回彈力與可收品項未量測。',
      },
      'paper-deposit': {
        observation: '互動示意一片紙從左側入口落入箱體。',
        inference: '落下路徑是程式示意，不代表箱內導流結構或分類規則。',
      },
    },
  },
  uk: {
    intro: '倫敦案例需把照片地點與金融城試辦報告分開讀。本站照片拍於西敏市 Belgrave Square，展示同系列 Bigbelly 外觀，不是 Bishopsgate 試辦現場。',
    takeaway: '照片可幫助辨認外型，試辦成效要回到金融城報告；兩者不能互相代替，也不能由外觀推論省下人手或車次。',
    stops: [
      {
        title: '辨認照片拍攝地',
        text: '這張 2015 年照片來自西敏市 Belgrave Square；它不是金融城 Bishopsgate 試辦點的現場照。',
        view: 'front',
        partId: null,
        kind: 'photo',
        source: source('西敏市 Bigbelly 照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:BigBelly_solar_compactor_in_Belgrave_Square_02.JPG'),
      },
      {
        title: '試看前方入口',
        text: '前方翻板是本站依同系列外觀製作的模型部件；動畫不驗證真實機械、尺寸或壓縮能力。',
        view: 'front',
        partId: 'entry-flap',
        kind: 'illustration',
        source: null,
      },
      {
        title: '另讀金融城試辦',
        text: '金融城報告記錄 2015 年 Bishopsgate 試辦的清空與清潔觀察；這些資料與西敏市照片來自不同地點。',
        view: 'side',
        partId: null,
        kind: 'document',
        source: source('Bishopsgate Bin Trial 報告 · 2016', 'https://democracy.cityoflondon.gov.uk/documents/s61842/Bishopsgate%20Bin%20Trial%202016%20PHES%20-%20Final.pdf'),
      },
    ],
    question: {
      prompt: '西敏市 Belgrave Square 照片能支持哪一項判讀？',
      options: [
        { id: 'westminster-photo', label: '它記錄西敏市同系列設備外觀，不能當作 Bishopsgate 試辦現場照。' },
        { id: 'bishopsgate-proof', label: '它直接證明金融城試辦的桶數與清潔成效。' },
      ],
      answerId: 'westminster-photo',
      explanation: '照片說明列出 Belgrave Square 與 2015 年；金融城試辦的桶數和營運觀察要看另一份報告。',
      source: source('西敏市 Bigbelly 照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:BigBelly_solar_compactor_in_Belgrave_Square_02.JPG'),
    },
    evidence: [
      {
        kind: 'photo',
        text: 'Wikimedia 照片說明為西敏市 Belgrave Square、2015-09-20；同系列設備不等於試辦地點相同。',
        source: source('西敏市 Bigbelly 照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:BigBelly_solar_compactor_in_Belgrave_Square_02.JPG'),
      },
      {
        kind: 'illustration',
        text: '模型翻板和紙片動畫只呈現本站示意的入口互動，不代表內部壓縮機構。',
        source: null,
      },
      {
        kind: 'document',
        text: '金融城報告涵蓋另一處 Bishopsgate 試辦，記錄 9 個桶及清潔觀察；不能與照片地點混為一談。',
        source: source('Bishopsgate Bin Trial 報告 · 2016', 'https://democracy.cityoflondon.gov.uk/documents/s61842/Bishopsgate%20Bin%20Trial%202016%20PHES%20-%20Final.pdf'),
      },
      {
        kind: 'unknown',
        text: '報告中的清潔分級變化沒有證明省下清運人力或車次；照片也不提供桶體尺寸。',
        source: source('Bishopsgate Bin Trial 報告 · 2016', 'https://democracy.cityoflondon.gov.uk/documents/s61842/Bishopsgate%20Bin%20Trial%202016%20PHES%20-%20Final.pdf'),
      },
    ],
    partNotes: {
      'entry-flap': {
        observation: '模型正面有一片帶把手的入口翻板，外殼頂部呈弧形。',
        inference: '動畫只示意翻板開合；真實鉸鏈結構和太陽能壓縮循環未由模型驗證。',
      },
      'paper-deposit': {
        observation: '動畫讓一片紙從前方入口移入箱體。',
        inference: '紙片路徑不是設備剖面，也不表示真實可收物只有紙類。',
      },
    },
  },
  denmark: {
    intro: '哥本哈根 CitySolar 案例同時有桶型照片與較新的市府測試規劃。照片是市府介紹的桶型，沒有確認為哥本哈根試辦現場。',
    takeaway: '2025 年備忘錄描述的是規劃測試，不是已完成的效益評估。踏板動畫只為認識模型部件，不能當作真實操作證據。',
    stops: [
      {
        title: '看市府介紹的桶型',
        text: '照片呈現黑色櫃體、斜面頂部與腳踏；來源沒有確認拍攝地點或日期。',
        view: 'side',
        partId: null,
        kind: 'photo',
        source: source('CitySolar 桶型照片來源 · 哥本哈根 Indre By 地方委員會', 'https://indrebylokaludvalg.kk.dk/nyheder/forsoeg-med-komprimerende-affaldskurve-i-indre-by'),
      },
      {
        title: '試踩模型踏板',
        text: '選擇踏板只播放模型部件位移；腳踏與翻板的真實連動、尺寸和耐用度未經本站量測。',
        view: 'front',
        partId: 'foot-pedal',
        kind: 'illustration',
        source: null,
      },
      {
        title: '讀 2025 測試規劃',
        text: '市府備忘錄規劃 16 處、16 個月的測試；規劃時程不等於已完成或已證實效果。',
        view: 'back',
        partId: null,
        kind: 'document',
        source: source('哥本哈根市測試備忘錄 · 2025-12-04', 'https://www.kk.dk/sites/default/files/2025-12/04.12.25%20-%20Orienteringsnotat%20om%20test%20af%20maskinelt%20t%C3%B8mte%20mini-t%C3%A5rnkurve%20og%20kompressionskurve.pdf'),
      },
    ],
    question: {
      prompt: '2025 年哥本哈根備忘錄描述的新版測試處於哪個階段？',
      options: [
        { id: 'planned', label: '規劃在 16 處測試 16 個月，尚不能當成完成評估。' },
        { id: 'completed', label: '已完成 16 個月測試並確認節省清運成本。' },
      ],
      answerId: 'planned',
      explanation: '備忘錄列出的是測試規劃；沒有新版完成評估可以支持已確認的節省結果。',
      source: source('哥本哈根市測試備忘錄 · 2025-12-04', 'https://www.kk.dk/sites/default/files/2025-12/04.12.25%20-%20Orienteringsnotat%20om%20test%20af%20maskinelt%20t%C3%B8mte%20mini-t%C3%A5rnkurve%20og%20kompressionskurve.pdf'),
    },
    evidence: [
      {
        kind: 'photo',
        text: '地方委員會頁面展示 CitySolar 桶型，沒有標明這張照片就是新測試現場。',
        source: source('CitySolar 桶型照片來源 · 哥本哈根 Indre By 地方委員會', 'https://indrebylokaludvalg.kk.dk/nyheder/forsoeg-med-komprimerende-affaldskurve-i-indre-by'),
      },
      {
        kind: 'illustration',
        text: '模型可掀入口或踩踏板；動畫不驗證真實連動、壓縮力或清運方式。',
        source: null,
      },
      {
        kind: 'document',
        text: '2025-12-04 市府備忘錄規劃 16 處、16 個月測試，並列年度計畫額度；額度不是單桶價格。',
        source: source('哥本哈根市測試備忘錄 · 2025-12-04', 'https://www.kk.dk/sites/default/files/2025-12/04.12.25%20-%20Orienteringsnotat%20om%20test%20af%20maskinelt%20t%C3%B8mte%20mini-t%C3%A5rnkurve%20og%20kompressionskurve.pdf'),
      },
      {
        kind: 'unknown',
        text: '本輪案例資料沒有新版測試的完成評估；早期智慧桶的經驗不能代替新版結果。',
        source: null,
      },
    ],
    partNotes: {
      'entry-flap': {
        observation: '模型正面有一片上方入口翻板，旁邊有淺綠色辨識帶。',
        inference: '翻板動畫不證明實際投放方向、尺寸或清運機構。',
      },
      'paper-deposit': {
        observation: '動畫把紙片從上方入口移入模型箱體。',
        inference: '投放物的路徑是示意，不能推定分類規則或真實箱內容量。',
      },
      'foot-pedal': {
        observation: '模型前方畫有一塊金屬踏板。',
        inference: '踩踏與翻板的連動僅是模型動畫，實際機械連接和安全性未驗證。',
      },
    },
  },
  us: {
    intro: '舊金山 Slim Silhouette 的照片記錄 2022 年原型清潔；城市 2026 年採購簡報描述另一個後續階段。兩種資料不可拼成同一批實物。',
    takeaway: '把原型照片、採購規格與現場部署進度分開核對，才能知道每項證據回答的是哪個版本和日期。',
    stops: [
      {
        title: '看 2022 原型照片',
        text: '照片中的工作人員正在清潔 Slim Silhouette 原型；它不是 2026 年大量採購版的實拍。',
        view: 'front',
        partId: null,
        kind: 'photo',
        source: source('Slim Silhouette 原型清潔照片 · San Francisco Public Works', 'https://www.flickr.com/photos/sfdpw/52580460593/'),
      },
      {
        title: '試看窄槽翻片',
        text: '選擇窄槽翻板只播放本站模型的開合；格柵數量、材料、尺寸與真實投入口都未以照片量測。',
        view: 'front',
        partId: 'slot-flap',
        kind: 'illustration',
        source: null,
      },
      {
        title: '核對 2026 簡報',
        text: '公共工程局簡報說明採購與測試進度；簡報中的後續版本不能反向證明 2022 原型照片的細節。',
        view: 'back',
        partId: null,
        kind: 'document',
        source: source('San Francisco Public Works 採購與測試簡報 · 2026-03', 'https://media.api.sf.gov/documents/Public_Works_Refuse_Rate_Board_presentation_3.13.26_final.pdf'),
      },
    ],
    question: {
      prompt: 'Slim Silhouette 清潔照片記錄的是哪個階段？',
      options: [
        { id: 'prototype-2022', label: '2022 年原型的清潔作業。' },
        { id: 'procurement-2026', label: '2026 年大量採購版部署完成後的現場作業。' },
      ],
      answerId: 'prototype-2022',
      explanation: '照片頁的日期與說明指向 2022 年原型清潔；採購及後續部署進度要以 2026 年簡報另行核對。',
      source: source('Slim Silhouette 原型清潔照片 · San Francisco Public Works', 'https://www.flickr.com/photos/sfdpw/52580460593/'),
    },
    evidence: [
      {
        kind: 'photo',
        text: 'San Francisco Public Works 的照片頁記錄 2022-12-21 原型清潔；格柵外觀不代表 2026 採購版規格。',
        source: source('Slim Silhouette 原型清潔照片 · San Francisco Public Works', 'https://www.flickr.com/photos/sfdpw/52580460593/'),
      },
      {
        kind: 'illustration',
        text: '模型翻片與紙片落下是程式示意，不能證明設備內部容量、感測器或材料。',
        source: null,
      },
      {
        kind: 'document',
        text: '2026 年簡報稱先有 10 個單位進入測試，後續街頭部署另有進度；不能把規劃採購數量當成已部署數。',
        source: source('San Francisco Public Works 採購與測試簡報 · 2026-03', 'https://media.api.sf.gov/documents/Public_Works_Refuse_Rate_Board_presentation_3.13.26_final.pdf'),
      },
      {
        kind: 'unknown',
        text: '照片不能回答採購版本的格柵數、材料、安裝成本或後續使用成效。',
        source: source('San Francisco Public Works 採購與測試簡報 · 2026-03', 'https://media.api.sf.gov/documents/Public_Works_Refuse_Rate_Board_presentation_3.13.26_final.pdf'),
      },
    ],
    partNotes: {
      'slot-flap': {
        observation: '模型的圓筒上方有一條窄槽與可翻動的小片。',
        inference: '動畫只顯示模型翻片，不能據此判定真實槽口尺寸或防雨方式。',
      },
      'paper-deposit': {
        observation: '動畫把紙片送過上方窄槽。',
        inference: '這是紙片示意路徑，不是設備內部構造或真實收容量證據。',
      },
    },
  },
  finland: {
    intro: '芬蘭案例有兩個不同場景：照片是 Oulu 於 2009 年拍攝的 Molok 地上可見部分，赫爾辛基 2024 年智慧收運試驗則有自己的官方說明。',
    takeaway: '不要把 Oulu 照片當成赫爾辛基試驗現場，也不要從地上外觀推測地下容器、感測器或清運成效。',
    stops: [
      {
        title: '只看 Oulu 可見部分',
        text: '2009 年照片可見木條圓筒與深色上蓋；它不是赫爾辛基 2024 年試驗照片，亦未展示地下構造。',
        view: 'overview',
        partId: null,
        kind: 'photo',
        source: source('Oulu Molok 照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Molok_waste_cans.JPG'),
      },
      {
        title: '試看模型前方小蓋',
        text: '模型只畫出地面以上的筒身與一片小蓋；動畫不表示地下深埋結構、感測器或真實開合尺寸。',
        view: 'front',
        partId: 'front-hatch-deposit',
        kind: 'illustration',
        source: null,
      },
      {
        title: '另讀赫爾辛基試驗',
        text: '赫爾辛基官方頁面說明 2024 年在市有物業使用滿度感測與收運平台；這不是 Oulu 照片的設備證據。',
        view: 'back',
        partId: null,
        kind: 'document',
        source: source('赫爾辛基智慧廢棄物收運試驗說明 · 2024', 'https://testbed.hel.fi/rakennettu-ymparisto/alykasta-jatehuoltoa-kokeillaan-ympari-helsinkia-kokeilu-on-tassa-mittakaavassa-ainutlaatuinen/'),
      },
    ],
    question: {
      prompt: 'Oulu 的 Molok 照片能直接證明什麼？',
      options: [
        { id: 'visible-2009', label: '2009 年照片中的地上可見外觀。' },
        { id: 'helsinki-sensor', label: '赫爾辛基 2024 年試驗使用了相同照片中的感測器與地下構造。' },
      ],
      answerId: 'visible-2009',
      explanation: '照片來源記錄 Oulu 的地上外觀；赫爾辛基試驗是另一個場景，照片不能證明地下設備或感測器。',
      source: source('Oulu Molok 照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Molok_waste_cans.JPG'),
    },
    evidence: [
      {
        kind: 'photo',
        text: 'Wikimedia 照片與圖說指向 Oulu、2009 年及地上可見的 Molok 筒箱，不是赫爾辛基試驗現場。',
        source: source('Oulu Molok 照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Molok_waste_cans.JPG'),
      },
      {
        kind: 'illustration',
        text: '模型互動只示意前方小蓋與地上可見部分，不畫也不推測地下構造。',
        source: null,
      },
      {
        kind: 'document',
        text: '赫爾辛基 2024 年頁面談的是市有物業的滿度感測試驗；來源列 26 處、117 桶，原定於 2025 年夏季結束。',
        source: source('赫爾辛基智慧廢棄物收運試驗說明 · 2024', 'https://testbed.hel.fi/rakennettu-ymparisto/alykasta-jatehuoltoa-kokeillaan-ympari-helsinkia-kokeilu-on-tassa-mittakaavassa-ainutlaatuinen/'),
      },
      {
        kind: 'unknown',
        text: '案例資料沒有找到最終節省評估；照片也無法驗證感測器是否裝在其中任一個地上筒箱。',
        source: null,
      },
    ],
    partNotes: {
      'front-hatch-deposit': {
        observation: '模型以木條圓筒、錐形上蓋和前方小蓋呈現地上可見外觀。',
        inference: '動畫不代表真實小蓋尺寸、地下筒體深度或感測器配置。',
      },
    },
  },
  korea: {
    intro: '韓國這個案例談的是共同住宅廚餘的 RFID 辨識與秤重服務。照片來自九里市；首爾與環境公團文件提供服務背景，不能把不同城市的設備當成同一型號。',
    takeaway: 'RFID 家戶廚餘服務有明確使用者、秤重與收費流程；它不是匿名街頭垃圾箱，也不能用來推論街桶的分類或效果。',
    stops: [
      {
        title: '辨認九里市照片',
        text: '照片顯示九里市住宅廚餘設備，橘色上罩與水平投入口可見；它不是首爾設備照片。',
        view: 'front',
        partId: null,
        kind: 'photo',
        source: source('九里市 RFID 廚餘設備照片來源 · Guri City', 'https://www.guri.go.kr/www/selectBbsNttView.do?bbsNo=42&integrDeptCode=&key=393&nttNo=1538&pageIndex=562&searchCnd=all&searchCtgry=&searchKrwd='),
      },
      {
        title: '試看水平入口蓋',
        text: '互動只示意模型入口蓋掀起；不能由動畫驗證 RFID 讀取、秤重精度或實際操作程序。',
        view: 'side',
        partId: 'horizontal-hatch-deposit',
        kind: 'illustration',
        source: null,
      },
      {
        title: '讀家戶服務流程',
        text: '環境公團說明 RFID 如何連結住戶識別、廚餘秤重與計費；首爾補助資料是地方資訊，不是全韓統一機價。',
        view: 'back',
        partId: null,
        kind: 'document',
        source: source('韓國環境公團 RFID 廚餘系統說明', 'https://www.keco.or.kr/web/lay1/S1T184C1061/contents.do'),
      },
    ],
    question: {
      prompt: '韓國 RFID 秤重服務的主要使用情境是什麼？',
      options: [
        { id: 'household-food-waste', label: '已登錄共同住宅住戶投放廚餘，並依重量計費。' },
        { id: 'anonymous-street-bin', label: '匿名行人把一般街頭垃圾放入公共分類箱。' },
      ],
      answerId: 'household-food-waste',
      explanation: '官方說明的服務對象是共同住宅住戶與廚餘；九里市照片、首爾補助和全國統計各有不同範圍。',
      source: source('韓國環境公團 RFID 廚餘系統說明', 'https://www.keco.or.kr/web/lay1/S1T184C1061/contents.do'),
    },
    evidence: [
      {
        kind: 'photo',
        text: '九里市 2022 年新聞稿提供住宅廚餘設備照片；這不是首爾案例，也不代表全韓國統一機型。',
        source: source('九里市 RFID 廚餘設備照片來源 · Guri City', 'https://www.guri.go.kr/www/selectBbsNttView.do?bbsNo=42&integrDeptCode=&key=393&nttNo=1538&pageIndex=562&searchCnd=all&searchCtgry=&searchKrwd='),
      },
      {
        kind: 'illustration',
        text: '模型只示意入口蓋和物件移動；不模擬 RFID 辨識或秤重計費。',
        source: null,
      },
      {
        kind: 'document',
        text: '環境公團說明住戶識別、秤重及計費；首爾的安裝補助則是地方補助資訊。',
        source: source('韓國環境公團 RFID 廚餘系統說明', 'https://www.keco.or.kr/web/lay1/S1T184C1061/contents.do'),
      },
      {
        kind: 'unknown',
        text: '照片未確認拍攝日，補助金額不是九里照片設備報價，也不能代表全韓單價或街頭桶成本。',
        source: source('九里市 RFID 廚餘設備照片來源 · Guri City', 'https://www.guri.go.kr/www/selectBbsNttView.do?bbsNo=42&integrDeptCode=&key=393&nttNo=1538&pageIndex=562&searchCnd=all&searchCtgry=&searchKrwd='),
      },
    ],
    partNotes: {
      'horizontal-hatch-deposit': {
        observation: '模型把水平入口、橘色上罩與側邊鍵盤畫在同一櫃體上。',
        inference: '動畫掀蓋不驗證 RFID、秤重精度、計費連線或實際安全機構。',
      },
    },
  },
  france: {
    intro: '巴黎街頭照片展示開放式金屬線籃與內袋。市府清潔資料則談日常清空與回報服務；照片本身無法說明清運頻率或防鼠成效。',
    takeaway: '比較街桶時，將外觀、清潔服務與成效評估分開。日清紀錄不代表某一桶型單獨造成環境改善。',
    stops: [
      {
        title: '看開放線籃與內袋',
        text: '2015 年巴黎街頭照片可見細長金屬線框和袋體；案例頁沒有確認它是 Cybel 產品。',
        view: 'side',
        partId: null,
        kind: 'photo',
        source: source('巴黎街桶照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Trash_bin_in_Paris,_10_August_2015.jpg'),
      },
      {
        title: '試看敞口投入',
        text: '模型示意物品經開放籃口落下，沒有另加翻蓋；這不是對真實內袋安裝方式或可收品項的驗證。',
        view: 'front',
        partId: 'open-top-deposit',
        kind: 'illustration',
        source: null,
      },
      {
        title: '核對市府清潔安排',
        text: '巴黎市府說明一般清潔服務每日清空 1 至 3 次，依人流和活動調整，並可透過 DansMaRue 回報。',
        view: 'back',
        partId: null,
        kind: 'document',
        source: source('巴黎市府清潔與收運服務', 'https://www.paris.fr/pages/la-proprete-239'),
      },
    ],
    question: {
      prompt: '巴黎市府清潔頁面描述哪一種日常服務？',
      options: [
        { id: 'daily-adjusted', label: '每日清空 1 至 3 次，依人流與活動調整。' },
        { id: 'sensor-schedule', label: '所有普通街桶都由滿度感測器自動安排清空。' },
      ],
      answerId: 'daily-adjusted',
      explanation: '清潔頁記錄的是市府清運與清潔做法；所查資料沒有確認普通街桶都有滿度感測。',
      source: source('巴黎市府清潔與收運服務', 'https://www.paris.fr/pages/la-proprete-239'),
    },
    evidence: [
      {
        kind: 'photo',
        text: '巴黎街頭照片來自 2015-08-10，能看見線框和袋體，但沒有確認品牌或完整規格。',
        source: source('巴黎街桶照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Trash_bin_in_Paris,_10_August_2015.jpg'),
      },
      {
        kind: 'illustration',
        text: '投入和提出內袋是模型互動；不代表真實清潔員的工具、作法或桶內分類。',
        source: null,
      },
      {
        kind: 'document',
        text: '市府清潔頁列每日清空 1 至 3 次並按人流、活動調整；民眾回報服務不等於桶內感測。',
        source: source('巴黎市府清潔與收運服務', 'https://www.paris.fr/pages/la-proprete-239'),
      },
      {
        kind: 'unknown',
        text: '案例資料沒有把垃圾量或鼠害變化單獨歸因於這款線籃，也沒有列完整單桶維護成本。',
        source: source('巴黎市府清潔與收運服務', 'https://www.paris.fr/pages/la-proprete-239'),
      },
    ],
    partNotes: {
      'open-top-deposit': {
        observation: '模型上緣敞開，內側有一個半透明袋體。',
        inference: '紙片落入動畫不驗證真實袋體材質、固定方式或可收物規則。',
      },
      'remove-liner': {
        observation: '模型把內袋畫成可提出的獨立物件。',
        inference: '提出動作只供互動理解，不能推定巴黎清潔隊的實際工具或流程。',
      },
    },
  },
  netherlands: {
    intro: '阿姆斯特丹照片中的黃色押金瓶罐箱是舊式獨立取用箱。2026 年市府公告談的是另一批新公共垃圾桶；兩份資料不是同一個設備。',
    takeaway: '先辨認照片與公告各自記錄的對象，再談新桶試辦。舊箱外觀不能代表 2026 年新桶設計或成效。',
    stops: [
      {
        title: '辨認舊押金取用箱',
        text: '公園照片顯示黃色獨立押金箱，旁邊另有灰色一般垃圾桶；它不是 2026 年新公共垃圾桶。',
        view: 'front',
        partId: null,
        kind: 'photo',
        source: source('阿姆斯特丹舊押金箱照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Amsterdam_-_Statiegeldbak_in_Hoftuin.jpg'),
      },
      {
        title: '試看圓形回收入口',
        text: '模型示意物品經圓形入口落入舊式箱體；動畫不代表新款桶門或市府的新設計。',
        view: 'side',
        partId: 'bottle-deposit',
        kind: 'illustration',
        source: null,
      },
      {
        title: '另讀 2026 新桶公告',
        text: '市府公告說明 200 個新垃圾桶自 2026-09-28 開始安裝，目標月底完成；清潔效果仍待追蹤。',
        view: 'back',
        partId: null,
        kind: 'document',
        source: source('阿姆斯特丹 200 個新垃圾桶公告 · 2026-10-05', 'https://www.amsterdam.nl/en/news/new-litter-bins/'),
      },
    ],
    question: {
      prompt: '阿姆斯特丹 2026 年新桶公告與照片的關係是什麼？',
      options: [
        { id: 'separate-evidence', label: '照片是舊押金取用箱；公告談 2026 年新公共垃圾桶，兩者是不同設備。' },
        { id: 'same-equipment', label: '照片就是公告所列 200 個 2026 年新垃圾桶之一。' },
      ],
      answerId: 'separate-evidence',
      explanation: '照片來源是舊式押金取用箱；市府公告另述 2026 年開始安裝的新垃圾桶，不能把兩者合併。',
      source: source('阿姆斯特丹 200 個新垃圾桶公告 · 2026-10-05', 'https://www.amsterdam.nl/en/news/new-litter-bins/'),
    },
    evidence: [
      {
        kind: 'photo',
        text: 'Hoftuin 照片記錄黃色押金瓶罐取用箱，旁邊另有一般垃圾桶；不是 2026 年新款。',
        source: source('阿姆斯特丹舊押金箱照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Amsterdam_-_Statiegeldbak_in_Hoftuin.jpg'),
      },
      {
        kind: 'illustration',
        text: '模型只示意瓶罐投入圓孔；這段動作不能代表 2026 年新桶門或回收流程。',
        source: null,
      },
      {
        kind: 'document',
        text: '市府 2026-10-05 公告稱 200 個新垃圾桶從 9 月 28 日開始安裝，並以 10 月底為目標完成。',
        source: source('阿姆斯特丹 200 個新垃圾桶公告 · 2026-10-05', 'https://www.amsterdam.nl/en/news/new-litter-bins/'),
      },
      {
        kind: 'unknown',
        text: '新桶清潔效果仍待追蹤；舊押金箱照片不能提供新桶的結構、價格或表現資料。',
        source: source('阿姆斯特丹 200 個新垃圾桶公告 · 2026-10-05', 'https://www.amsterdam.nl/en/news/new-litter-bins/'),
      },
    ],
    partNotes: {
      'bottle-deposit': {
        observation: '模型是架高的黃色箱體，正面有圓孔與下方服務門。',
        inference: '動畫只示意物品經圓孔投入；不能推定新款垃圾桶的桶門設計或收容規則。',
      },
    },
  },
  singapore: {
    intro: '新加坡 HortPark 的 2011 年照片呈現一般垃圾與不同回收入口並排。NEA 的街桶資料描述的是依人流、現場需要與服務回饋配置，不是照片中的園區規格。',
    takeaway: '可參考按人流與使用回饋安排街桶位置；園區照片與全島街桶管理資料回答不同問題。',
    stops: [
      {
        title: '看 HortPark 四色箱',
        text: '照片呈現並排的綠、藍、紅、黃箱體；這是 HortPark 一組設備，不代表 NEA 全島街桶制式。',
        view: 'overview',
        partId: null,
        kind: 'photo',
        source: source('HortPark 回收箱照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Trash_Recycling_with_Disposal_Containers.jpg'),
      },
      {
        title: '試看四個入口上蓋',
        text: '模型依序掀起上蓋只是互動示意；照片顏色和動畫都不能取代現地標示或當地回收規則。',
        view: 'front',
        partId: 'sorting-lids',
        kind: 'illustration',
        source: null,
      },
      {
        title: '核對 NEA 配置方式',
        text: 'NEA 說明優先照顧公車站與繁忙步道等人流點，並依現場評估及民眾回饋增設或移位。',
        view: 'back',
        partId: null,
        kind: 'document',
        source: source('NEA 街桶配置與服務說明 · 2023-12-08', 'https://www.nea.gov.sg/media/readers-letters/index/there-are-more-than-10-000-trash-cans-across-the-island'),
      },
    ],
    question: {
      prompt: 'NEA 說明街桶會優先配置在哪些情境？',
      options: [
        { id: 'footfall', label: '公車站與繁忙步道等人流較高的位置。' },
        { id: 'uniform-spacing', label: '全島每條街採完全相同的固定間距。' },
      ],
      answerId: 'footfall',
      explanation: 'NEA 以人流、現場評估與民眾回饋說明配置；HortPark 照片本身不證明全島採相同箱型。',
      source: source('NEA 街桶配置與服務說明 · 2023-12-08', 'https://www.nea.gov.sg/media/readers-letters/index/there-are-more-than-10-000-trash-cans-across-the-island'),
    },
    evidence: [
      {
        kind: 'photo',
        text: 'HortPark 照片能辨認四色並排箱體；它不是 NEA 統一街桶規格、價格或成效證據。',
        source: source('HortPark 回收箱照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Trash_Recycling_with_Disposal_Containers.jpg'),
      },
      {
        kind: 'illustration',
        text: '動畫依序開啟模型上蓋，不代表現場標示或當地回收分類規則。',
        source: null,
      },
      {
        kind: 'document',
        text: 'NEA 2023 說明優先服務公車站、繁忙步道等地點，並依回饋調整配置；2025 熱點資料同時涉及巡查與宣導。',
        source: source('NEA 街桶配置與服務說明 · 2023-12-08', 'https://www.nea.gov.sg/media/readers-letters/index/there-are-more-than-10-000-trash-cans-across-the-island'),
      },
      {
        kind: 'unknown',
        text: '園區照片不能回答全島每個點位的清空頻率、單桶價格或增桶本身的因果效果。',
        source: null,
      },
    ],
    partNotes: {
      'sorting-lids': {
        observation: '模型並排四個窄箱，每格各有一片斜面上蓋。',
        inference: '動畫開蓋順序不是現地的回收規則，也不驗證箱內隔間尺寸。',
      },
      'paper-deposit': {
        observation: '模型把紙片送入藍色箱體的前方槽口。',
        inference: '顏色和投入動畫只是本站示意，不能套作所在地的分類指引。',
      },
    },
  },
  india: {
    intro: 'Indore 的照片記錄居民把小桶交給到戶收運車。這是家戶服務流程，不是行人街桶；城市改革文件補充路線和轉運安排。',
    takeaway: '先分辨服務對象與收運路徑。到戶家戶收運的車隊資料不能替代商業區行人垃圾桶的設計或成本。',
    stops: [
      {
        title: '看家戶交付收運',
        text: '照片中居民將小桶交給黃色收運車；它展示到戶交付，不是公用行人垃圾桶。',
        view: 'side',
        partId: null,
        kind: 'photo',
        source: source('Indore 到戶收運照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Door-to-door_Garbage_Collection_Vans_in_Indore_-_Under_Swachh_Bharat_Abhiyan.jpg'),
      },
      {
        title: '試看模型收集斗',
        text: '車斗傾斜和車輪轉動都是模型動畫；它們不表示實際路線、車輛規格或收運效率。',
        view: 'back',
        partId: 'collection-bed',
        kind: 'illustration',
        source: null,
      },
      {
        title: '追蹤垃圾到哪裡',
        text: 'Smart City Indore 的歷史說明記錄家戶到戶收運、GPS 路線追蹤與轉運站；GPS 追的是車輛，不是桶內滿度。',
        view: 'front',
        partId: null,
        kind: 'document',
        source: source('Smart City Indore 固體廢棄物改革紀錄', 'https://www.smartcityindore.org/solid-waste/'),
      },
    ],
    question: {
      prompt: 'Indore 案例描述的是哪一種收運服務？',
      options: [
        { id: 'door-to-door', label: '家戶到戶收運，車隊以 GPS 追蹤路線後送往轉運站。' },
        { id: 'pedestrian-bin', label: '公用行人桶以 GPS 回報桶內滿度並自動壓縮。' },
      ],
      answerId: 'door-to-door',
      explanation: '官方歷史說明談家戶到戶收運與車輛路線；GPS 追蹤車輛不是桶內滿度感測。',
      source: source('Smart City Indore 固體廢棄物改革紀錄', 'https://www.smartcityindore.org/solid-waste/'),
    },
    evidence: [
      {
        kind: 'photo',
        text: '照片呈現 Indore 居民把小桶交給收運車；圖說日期為 2016-12-16，不是行人桶型照片。',
        source: source('Indore 到戶收運照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Door-to-door_Garbage_Collection_Vans_in_Indore_-_Under_Swachh_Bharat_Abhiyan.jpg'),
      },
      {
        kind: 'illustration',
        text: '模型車斗傾斜是示意，沒有模擬人員、家戶分流、真實車輛或 GPS。',
        source: null,
      },
      {
        kind: 'document',
        text: '官方紀錄描述家戶到戶服務先在兩區試行，再擴大到全市；車隊以 GPS 追蹤路線並送往轉運站。',
        source: source('Smart City Indore 固體廢棄物改革紀錄', 'https://www.smartcityindore.org/solid-waste/'),
      },
      {
        kind: 'unknown',
        text: '行政改革紀錄沒有提供行人桶的單價或家戶收運完整成本，也不能證明撤除街桶有效。',
        source: source('Smart City Indore 固體廢棄物改革紀錄', 'https://www.smartcityindore.org/solid-waste/'),
      },
    ],
    partNotes: {
      'collection-bed': {
        observation: '模型後方有一個可抬起的黃色收集斗。',
        inference: '傾斗動畫不是實際裝卸流程或車輛容量的量測。',
      },
      'truck-wheels': {
        observation: '模型車身下有四個可轉動的輪組。',
        inference: '輪子轉一圈是裝飾性互動，不表示車速、路線或 GPS 能力。',
      },
    },
  },
  australia: {
    intro: '墨爾本 Bullens Lane 有共享壓縮站試點資料，但沒有可在本站重新散布的實物照片。本頁只以通用分格站概念圖解服務，不仿製市府設備。',
    takeaway: '試點關注的是巷道共享站的使用、故障和阻塞情境。概念模型不能代表實際硬體，影像分析也不等於每個行人桶都有滿度感測。',
    stops: [
      {
        title: '把圖當成概念示意',
        text: '這座多格站是本站通用概念圖，沒有重製或對照墨爾本實物照片，不能據此外推真實設備外形。',
        view: 'overview',
        partId: null,
        kind: 'illustration',
        source: source('墨爾本 Bullens Lane 試點背景頁（未於本站重製照片）', 'https://participate.melbourne.vic.gov.au/emerging-tech-testbed/bullens-lane'),
      },
      {
        title: '試看中央入口',
        text: '中央入口開合只是互動示意；模型沒有證明 Bullens Lane 實際站體有三格或相同入口。',
        view: 'front',
        partId: 'center-bay',
        kind: 'illustration',
        source: null,
      },
      {
        title: '核對巷道試點任務',
        text: '市府試點資料說明以 CCTV 與影像分析觀察共享壓縮站使用和車輛阻塞等問題。',
        view: 'side',
        partId: null,
        kind: 'document',
        source: source('Bullens Lane Emerging Tech Testbed 試點說明 · 2021', 'https://participate.melbourne.vic.gov.au/emerging-tech-testbed/bullens-lane'),
      },
    ],
    question: {
      prompt: 'Bullens Lane 試點的影像監測主要用來觀察什麼？',
      options: [
        { id: 'shared-alley-station', label: '巷道共享壓縮站的使用、故障和車輛阻塞情況。' },
        { id: 'every-bin-fullness', label: '每一個普通行人桶的滿度與即時清空需求。' },
      ],
      answerId: 'shared-alley-station',
      explanation: '市府頁面描述的是巷道共享站和試點監測情境；不能推成每座行人桶都有滿度感測。',
      source: source('Bullens Lane Emerging Tech Testbed 試點說明 · 2021', 'https://participate.melbourne.vic.gov.au/emerging-tech-testbed/bullens-lane'),
    },
    evidence: [
      {
        kind: 'illustration',
        text: '本站沒有可再分發的實物照片；畫面是通用多格接收站概念，不對應墨爾本設備型號。',
        source: null,
      },
      {
        kind: 'illustration',
        text: '入口開合是互動示意，不代表 Bullens Lane 實際站體的格數、尺寸或機械結構。',
        source: null,
      },
      {
        kind: 'document',
        text: '市府試點頁描述影像分析用於觀察共享壓縮站使用與巷道阻塞；這是站點監測，不是所有街桶的滿度回報。',
        source: source('Bullens Lane Emerging Tech Testbed 試點說明 · 2021', 'https://participate.melbourne.vic.gov.au/emerging-tech-testbed/bullens-lane'),
      },
      {
        kind: 'unknown',
        text: '公開案例沒有提供可對應本概念圖的設備照片，也沒有可比較的清潔或工時因果評估。',
        source: null,
      },
    ],
    partNotes: {
      'left-bay': {
        observation: '概念模型左側有一個獨立入口格。',
        inference: '動畫只翻動本站示意入口；不能推定墨爾本設備有此格或相同尺寸。',
      },
      'center-bay': {
        observation: '概念模型中央入口位於三個接收格之間。',
        inference: '開合動作不代表實際站體結構、開啟方式或接收規則。',
      },
      'right-bay': {
        observation: '概念模型右側另有一個入口格。',
        inference: '這是通用概念配置，不是 Bullens Lane 現場設備的記錄。',
      },
    },
  },
  'south-africa': {
    intro: '開普敦 Waterfront 照片呈現木條外殼的三格分類站。市府另一份公告談 Ikwezi Park 新設公共垃圾桶；兩個地點與設備證據不能混成同一案例。',
    takeaway: '用照片判讀 Waterfront 外觀，用市府公告核對 Ikwezi Park 的設置資訊；外觀相似不代表型號、服務或成效相同。',
    stops: [
      {
        title: '看 Waterfront 三格外觀',
        text: '照片可見木條外殼、金屬框架與屋架；它不是 Site C Plaza 或 Ikwezi Park 現場照。',
        view: 'front',
        partId: null,
        kind: 'photo',
        source: source('Waterfront 分類站照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Sorted_waste_containers_at_Victoria_%26_Alfred_Waterfront,_Cape_Town.jpg'),
      },
      {
        title: '試看中央開放槽',
        text: '互動示意物件經中央開放槽落下；本站動畫不證明實際投放物、隔間容量或木板後方結構。',
        view: 'side',
        partId: 'center-bay-deposit',
        kind: 'illustration',
        source: null,
      },
      {
        title: '讀另一處設桶公告',
        text: '開普敦市府公告記錄 Ikwezi Park 新設公共垃圾桶，是另一個地點的行政資訊，不是照片中 Waterfront 設備的規格。',
        view: 'back',
        partId: null,
        kind: 'document',
        source: source('開普敦市府 Ikwezi Park 公共桶公告 · 2022', 'https://www.capetown.gov.za/media-and-news/ikwezi-park-to-shine-with-new-public-litter-bins/'),
      },
    ],
    question: {
      prompt: 'Waterfront 照片與 Ikwezi Park 公告應如何對照？',
      options: [
        { id: 'separate-sites', label: '照片記錄 Waterfront 分類站；公告談另一處 Ikwezi Park 設桶。' },
        { id: 'same-site', label: '公告確認照片中的 Waterfront 分類站就是 Ikwezi Park 新設備。' },
      ],
      answerId: 'separate-sites',
      explanation: '照片與公告標示不同地點；不能以兩者都在開普敦為由推定設備相同。',
      source: source('Waterfront 分類站照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Sorted_waste_containers_at_Victoria_%26_Alfred_Waterfront,_Cape_Town.jpg'),
    },
    evidence: [
      {
        kind: 'photo',
        text: 'Wikimedia 圖說將三格木條站定位於 Cape Town Waterfront，不是 Site C 或 Ikwezi Park。',
        source: source('Waterfront 分類站照片來源 · Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Sorted_waste_containers_at_Victoria_%26_Alfred_Waterfront,_Cape_Town.jpg'),
      },
      {
        kind: 'illustration',
        text: '模型把入口和屋架做成可見形體；開放槽投入動畫只是示意，不代表現場投放規則。',
        source: null,
      },
      {
        kind: 'document',
        text: '市府公告提供 Ikwezi Park 的另一個公共桶設置案例；不能用它替 Waterfront 照片補上尺寸或維護資料。',
        source: source('開普敦市府 Ikwezi Park 公共桶公告 · 2022', 'https://www.capetown.gov.za/media-and-news/ikwezi-park-to-shine-with-new-public-litter-bins/'),
      },
      {
        kind: 'unknown',
        text: '現有來源沒有提供 Waterfront 這組設備的逐桶價格、完整維護成本或後續清潔成效。',
        source: null,
      },
    ],
    partNotes: {
      'left-bay-deposit': {
        observation: '模型左側有一個木條外殼隔間與上方開放槽。',
        inference: '動畫物件落下不代表現場左格的內部形狀、容量或收受規則。',
      },
      'center-bay-deposit': {
        observation: '模型中央隔間上方有一個深色開放槽。',
        inference: '投入路徑是模型示意，不能推定真實隔間尺寸或清運方式。',
      },
      'right-bay-deposit': {
        observation: '模型右側也有獨立隔間與開放槽。',
        inference: '本站拆分三格以供互動，不代表現場設備的門片、內桶或固定方式。',
      },
    },
  },
});

export const TAIPEI_SCENARIOS = deepFreeze([
  {
    id: 'empty-drink-cup',
    title: '喝完的飲料杯，離店後可以交給誰？',
    question: '手上有一個已喝完的飲料杯，可以把它交回哪些連鎖通路回收？',
    answer: '可交給連鎖飲料店、便利商店、速食店或超級市場，不限品牌。這是台北公告的回收服務；相關國家案例只供比較設備與服務情境，不代表外地規則適用於台北。',
    source: source('臺北市環保局空杯回收說明 · 更新 2026-09-03', 'https://www.dep.gov.taipei/News_Content.aspx?n=D6521D207DE817C2&s=83534F468DAF3FF0&sms=53780C1906F94AB4'),
    updatedAt: '2026-09-03',
    relatedIds: ['japan', 'singapore'],
  },
  {
    id: 'paper-container-shape',
    title: '紙容器和報紙，分類怎麼分？',
    question: '紙餐盒、牛奶盒與鋁箔包，和報紙、雜誌屬於同一類嗎？',
    answer: '不是。紙餐盒、牛奶盒與鋁箔包屬立體類；報紙、雜誌屬平面類。這是台北公告的分類資訊；相關國家案例只供比較設備與服務情境，不代表外地分類規則適用於台北。',
    source: source('臺北市環保局資源回收分類說明 · 更新 2026-09-24', 'https://www.dep.gov.taipei/News_Content.aspx?n=ACEFA960B5A4ACD7&s=252B16B10D3CA3F9'),
    updatedAt: '2026-09-24',
    relatedIds: ['japan', 'singapore'],
  },
]);
