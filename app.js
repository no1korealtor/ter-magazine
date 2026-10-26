/**
 * 공인중개사 소식지 터 (Reader Viewer App)
 * - 개업공인중개사용 순수 뷰어 (관리자 버튼/기능 없음)
 * - PC 발행 스튜디오에서 배포된 기사를 실시간 동기화
 */

const STORAGE_KEY_ARTICLES = 'TER_MAGAZINE_ARTICLES_V1';
const STORAGE_KEY_BOOKMARKS = 'TER_MAGAZINE_BOOKMARKS_V1';

// Supabase 원격 클라우드 실시간 피드 설정
const SUPABASE_URL = 'https://clzrbyplzjdrrscctcsl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SqGXeBJseIB_4hjHB6GZ8g_rF_tv11k';

const state = {
  articles: [],
  bookmarks: [],
  currentCategory: 'ALL',
  searchQuery: '',
  currentArticleId: null,
  fontScale: 1
};

document.addEventListener('DOMContentLoaded', async () => {
  loadData();
  bindEvents();
  renderAll();

  // 앱 실행 시 Supabase 클라우드에서 최신 기사 실시간 동기화
  await fetchRemoteArticles();

  // PC 스튜디오와 같은 기기/브라우저 테스트 시 실시간 동기화
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_ARTICLES) {
      loadData();
      renderAll();
      showToast('📰 새 판례 기사가 업데이트되었습니다!');
    }
  });
});

async function fetchRemoteArticles() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=data&order=created_at.desc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        state.articles = rows.map(r => r.data);
        localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(state.articles));
        renderAll();
        console.log(`Supabase에서 ${state.articles.length}건 기사 동기화 완료!`);
      }
    }
  } catch (err) {
    console.log('원격 피드 오프라인 유지:', err.message);
  }
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ARTICLES);
    if (saved) {
      state.articles = JSON.parse(saved);
    } else {
      state.articles = [...INITIAL_ARTICLES];
      localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(state.articles));
    }
    const bms = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
    if (bms) state.bookmarks = JSON.parse(bms);
  } catch (err) {
    console.error(err);
    state.articles = [...INITIAL_ARTICLES];
  }
}

function saveBookmarks() {
  localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(state.bookmarks));
}

function renderAll() {
  renderHomeAutoToc();
  renderFeaturedAndFeed();
}

function getFilteredArticles() {
  return state.articles.filter((art) => {
    if (state.currentCategory === 'BOOKMARK') {
      if (!state.bookmarks.includes(art.id)) return false;
    } else if (state.currentCategory !== 'ALL' && state.currentCategory !== 'INDEX') {
      if (art.category !== state.currentCategory) return false;
    }

    if (state.searchQuery.trim() !== '') {
      const q = state.searchQuery.trim().toLowerCase();
      const target = [
        art.title,
        art.subtitle,
        art.caseNumber,
        art.category,
        (art.summaryBullets || []).join(' '),
        art.contentMarkdown,
        art.specialClause
      ].join(' ').toLowerCase();
      return target.includes(q);
    }
    return true;
  });
}

function renderHomeAutoToc() {
  const listEl = document.getElementById('homeAutoTocList');
  const countPill = document.getElementById('totalArticleCount');
  const filtered = getFilteredArticles();

  countPill.textContent = `${filtered.length}건 수록`;

  if (filtered.length === 0) {
    listEl.innerHTML = `<li style="padding:10px; color:#7E868F; font-size:0.86rem;">해당 조건의 기사가 없습니다.</li>`;
    return;
  }

  listEl.innerHTML = filtered.map((art, idx) => {
    const num = String(idx + 1).padStart(2, '0');
    return `
      <li class="auto-toc-entry" data-id="${art.id}">
        <div class="toc-entry-top">
          <span class="toc-entry-num">${num}</span>
          <div class="toc-entry-content-col">
            <div class="toc-entry-badge-row">
              <span class="toc-entry-cat">${escapeHtml(art.category)}</span>
              ${art.caseNumber ? `<span class="toc-entry-casenum">${escapeHtml(art.caseNumber)}</span>` : ''}
            </div>
            <div class="toc-entry-text">${escapeHtml(art.title)}</div>
            ${art.subtitle ? `<div class="toc-entry-subtext">${escapeHtml(art.subtitle)}</div>` : ''}
          </div>
        </div>
        <div class="toc-entry-bottom-bar">
          <span>기사 읽기</span>
          <span class="arrow-sym">→</span>
        </div>
      </li>
    `;
  }).join('');

  listEl.querySelectorAll('.auto-toc-entry').forEach((item) => {
    item.addEventListener('click', () => openArticle(item.dataset.id));
  });
}

