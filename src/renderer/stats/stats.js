// stats.js — renderer for the stats window.

(() => {
  const $ = (id) => document.getElementById(id);

  function ymd(d) { return d.toISOString().slice(0, 10); }
  function mmdd(d) { return `${d.getMonth() + 1}/${d.getDate()}`; }

  function formatMinutes(sec) {
    const m = Math.round(sec / 60);
    if (m < 60) return `${m} 分`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h} 小時 ${mm} 分`;
  }

  function last14Days() {
    const out = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(d);
    }
    return out;
  }

  async function render() {
    const stats = await window.eyerest.getStats();
    const days = last14Days();
    const todayKey = ymd(new Date());

    let total = 0;
    let totalRest = 0;
    const maxCycles = Math.max(1, ...days.map((d) => (stats[ymd(d)]?.cycles || 0)));

    // summary
    Object.values(stats).forEach((v) => {
      total += v.cycles || 0;
      totalRest += v.totalRestSec || 0;
    });
    $('totalCycles').textContent = String(total);
    $('totalRest').textContent = formatMinutes(totalRest);
    $('todayCycles').textContent = String(stats[todayKey]?.cycles || 0);

    // streak — count consecutive days ending today with at least 1 cycle
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i -= 1) {
      if ((stats[ymd(days[i])]?.cycles || 0) > 0) streak += 1;
      else break;
    }
    $('streak').textContent = String(streak);

    // chart
    const chart = $('chart');
    chart.innerHTML = '';
    days.forEach((d) => {
      const c = stats[ymd(d)]?.cycles || 0;
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = `${(c / maxCycles) * 100}%`;
      const lbl = document.createElement('div');
      lbl.className = 'bar-label';
      lbl.textContent = mmdd(d);
      bar.appendChild(lbl);
      if (c > 0) {
        const val = document.createElement('div');
        val.className = 'bar-value';
        val.textContent = String(c);
        bar.appendChild(val);
      }
      chart.appendChild(bar);
    });

    // log
    const tbody = $('log').querySelector('tbody');
    tbody.innerHTML = '';
    const keys = Object.keys(stats).sort().reverse();
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="color: var(--text-soft); padding: 16px 6px;">尚無紀錄 — 完成第一次休息後會開始統計</td>';
      tbody.appendChild(tr);
    } else {
      keys.forEach((k) => {
        const row = stats[k];
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${k}</td><td>${row.cycles}</td><td>${formatMinutes(row.totalRestSec)}</td>`;
        tbody.appendChild(tr);
      });
    }
  }

  $('resetBtn').addEventListener('click', async () => {
    if (!confirm('確定要清空所有統計資料嗎？此操作無法復原。')) return;
    await window.eyerest.resetStats();
    render();
  });

  window.eyerest.onBreakEnd(() => render());
  render();
})();
