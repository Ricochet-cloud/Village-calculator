
const KEY = 'auction-bid-planner-v1';

const defaults = () => ({
  id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
  name: '새 매물',
  kind: '아파트',
  caseNo: '',
  address: '',
  saleDate: '',
  area: '',
  appraisal: 0,
  market: 0,
  acqTax: 0,
  legalFee: 500000,
  interior: 15000000,
  clean: 500000,
  evict: 0,
  tax: 0,
  other: 0,
  bid: 0,
  sale: 0,
  rate70: 70,
  rate80: 80,
  notes: {
    interior: '변동',
    clean: '변동',
    tax: '세액 직접 입력',
    other: ''
  },
  memo: ''
});

let properties = [];
let activeId = null;

try {
  properties = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (!Array.isArray(properties)) properties = [];
} catch (e) {
  properties = [];
}


if (!properties.length) properties = [defaults()];

// 기존 저장 데이터와 새 계산 항목 호환
properties.forEach(p => {
  const d = defaults();

  Object.keys(d).forEach(k => {
    if (p[k] === undefined) p[k] = d[k];
  });

  if (!p.notes) p.notes = {};

  if (p.acqTax === undefined) p.acqTax = 0;
  if (p.legalFee === undefined) p.legalFee = 500000;
});

activeId = properties[0]?.id || null;


const won = n =>
  new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0
  }).format(Number(n) || 0);

const num = v => Math.max(0, Number(v) || 0);

// 평수 입력은 "24", "24평" 모두 허용
function areaNumber(p) {
  const match = String(p.area ?? '').replace(/,/g, '').match(/[\d.]+/);
  return match ? Math.max(0, Number(match[0]) || 0) : 0;
}

// 자동 계산 항목
function recalculate(p) {
  p.acqTax = Math.round(num(p.bid) * 0.013);
  p.evict = Math.round(areaNumber(p) * 100000);
}

function sum(p) {
  return (
    num(p.acqTax) +
    num(p.legalFee) +
    num(p.interior) +
    num(p.clean) +
    num(p.evict) +
    num(p.tax) +
    num(p.other)
  );
}

function total(p) {
  return num(p.bid) + sum(p);
}

function profit(p) {
  return num(p.sale) - total(p);
}

function cash(p, rate = 70) {
  return Math.max(0, total(p) - num(p.bid) * rate / 100);
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(properties));
  render();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function field(p, key, label, type = 'number', placeholder = '0') {
  return `
    <label>${label}
      <input
        data-id="${p.id}"
        data-key="${key}"
        type="${type}"
        value="${esc(p[key] ?? '')}"
        ${type === 'number' ? 'min="0" step="any"' : ''}
        placeholder="${placeholder}">
    </label>`;
}

function row(p, key, label, note = '') {
  return `
    <tr>
      <td>${label}</td>
      <td>
        <input
          aria-label="${label}"
          data-id="${p.id}"
          data-key="${key}"
          type="number"
          min="0"
          step="any"
          value="${esc(p[key] ?? 0)}">
      </td>
      <td class="note">
        <input
          aria-label="${label} 비고"
          data-id="${p.id}"
          data-note="${key}"
          value="${esc(p.notes?.[key] || note)}">
      </td>
    </tr>`;
}


function autoRow(p, key, label, note) {
  const rowClass = (key === 'acqTax' || key === 'evict')
    ? ''
    : 'shade';

  return `
    <tr class="${rowClass}">
      <td>${label}</td>
      <td>
        <input
          aria-label="${label}"
          data-auto="${key}"
          data-id="${p.id}"
          type="number"
          value="${esc(p[key] || 0)}"
          readonly>
      </td>
      <td class="note">${note}</td>
    </tr>`;
}

