import {escapeHTML as esc} from './data-utils.js';

const root = 'research/execution-2026-10-15/';
const categories = {same_fields:'兩版欄位相同',same_address_changed:'同址座標不同',only_2026:'只在新版出現',not_reappeared:'未再出現',ambiguous:'同址多筆未配對'};
const $ = id => document.getElementById(id);

function renderCandidates(data) {
  const context = $('research-context').value;
  const district = $('research-district').value;
  const rows = data.candidates.filter(p => (!context || p.context === context) && (!district || p.district === district));
  $('research-count').textContent = `顯示 ${rows.length}／${data.candidates.length} 個桌面候選；正式六條街段尚未選定。`;
  $('research-candidates').innerHTML = rows.length ? rows.map(p => {
    const url = `?${new URLSearchParams({year:'2026-main',district:p.district,q:p.address})}#map`;
    return `<article class="research-candidate"><div class="research-card-top"><span>${esc(p.id)} · ${esc(p.district)}</span><span class="research-tag">${esc(p.context)}</span></div>
      <h4>${esc(p.label)}</h4><p class="research-address">${esc(p.address)}</p><p>${esc(p.reason)}</p>
      <details><summary>來源與現勘條件</summary><p>${esc(categories[p.category])}；${esc(p.status)}。${esc(p.boundary)}。</p><p>${esc(p.next_check)}</p><p>來源：2026-09-30 更新主檔，${esc(p.sourceId)}；CSV 實體起始行 ${p.sourceRow}。原始座標 ${esc(p.longitude)}, ${esc(p.latitude)}。</p></details>
      <a href="${esc(url)}">在保存清冊中查看 ↗</a></article>`;
  }).join('') : '<p class="research-empty">這組篩選沒有候選；不代表該區沒有設施或需求。</p>';
}

export async function initializeResearch() {
  const response = await fetch(`${root}desk-results.json`);
  if (!response.ok) throw Error('Research data unavailable');
  const data = await response.json();
  for (const [id, values] of [
    ['research-context', [...new Set(data.candidates.map(p => p.context))]],
    ['research-district', [...new Set(data.candidates.map(p => p.district))]]]) {
    for (const value of values) {
      const option = document.createElement('option');
      option.value = option.textContent = value;
      $(id).append(option);
    }
    $(id).disabled = false;
    $(id).addEventListener('change', () => renderCandidates(data));
  }
  $('research-reset').disabled = false;
  $('research-reset').addEventListener('click', () => {
    $('research-context').value = $('research-district').value = '';
    renderCandidates(data);
  });
  renderCandidates(data);
  $('research-exclusions').innerHTML = data.exclusions.map(e => `<li><strong>${esc(e.scope)}：</strong>${esc(e.reason)}</li>`).join('');
  $('research-status').hidden = true;
}