function renderFeaturedAndFeed() {
  const featContainer = document.getElementById('featuredArticleContainer');
  const feedEl = document.getElementById('articleFeed');
  const filtered = getFilteredArticles();

  const featured = (state.currentCategory === 'ALL' && !state.searchQuery)
    ? (filtered.find(a => a.isFeatured) || filtered[0])
    : null;

  if (featured) {
    featContainer.innerHTML = `
      <div class="featured-magazine-card" data-id="${featured.id}">
        <div class="featured-badge">🌟 이번 호 대표 커버스토리 · ${escapeHtml(featured.category)}</div>
        <h2 class="featured-headline">${escapeHtml(featured.title)}</h2>
        <p class="featured-lead">${escapeHtml(featured.subtitle || '')}</p>
        <div class="featured-bottom">
          <span>📌 ${escapeHtml(featured.caseNumber || '실무 판례 브리핑')}</span>
          <span class="featured-cta">전문 및 실무 특약 읽기 →</span>
        </div>
      </div>
    `;
    featContainer.querySelector('.featured-magazine-card').addEventListener('click', () => {
      openArticle(featured.id);
    });
  } else {
    featContainer.innerHTML = '';
  }

  if (filtered.length === 0) {
    feedEl.innerHTML = `
      <div style="background:#FFF; border:1px solid #ECE7DE; border-radius:12px; padding:32px 16px; text-align:center; color:#7E868F;">
        해당 분야의 소식지 기사가 없습니다.
      </div>
    `;
    return;
  }

  feedEl.innerHTML = filtered.map((art) => {
    const isBm = state.bookmarks.includes(art.id);
    const firstB = (art.summaryBullets && art.summaryBullets.length > 0) ? art.summaryBullets[0] : '';
    const headings = extractHeadings(art.contentMarkdown);

    return `
      <article class="article-item-card" data-id="${art.id}">
        <div class="card-meta-line">
          <span class="badge-category">${escapeHtml(art.category)}</span>
          <span class="badge-casenum">${escapeHtml(art.caseNumber || art.publishedAt)}</span>
        </div>
        <h3 class="card-main-title">${escapeHtml(art.title)}</h3>
        ${art.subtitle ? `<p class="card-sub-lead">${escapeHtml(art.subtitle)}</p>` : ''}
        ${firstB ? `<div class="card-summary-bubble">💡 <strong>핵심 요약:</strong> ${escapeHtml(firstB)}</div>` : ''}
        <div class="card-meta-tags-line">
          <span>📑 본문 소제목 ${headings.length}개</span>
          ${isBm ? `<span>· ⭐ 스크랩 보관됨</span>` : ''}
        </div>
        <div class="card-read-action-bar">
          <span>전문 및 실무 추천 특약 읽기</span>
          <span class="action-arrow">→</span>
        </div>
      </article>
    `;
  }).join('');

  feedEl.querySelectorAll('.article-item-card').forEach((card) => {
    card.addEventListener('click', () => openArticle(card.dataset.id));
  });
}