function render() {
  const filter = document.querySelector('#filter').value;
  const list = properties.filter(
    p => filter === '전체' || p.kind === filter
  );

  if (!list.some(p => p.id === activeId)) {
    activeId = list[0]?.id || null;
  }

  document.querySelector('#count').textContent =
    properties.length + '개';

  document.querySelector('#profitSum').textContent =
    won(properties.reduce((s, p) => s + profit(p), 0));

  document.querySelector('#cashSum').textContent =
    won(properties.reduce((s, p) => s + cash(p, 70), 0));

  const tabs = document.querySelector('#tabs');

  tabs.innerHTML = list.map((p, i) => `
    <button
      class="tab ${p.id === activeId ? 'active' : ''}"
      role="tab"
      aria-selected="${p.id === activeId}"
      data-tab="${p.id}"
      title="${esc(p.name || '매물 ' + (i + 1))}">
      ${esc(p.name || '매물 ' + (i + 1))}
      <span class="tab-profit">
        ${profit(p) >= 0 ? '+' : ''}${won(profit(p))}
      </span>
    </button>
  `).join('');

  const root = document.querySelector('#properties');

  if (!list.length) {
    root.innerHTML =
      '<div class="tabs-empty">등록된 매물이 없습니다. 매물을 추가해 주세요.</div>';
    return;
  }

  const p = list.find(x => x.id === activeId) || list[0];

  root.innerHTML = `
    <article class="property" data-card="${p.id}">
      <div class="prophead">
        <span class="id">매물</span>
        <input aria-label="매물 이름"
          data-id="${p.id}" data-key="name"
          value="${esc(p.name)}">

        <select aria-label="매물 종류"
          data-id="${p.id}" data-key="kind">
          ${['아파트', '빌라', '기타'].map(k =>
            `<option ${p.kind === k ? 'selected' : ''}>${k}</option>`
          ).join('')}
        </select>

        <button class="danger" data-delete="${p.id}">삭제</button>
      </div>

      <div class="propbody">
        <div class="section-title">기본정보</div>

        <div class="meta">
          ${field(p, 'caseNo', '사건번호', 'text', '예: 2026타경12345')}
          ${field(p, 'address', '주소', 'text', '소재지')}
          ${field(p, 'saleDate', '매각기일', 'date', '')}
          ${field(p, 'area', '평수', 'number', '예: 24')}
        </div>

        <div class="section-title">입찰가 선정 및 비용</div>

        <table>
          <thead>
            <tr>
              <th>분류</th>
              <th>금액 (원)</th>
              <th>비고</th>
            </tr>
          </thead>

          <tbody>
            <tr class="shade">
              <td>감정가</td>
              <td>
                <input data-id="${p.id}" data-key="appraisal"
                  type="number" min="0" value="${esc(p.appraisal || 0)}">
              </td>
              <td></td>
            </tr>

            <tr class="shade">
              <td>실거래가 / 시세</td>
              <td>
                <input data-id="${p.id}" data-key="market"
                  type="number" min="0" value="${esc(p.market || 0)}">
              </td>
              <td></td>
            </tr>

            ${autoRow(p, 'acqTax', '취득·등록비', '입찰가의 1.3% 자동계산')}
            ${row(p, 'legalFee', '법무비', '기본 500,000원')}

            ${row(p, 'interior', '인테리어 비용', '변동')}
            ${row(p, 'clean', '입주청소', '변동')}

            ${autoRow(p, 'evict', '명도비', '평수 × 100,000원')}

            ${row(p, 'tax', '양도세', '직접 입력')}
            ${row(p, 'other', '기타비용', '')}

            <tr class="shade">
              <td>총비용 (입찰가 제외)</td>
              <td class="money" data-out="cost">${won(sum(p))}</td>
              <td></td>
            </tr>

            <tr class="pink">
              <td>입찰가</td>
              <td>
                <input data-id="${p.id}" data-key="bid"
                  type="number" min="0" value="${esc(p.bid || 0)}">
              </td>
              <td></td>
            </tr>

            <tr class="pink">
              <td>입찰가 + 총비용</td>
              <td class="money" data-out="total">${won(total(p))}</td>
              <td></td>
            </tr>

            <tr class="pink">
              <td>매도 예상가격</td>
              <td>
                <input data-id="${p.id}" data-key="sale"
                  type="number" min="0" value="${esc(p.sale || 0)}">
              </td>
              <td></td>
            </tr>

            <tr class="pink">
              <td>예상수익</td>
              <td class="money ${profit(p) >= 0 ? 'positive' : 'negative'}"
                data-out="profit">${won(profit(p))}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="results">
          <div class="result">
            <small>낙찰가 / 감정가</small>
            <strong data-out="bidRatio">
              ${p.appraisal > 0
                ? (num(p.bid) / num(p.appraisal) * 100).toFixed(1) + '%'
                : '—'}
            </strong>
          </div>

          <div class="result">
            <small>총투입비용 대비 수익률</small>
            <strong data-out="profitRatio"
              class="${profit(p) >= 0 ? 'positive' : 'negative'}">
              ${total(p) > 0
                ? (profit(p) / total(p) * 100).toFixed(1) + '%'
                : '—'}
            </strong>
          </div>

          <div class="result">
            <small>입력 시세 대비 차이</small>
            <strong data-out="marketDiff">
              ${num(p.market) > 0 ? won(num(p.market) - num(p.sale)) : '—'}
            </strong>
          </div>

          <div class="result">
            <small>필요 현금 (대출 70%)</small>
            <strong data-out="cash">${won(cash(p, 70))}</strong>
          </div>
        </div>

        <div class="loan">
          <div class="section-title">경락대출 및 필요현금</div>

          <div class="loan-grid">
            ${field(p, 'rate70', '경락대출 비율 70% 계산')}
            ${field(p, 'rate80', '경락대출 비율 80% 계산')}

            <div class="result">
              <small>대출 70% 가정 필요현금</small>
              <strong data-out="cash70">${won(cash(p, 70))}</strong>
            </div>

            <div class="result">
              <small>대출 80% 가정 필요현금</small>
              <strong data-out="cash80">${won(cash(p, 80))}</strong>
            </div>
          </div>

          <div class="footer">
            대출액은 입찰가 × 대출비율로 단순 추정합니다.
            실제 대출한도는 금융기관 심사 등에 따라 달라질 수 있습니다.
          </div>
        </div>

        <div class="notes">
          <label>메모</label>
          <textarea data-id="${p.id}" data-key="memo"
            placeholder="권리분석, 수리 예상, 입찰 메모 등">${esc(p.memo || '')}</textarea>
        </div>
      </div>
    </article>`;
}