function openArticle(id) {
  const art = state.articles.find(a => a.id === id);
  if (!art) return;

  state.currentArticleId = id;
  switchView('viewArticleDetail');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  updateBookmarkButton();

  const headings = extractHeadings(art.contentMarkdown);
  const bodyHtml = renderMarkdown(art.contentMarkdown);

  const tocHtml = headings.length > 0 ? `
    <nav class="box-in-article-toc">
      <div class="in-article-toc-title">📑 이 기사의 자동 생성 목차 (클릭 시 이동)</div>
      <ul class="in-article-toc-list">
        ${headings.map((h, i) => `
          <li>
            <a href="#sec-${i}" class="in-toc-link" data-target="sec-${i}">
              <span>${escapeHtml(h)}</span>
            </a>
          </li>
        `).join('')}
        ${art.specialClause ? `<li><a href="#sec-clause" class="in-toc-link" data-target="sec-clause"><span>📋 계약서 추천 특약사항 문구</span></a></li>` : ''}
      </ul>
    </nav>
  ` : '';

  const bulletsHtml = (art.summaryBullets && art.summaryBullets.length > 0) ? `
    <div class="box-three-bullets">
      <div class="three-bullets-title">⚡ 바쁜 소장님을 위한 3줄 핵심 요약</div>
      <ul class="three-bullets-list">
        ${art.summaryBullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}
      </ul>
    </div>
  ` : '';

  const clauseHtml = art.specialClause ? `
    <div class="box-special-clause" id="sec-clause">
      <div class="clause-head-row">
        <span class="clause-heading">📋 실무 계약서 추천 특약사항 문구</span>
        <button type="button" class="btn-clause-copy" id="btnCopyClause">복사해서 계약서에 쓰기</button>
      </div>
      <div class="clause-body-text" id="clauseText">${escapeHtml(art.specialClause).replace(/\n/g, '<br/>')}</div>
    </div>
  ` : '';


  const linksHtml = (art.relatedLinks && art.relatedLinks.length > 0) ? `
    <div class="box-related-links">
      <div class="related-links-heading">🔗 관련 법령 및 판례 원문 바로가기 링크</div>
      <div class="link-cards-list">
        ${art.relatedLinks.map(lk => `
          <a href="${escapeHtml(lk.url)}" target="_blank" rel="noopener noreferrer" class="link-out-card">
            <span>🔗 ${escapeHtml(lk.title)}</span>
            <span>열기 ↗</span>
          </a>
        `).join('')}
      </div>
    </div>
  ` : '';

  const detailEl = document.getElementById('articleDetailBody');
  detailEl.innerHTML = `
    <header class="article-head">
      <div class="article-head-badges">
        <span class="badge-category">${escapeHtml(art.category)}</span>
        <span class="badge-casenum">${escapeHtml(art.caseNumber || '')}</span>
      </div>
      <h1 class="article-headline">${escapeHtml(art.title)}</h1>
      ${art.subtitle ? `<p class="article-lead-text">${escapeHtml(art.subtitle)}</p>` : ''}
      <div class="article-source-row">
        <span>공인중개사 소식지 <strong>터</strong> 편집부</span>
        <span>${escapeHtml(art.issueVol || art.publishedAt)}</span>
      </div>
    </header>

    ${bulletsHtml}
    ${tocHtml}

    <div class="article-prose">
      ${bodyHtml}
    </div>

    ${clauseHtml}
    ${linksHtml}
  `;

  // 내부 목차 스크롤
  detailEl.querySelectorAll('.in-toc-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.dataset.target;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      }
    });
  });

  const btnCopy = document.getElementById('btnCopyClause');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(art.specialClause).then(() => {
        showToast('📋 특약 문구가 클립보드에 복사되었습니다!');
      });
    });
  }


}