function update(id, key, value, noteKey) {
  const p = properties.find(x => x.id === id);
  if (!p) return;

  if (noteKey) {
    p.notes = p.notes || {};
    p.notes[noteKey] = value;
  } else {
    const textKeys = [
      'kind', 'name', 'caseNo', 'address',
      'saleDate', 'area', 'memo'
    ];

    p[key] = textKeys.includes(key) ? value : num(value);
  }

  // 입찰가나 평수가 바뀌면 취득·등록비와 명도비 재계산
  recalculate(p);

  localStorage.setItem(KEY, JSON.stringify(properties));
  refreshCard(id);
}

function refreshCard(id) {
  const p = properties.find(x => x.id === id);
  if (!p) return;

  const card = document.querySelector(`[data-card="${id}"]`);
  if (!card) return;

  // 자동계산 금액을 입력칸에 즉시 반영
  card.querySelectorAll('[data-auto]').forEach(el => {
    const key = el.dataset.auto;
    if (key === 'acqTax' || key === 'evict' || key === 'legalFee') {
      el.value = String(num(p[key]));
    }
  });

  const values = {
    cost: won(sum(p)),
    total: won(total(p)),
    profit: won(profit(p)),
    cash: won(cash(p, 70)),
    cash70: won(cash(p, num(p.rate70))),
    cash80: won(cash(p, num(p.rate80))),
    bidRatio: p.appraisal > 0
      ? (num(p.bid) / num(p.appraisal) * 100).toFixed(1) + '%'
      : '—',
    profitRatio: total(p) > 0
      ? (profit(p) / total(p) * 100).toFixed(1) + '%'
      : '—',
    marketDiff: num(p.market) > 0
      ? won(num(p.market) - num(p.sale))
      : '—'
  };

  Object.entries(values).forEach(([key, value]) => {
    const el = card.querySelector(`[data-out="${key}"]`);
    if (el) el.textContent = value;
  });

  const profitEl = card.querySelector('[data-out="profit"]');
  if (profitEl) {
    profitEl.className =
      'money ' + (profit(p) >= 0 ? 'positive' : 'negative');
  }

  const ratioEl = card.querySelector('[data-out="profitRatio"]');
  if (ratioEl) {
    ratioEl.className = profit(p) >= 0 ? 'positive' : 'negative';
  }

  const tabs = document.querySelector('#tabs');
  const tab = tabs.querySelector(`[data-tab="${id}"]`);
  if (tab) {
    const profitLabel = tab.querySelector('.tab-profit');
    if (profitLabel) {
      profitLabel.textContent =
        (profit(p) >= 0 ? '+' : '') + won(profit(p));
    }
  }

  document.querySelector('#count').textContent = properties.length + '개';
  document.querySelector('#profitSum').textContent =
    won(properties.reduce((s, x) => s + profit(x), 0));
  document.querySelector('#cashSum').textContent =
    won(properties.reduce((s, x) => s + cash(x, 70), 0));
}