function extractHeadings(md) {
  if (!md) return [];
  return md.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('## '))
    .map(line => line.replace(/^##\s+/, '').trim());
}

function renderMarkdown(md) {
  if (!md) return '';
  // 줄바꿈 정리: 연속된 공백 및 줄바꿈 정돈
  const normalized = md.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let html = '';
  let secIdx = 0;
  let inList = false;

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }

    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h2 id="sec-${secIdx}">${escapeHtml(line.replace(/^##\s+/, ''))}</h2>`;
      secIdx++;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { html += '<ul style="margin:8px 0 16px 20px; line-height:1.8;">'; inList = true; }
      const txt = escapeHtml(line.replace(/^[-*]\s+/, '')).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html += `<li style="margin-bottom:8px;">${txt}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      // 일반 본문: 줄바꿈과 문단 구분 확실히 처리 (판결문 가., 나., 다. 및 마침표 단위 자동 분리 지원)
      let txt = escapeHtml(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      
      // 판결문 특유의 ' 가. ', ' 나. ', ' 다. ' 또는 ' 1. ', ' 2. ' 패턴이 한 줄에 뭉쳐있을 경우 자동 줄바꿈 분리
      txt = txt.replace(/\s+([가-하]\.|\d+\.)\s+/g, '<br/><br/><strong>$1</strong> ');
      
      html += `<p style="margin-bottom:18px; line-height:1.85; font-size:1.02rem; word-break:keep-all; color:#22252A;">${txt}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function bindEvents() {
  document.getElementById('btnGoHome').addEventListener('click', () => {
    state.currentCategory = 'ALL';
    updateCategoryTabUI();
    switchView('viewHome');
    renderAll();
  });

  document.getElementById('categoryTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    state.currentCategory = btn.dataset.cat;
    updateCategoryTabUI();
    switchView('viewHome');
    renderAll();
  });

  const searchInput = document.getElementById('searchInput');
  const btnClear = document.getElementById('btnClearSearch');
  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    btnClear.classList.toggle('hidden', !state.searchQuery);
    switchView('viewHome');
    renderAll();
  });
  btnClear.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    btnClear.classList.add('hidden');
    renderAll();
  });

  document.getElementById('btnBackToList').addEventListener('click', () => {
    switchView('viewHome');
    renderAll();
  });

  document.getElementById('btnFontSizeToggle').addEventListener('click', () => {
    const scales = [1, 1.12, 1.25];
    const next = (scales.indexOf(state.fontScale) + 1) % scales.length;
    state.fontScale = scales[next];
    document.documentElement.style.setProperty('--font-scale', state.fontScale);
    showToast(`글자 크기: ${Math.round(state.fontScale * 100)}%`);
  });

  document.getElementById('btnBookmarkDetail').addEventListener('click', () => {
    if (!state.currentArticleId) return;
    const idx = state.bookmarks.indexOf(state.currentArticleId);
    if (idx >= 0) {
      state.bookmarks.splice(idx, 1);
      showToast('스크랩이 해제되었습니다.');
    } else {
      state.bookmarks.push(state.currentArticleId);
      showToast('⭐ 기사를 스크랩했습니다.');
    }
    saveBookmarks();
    updateBookmarkButton();
    renderAll();
  });

  document.getElementById('btnToggleTocDrawer').addEventListener('click', () => {
    renderDrawerToc();
    document.getElementById('modalTocDrawer').classList.remove('hidden');
  });
  document.getElementById('btnCloseTocDrawer').addEventListener('click', () => {
    document.getElementById('modalTocDrawer').classList.add('hidden');
  });
}

function updateCategoryTabUI() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cat === state.currentCategory);
  });
}

function updateBookmarkButton() {
  const btn = document.getElementById('btnBookmarkDetail');
  if (!btn || !state.currentArticleId) return;
  const isBm = state.bookmarks.includes(state.currentArticleId);
  btn.textContent = isBm ? '⭐ 스크랩됨' : '☆ 스크랩';
}

function renderDrawerToc() {
  const body = document.getElementById('drawerTocBody');
  const cats = ['상가·권리금', '주택임대차', '중개책임·보수', '계약·실무소식'];

  body.innerHTML = cats.map(cat => {
    const list = state.articles.filter(a => a.category === cat);
    if (list.length === 0) return '';
    return `
      <div style="margin-bottom:16px;">
        <h4 style="color:var(--green-900); border-bottom:2px solid var(--gold-500); padding-bottom:4px; margin-bottom:8px; font-size:0.92rem;">
          📌 ${escapeHtml(cat)} (${list.length}건)
        </h4>
        <ul style="list-style:none; display:flex; flex-direction:column; gap:6px;">
          ${list.map(art => `
            <li class="drawer-item" data-id="${art.id}" style="padding:8px 10px; background:#FAF8F5; border:1px solid #ECE7DE; border-radius:6px; cursor:pointer; font-size:0.86rem; font-weight:600;">
              ${escapeHtml(art.title)}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }).join('');

  body.querySelectorAll('.drawer-item').forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById('modalTocDrawer').classList.add('hidden');
      openArticle(item.dataset.id);
    });
  });
}

function switchView(viewId) {
  ['viewHome', 'viewArticleDetail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== viewId);
  });
}

function showToast(msg) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast-bubble';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 4편의 기본 수록 판례
const INITIAL_ARTICLES = [
  {
    id: 'art-2026-01',
    issueVol: '2026. 10 창간호 (Vol.01)',
    category: '상가·권리금',
    caseNumber: '대법원 2023다289142 판결',
    isFeatured: true,
    publishedAt: '2026-10-21',
    title: '“재건축할 거니 그냥 나가세요” 임대인의 통보, 신규 임차인 안 데려와도 권리금 손해배상 받을 수 있을까?',
    subtitle: '임대인이 정당한 사유 없이 신규 임차인과의 계약 체결을 거절할 뜻을 확정적으로 표시한 경우의 법리',
    summaryBullets: [
      '임대인이 처음부터 “누구를 데려와도 계약 안 해준다”고 못 박았다면, 임차인이 굳이 신규 임차인을 주선하지 않아도 권리금 회수기회 방해가 성립합니다.',
      '노후 건물 철거·재건축을 이유로 권리금 보호를 거절하려면 계약 체결 당시 구체적인 공사시기와 소요기간을 미리 고지했거나 안전사고 우려가 입증되어야 합니다.',
      '개업공인중개사는 상가 만기 전 임대인이 거절 의사를 밝힐 때 임차인에게 내용증명·문자 등 거절 증거 확보 방법을 안내해야 분쟁을 예방합니다.'
    ],
    contentMarkdown: `## 1. 사건의 발단: “내가 직접 쓸 거니 권리금 받을 생각 마세요”
상가 임차인 A씨는 5년간 카페를 성실히 운영하며 단골을 모았습니다. 임대차 기간 만료 4개월 전, A씨는 권리금을 받고 점포를 넘기기 위해 개업공인중개사 사무소에 매물을 내놓았습니다.

그런데 이 사실을 알게 된 건물주(임대인) B씨는 “건물이 낡아서 리모델링 후 내가 직접 쓰거나 비워둘 생각이니, 새로운 세입자를 구해도 나는 절대 계약해 주지 않겠다”고 단호하게 통보했습니다. 결국 A씨는 신규 임차인을 구하는 것을 포기하고 점포를 비워준 뒤 B씨를 상대로 권리금 손해배상 청구 소송을 제기했습니다.

## 2. 핵심 쟁점: 신규 임차인을 데려오지도 않았는데 방해인가?
소송에서 임대인 B씨는 “임차인 A씨가 나에게 신규 임차인을 소개해 준 적조차 없으므로, 나는 권리금 회수를 방해한 적이 없다”고 주장했습니다. 과연 계약 거절 의사를 미리 밝힌 것만으로 손해배상 책임이 인정될까요?

## 3. 대법원의 판단: 확정적 거절 의사 표시만으로도 방해 책임 성립!
대법원은 임차인 A씨의 손을 들어주었습니다. 법원의 핵심 논리는 다음과 같습니다.
- 임대인이 정당한 사유 없이 **“임차인이 신규 임차인이 되려는 자를 주선하더라도 그와 임대차계약을 체결하지 않겠다”는 의사를 확정적으로 표시**하였다면, 특별한 사정이 없는 한 임차인이 실제로 신규 임차인을 주선하지 않았더라도 권리금 회수기회 보호의무 위반에 따른 손해배상 책임을 집니다.
- 이런 경우에까지 임차인에게 무의미하게 신규 임차인을 찾아와 임대인에게 소개하라고 요구하는 것은 부당하기 때문입니다.

## 4. 개업공인중개사 실무 체크포인트
상가 양도·양수 현장에서 건물주가 막무가내로 “새 세입자 안 받는다”고 나오는 경우가 많습니다. 이때 소장님들께서는 다음 두 가지를 꼭 체크하세요.
1. **임대인의 확정적 거절 증거 남기기**: 임차인이 주선 행위를 생략하고도 손해배상을 청구하려면 임대인의 거절 의사가 ‘확정적’이었음이 입증되어야 합니다(통화 녹취, 문자메시지, 내용증명 등).
2. **초기 임대차계약 시 재건축 고지 여부 확인**: 상가임대차법 제10조 제1항 제7호 가목에 따라 임대차계약 체결 당시 공사시기 및 소요기간 등을 포함한 철거·재건축 계획을 구체적으로 고지한 경우에만 예외적으로 거절이 정당화됩니다.`,
    specialClause: `[상가 권리금 회수기회 보호 및 사전 협의 특약]
임대인과 임차인은 상가건물 임대차보호법 제10조의4에 따른 권리금 회수기회 보호 의무를 상호 확인하며, 임대차기간 만료 6개월 전부터 1개월 전까지 임차인이 주선하는 신규 임차인과의 임대차계약 체결에 성실히 협조하기로 한다. 만일 임대인이 법정 정당사유(사전 고지된 철거·재건축 등) 없이 신규 계약을 거절할 경우 관련 법령에 따른 손해배상 책임이 발생할 수 있음을 중개사로부터 설명 들었음.`,
    rawJudgment: `【사건】 대법원 2023다289142 권리금 손해배상(기)
【판시사항】
상가건물 임대차보호법 제10조의4 제1항 제4호에서 정한 ‘정당한 사유 없이 임대인이 임차인이 주선한 신규 임차인이 되려는 자와 임대차계약을 체결하지 않겠다는 의사를 확정적으로 표시한 경우’에 해당하는지 여부(적극)

【판결요지】
상가건물 임대차보호법 제10조의4의 문언과 내용, 입법 취지에 비추어 보면, 임대인이 정당한 사유 없이 임차인이 신규 임차인이 되려는 자를 주선하더라도 그와 임대차계약을 체결하지 않겠다는 의사를 확정적으로 표시하였다면 특별한 사정이 없는 한 그 자체로 제10조의4 제1항 제4호에서 정한 거절행위에 해당하여 임차인에게 실제로 신규 임차인을 주선하도록 요구할 수 없으므로, 임차인이 신규 임차인을 주선하지 않았더라도 임대인은 임차인에게 권리금 회수방해로 인한 손해배상책임을 진다.`,
    relatedLinks: [
      { title: '국가법령정보센터 - 상가건물 임대차보호법 제10조의4', url: 'https://www.law.go.kr/법령/상가건물임대차보호법' },
      { title: '대법원 종합법률정보 판례 검색', url: 'https://glaw.scourt.go.kr' }
    ]
  },
  {
    id: 'art-2026-02',
    issueVol: '2026. 10 창간호 (Vol.01)',
    category: '중개책임·보수',
    caseNumber: '대법원 2022다255126 판결',
    isFeatured: false,
    publishedAt: '2026-10-20',
    title: '다가구주택 전세 중개 시 ‘선순위 보증금’ 구두 설명만 믿었다가 경매 넘어가면 중개사 책임은 몇 %?',
    subtitle: '집주인이 자료 제공을 거부하거나 축소 고지했을 때 개업공인중개사가 반드시 남겨야 할 면책 방어선',
    summaryBullets: [
      '다가구주택 중개 시 개업공인중개사는 등기부등본뿐만 아니라 기존 세입자들의 보증금 총액·확정일자 현황을 적극적으로 조사·확인할 의무가 있습니다.',
      '임대인이 자료 제출을 거부하거나 구두로만 알려준 경우, 확인·설명서에 “임대인 구두 진술에 의함(자료 제출 거부)”을 구체적으로 기재하지 않으면 중개사 과실이 인정됩니다.',
      '중개사의 확인·설명 소홀 시 법원은 손해액의 20%~40%까지 배상 책임을 인정하므로 특약과 확인설명서 기재가 필수입니다.'
    ],
    contentMarkdown: `## 1. 사건의 발단: 집주인 말만 믿고 적어준 선순위 보증금
다가구주택 원룸 전세계약을 중개한 공인중개사 C소장님. 집주인은 “기존 세입자들 대부분 월세라 선순위 보증금 다 합쳐도 2억 원밖에 안 된다”고 말했고, C소장님은 집주인의 말을 믿고 중개대상물 확인·설명서에 ‘선순위 보증금 총액 약 2억 원’이라고 기재했습니다.

그러나 추후 건물이 경매에 넘어가고 보니 실제 선순위 보증금은 6억 원이 넘었고, 임차인은 보증금을 한 푼도 배당받지 못하게 되자 C소장님과 공제사업자를 상대로 손해배상 소송을 제기했습니다.

## 2. 법원의 판단: “임대인 말만 그대로 적은 것은 선량한 관리자의 주의의무 위반”
법원은 개업공인중개사에게 손해배상 책임을 인정했습니다.
- 다가구주택의 경우 전체 호실의 선순위 보증금 규모가 임차인의 보증금 회수 가능성에 결정적인 영향을 미칩니다.
- 따라서 중개사는 임대인에게 기존 임대차계약서 사본이나 확정일자 부여현황 자료를 요구하여 대조해 보아야 하며, 만약 임대인이 자료 제공을 거부하고 구두로만 고지했다면 “임대인이 자료 제공을 거부하여 구두 고지한 금액이며 실제와 다를 수 있음”을 임차인에게 명확히 설명하고 확인·설명서에 남겨야 합니다.`,
    specialClause: `[다가구주택 선순위 권리관계 확인 및 고지 특약]
1. 임대인은 본 건물 내 선순위 임대차보증금 총액이 금 OOO원임을 고지하며, 고지 내용과 실제 내역에 중대한 차이가 있을 경우 임차인은 잔금 전 본 계약을 해제할 수 있다.
2. 개업공인중개사는 임대인이 제출한 자료를 기준으로 확인·설명하였으며, 잔금 전 전입세대 확인서 및 확정일자 현황 재열람 절차를 안내하였음을 임차인이 확인함.`,
    rawJudgment: `【사건】 대법원 2022다255126 손해배상(기)
【판결요지】
다가구주택의 일부분에 관한 임대차계약을 중개하는 개업공인중개사로서는 임차의뢰인에게 부동산 등기부상에 표시된 권리관계를 확인·설명하는 데 그쳐서는 아니 되고, 임대의뢰인에게 그 다가구주택 내에 이미 거주해서 살고 있는 다른 임차인의 임대차보증금 등에 관한 자료를 요구하여 이를 확인한 다음 임차의뢰인에게 설명하여야 한다.`,
    relatedLinks: [
      { title: '공인중개사법 제25조(중개대상물의 확인·설명)', url: 'https://www.law.go.kr/법령/공인중개사법' }
    ]
  },
  {
    id: 'art-2026-03',
    issueVol: '2026. 10 창간호 (Vol.01)',
    category: '주택임대차',
    caseNumber: '주택임대차보호법 제6조의2 실무해설',
    isFeatured: false,
    publishedAt: '2026-10-18',
    title: '묵시적 갱신 후 세입자가 “3개월 뒤 나갑니다” 통보했을 때, 새 세입자 중개보수는 누가 내야 할까?',
    subtitle: '현장에서 가장 자주 다투는 ‘중도퇴거 중개보수 부담 주체’ 법원 판단과 명쾌한 중재 기준',
    summaryBullets: [
      '묵시적 갱신 후 임차인이 해지 통고를 하면 임대인이 통지를 받은 날부터 3개월이 지나면 임대차계약은 정상 종료됩니다.',
      '따라서 통지 후 3개월이 지난 시점에 퇴거하는 것은 정상 만료이므로 신규 임차인 중개보수는 임대인(집주인)이 부담합니다.',
      '단, 임차인이 3개월이 되기 전에 급히 보증금을 빼서 나가는 합의 해지의 경우에는 임차인이 부담하기로 약정할 수 있습니다.'
    ],
    contentMarkdown: `## 1. 사건의 발단: “네가 중간에 나가는 거니까 복비 내고 나가!”
묵시적 갱신이 된 지 4개월 만에 세입자 D씨는 “사정이 생겨서 3개월 뒤에 이사 가겠습니다”라고 문자로 통보했습니다. 그러자 집주인은 새 세입자 구하는 중개보수(복비)를 세입자가 내고 나가라고 주장했습니다.

## 2. 법원의 판단: 통지 후 3개월 경과 시 ‘정상 만료’와 동일
주택임대차보호법 제6조의2에 따라 해지 통지 후 3개월이 지나면 계약은 적법하게 종료됩니다. 법원 판례 역시 새로운 임차인을 들이기 위한 중개보수는 계약 당사자인 임대인이 부담하는 것이 원칙이라고 봅니다.`,
    specialClause: `[중도 퇴거 및 묵시적 갱신 시 중개보수 부담 기준 특약]
임차인의 사정으로 약정 만료 전 조기 합의 해지하는 경우 신규 중개보수는 현 임차인이 부담한다. 단, 묵시적 갱신 후 법정기간(3개월)이 경과하여 계약이 종료되는 경우의 신규 중개보수는 임대인이 부담한다.`,
    rawJudgment: `주택임대차보호법 제6조의2(묵시적 갱신의 경우 계약의 해지)
① 임차인은 언제든지 임대인에게 계약해지를 통지할 수 있다.
② 제1항에 따른 해지는 임대인이 그 통지를 받은 날부터 3개월이 지나면 그 효력이 발생한다.`,
    relatedLinks: [
      { title: '국가법령정보센터 주택임대차보호법', url: 'https://www.law.go.kr/법령/주택임대차보호법' }
    ]
  },
  {
    id: 'art-2026-04',
    issueVol: '2026. 10 창간호 (Vol.01)',
    category: '계약·실무소식',
    caseNumber: '대법원 2022다247503 판결',
    isFeatured: false,
    publishedAt: '2026-10-15',
    title: '가계약금 300만 원 넣었는데 매수인이 변심했다면? 계약금 전체 기준 배액상환일까, 300만 원만 포기일까?',
    subtitle: '가계약 문자 발송 시 ‘해약금 기준 금액’을 명시하지 않으면 벌어지는 해약금 소송 핵심 정리',
    summaryBullets: [
      '중요 사항에 관한 합의가 이루어진 상태에서 지급된 가계약금은 정식 계약금의 일부로 인정될 수 있습니다.',
      '대법원은 가계약 해약금의 기준이 ‘실제 받은 가계약금(300만 원)’이 아니라 ‘약정 계약금 전체(5,000만 원)’가 될 수 있다고 판시했습니다.',
      '따라서 중개사가 가계약 문자를 보낼 때 “실제 입금된 가계약금만을 해약금 기준으로 한다”는 문구를 꼭 넣어야 분쟁을 막습니다.'
    ],
    contentMarkdown: `## 1. 사건의 발단: 가계약금 300만 원 넣었다가 5,000만 원 물어낼 판?
매매대금 5억 원, 약정 계약금 5,000만 원에 합의한 뒤 가계약금 300만 원을 송금한 매수인. 다음 날 매수인이 계약을 포기하자 매도인은 약정 계약금 5,000만 원 전체를 배상하라고 소송을 걸었습니다.

## 2. 대법원의 판단: 약정 계약금 전체가 기준이 될 수 있다!
대법원은 계약금의 일부만 지급된 상태에서 계약을 해제하려면, 실제 교부받은 금액이 아니라 ‘약정한 계약금 전체’를 기준으로 포기하거나 배액을 상환해야 한다고 판시했습니다.`,
    specialClause: `[가계약금 입금 시 문자 안내 필수 문구]
※ 본 가계약금은 정식 계약서 작성 전 매물 확보를 위한 금원이며, 정식 계약서 작성 전 일방의 변심으로 해약 시 약정 계약금 총액과 무관하게 '실제 입금된 가계약금'만을 해약금 기준으로 하여 포기 또는 배액상환하기로 합의함.`,
    rawJudgment: `【사건】 대법원 2014다231378 및 2022다247503
【판결요지】
계약금 일부만 지급된 경우 수령자가 매매계약을 해제할 수 있다고 하더라도, 그 해약금의 기준이 되는 금원은 ‘실제 교부받은 계약금’이 아니라 ‘약정 계약금’이라고 봄이 타당하다.`,
    relatedLinks: [
      { title: '국가법령정보센터 민법 제565조(해약금)', url: 'https://www.law.go.kr/법령/민법' }
    ]
  }
];