document.querySelector('#tabs').addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (!tab) return;
  activeId = tab.dataset.tab;
  render();
});

document.querySelector('#properties').addEventListener('input', e => {
  const el = e.target;
  if (!el.dataset.id || !el.dataset.key) return;
  update(el.dataset.id, el.dataset.key, el.value, el.dataset.note);
});

document.querySelector('#properties').addEventListener('change', e => {
  const el = e.target;
  if (!el.dataset.id || !el.dataset.key) return;

  update(el.dataset.id, el.dataset.key, el.value, el.dataset.note);

  if (el.dataset.key === 'kind') render();
});

document.querySelector('#properties').addEventListener('click', e => {
  const id = e.target.closest('[data-delete]')?.dataset.delete;
  if (!id) return;

  if (confirm('이 매물을 삭제할까요?')) {
    properties = properties.filter(p => p.id !== id);
    if (activeId === id) activeId = properties[0]?.id || null;
    save();
  }
});

document.querySelector('#add').addEventListener('click', () => {
  const p = defaults();
  properties.unshift(p);
  activeId = p.id;
  document.querySelector('#filter').value = '전체';
  save();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.querySelector('#filter').addEventListener('change', render);

document.querySelector('#export').addEventListener('click', () => {
  const cols = [
    '매물명', '종류', '사건번호', '주소', '매각기일', '평수',
    '감정가', '실거래가/시세', '취득등록비', '법무비',
    '인테리어', '입주청소', '명도비', '양도세', '기타비용',
    '입찰가', '매도가', '총비용', '총투입비용', '예상수익',
    '대출70%필요현금'
  ];

  const rows = properties.map(p => [
    p.name, p.kind, p.caseNo, p.address, p.saleDate, p.area,
    p.appraisal, p.market, p.acqTax, p.legalFee,
    p.interior, p.clean, p.evict, p.tax, p.other,
    p.bid, p.sale, sum(p), total(p), profit(p), cash(p, 70)
  ]);

  const csv = '\uFEFF' + [cols, ...rows]
    .map(r => r.map(v =>
      '"' + String(v ?? '').replace(/"/g, '""') + '"'
    ).join(','))
    .join('\r\n');

  download(csv, 'auction-properties.csv', 'text/csv;charset=utf-8');
});

document.querySelector('#backup').addEventListener('click', () => {
  download(
    JSON.stringify(properties, null, 2),
    'auction-backup.json',
    'application/json'
  );
});

document.querySelector('#importBtn').addEventListener('click', () => {
  document.querySelector('#importFile').click();
});

document.querySelector('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw Error();

    if (confirm('현재 매물 목록을 백업 파일 내용으로 바꿀까요?')) {
      properties = data;

      properties.forEach(p => {
        const d = defaults();
        Object.keys(d).forEach(k => {
          if (p[k] === undefined) p[k] = d[k];
        });
        if (!p.notes) p.notes = {};
        recalculate(p);
      });

      activeId = properties[0]?.id || null;
      save();
    }
  } catch (err) {
    alert('올바른 백업 JSON 파일이 아닙니다.');
  }

  e.target.value = '';
});

function download(content, name, type) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([content], { type }));
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

render();
