function checkUrlDeepLink() {
  try {
    const params = new URLSearchParams(window.location.search);
    const artId = params.get('article');
    if (artId && state.articles.some(a => a.id === artId)) {
      openArticle(artId);
    }
  } catch (e) {
    console.error(e);
  }
}

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
  checkUrlDeepLink();

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
          <span>기사 전문 읽기</span>
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

    <div class="article-share-box">
      <div class="share-box-desc">💡 이 판례 기사가 유용하셨나요? 나에게 카톡으로 남기거나 동료 소장님께 공유해 보세요!</div>
      <button type="button" class="btn-share-kakao-big" id="btnShareArticleBottom">
        <span>💬 카카오톡으로 기사 요약 & 소식지 링크 공유하기</span>
      </button>
    </div>

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

  const btnShareBottom = document.getElementById('btnShareArticleBottom');
  if (btnShareBottom) {
    btnShareBottom.addEventListener('click', shareCurrentArticle);
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

  const btnShareTop = document.getElementById('btnShareArticleTop');
  if (btnShareTop) {
    btnShareTop.addEventListener('click', shareCurrentArticle);
  }

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
    "id": "art-1792999861072",
    "title": "[과태료] 거래완료 매물 미삭제로 과태료 125만 원? 법원, “국토부 고시 개정 비추어 과태료 부과 취소!” (2026라242 결정/판결)",
    "category": "과태료",
    "issueVol": "2026. 10 창간호 (Vol.01)",
    "subtitle": "한방 플랫폼 거래완료 미연계로 인한 과태료 부과 처분에 대한 이의신청 및 법원의 과태료 취소·불처벌 결정 완벽 분석",
    "caseNumber": "2026라242 결정/판결",
    "isFeatured": false,
    "publishedAt": "2026-10-26",
    "rawJudgment": "서울남부지방법원 제3-1 민사부 결 정\n\n사건: 2026라242 공인중개사법위반 위반자, 항고인: [개인정보 삭제] 제1심\n결정: 서울남부지방법원 2026. 6. 2.자 2025과101435 결정\n\n주 문 1. 제1심 결정을 취소한다. 2. 위반자에게 과태료를 부과하지\n아니한다.\n\n이 유\n\n1.  기초사실\n\n기록에 의하면 아래와 같은 사실이 소명된다.\n\n가. 개업공인중개사인 위반자는 네이버 부동산 사이트에 [이 사건 아파트]를\n중개대상물로 한 광고를 게시 중이었고, 2024. 10. 14. 11:12경\n한국공인중개사협회(이하 ’협회’라 한다)가 운영하는\n한방부동산거래정보망(이하 ’한방 플랫폼’이라 한다)을 통하여 기존\n광고매물(매물번호: 2450564990)을 전송하였다(이하 ’이 사건 광고’라 한다).\n\n나. 위반자는 2024. 10. 14. 이 사건 아파트에 관한 매매계약을 공동중개한\n후 같은 날 21:03경 네이버 부동산 사이트의 MK부동산 채널에 거래완료\n처리를 하였고, 2024. 10. 21. 실거래 신고를 완료하였다. 이 사건 광고는\n2024. 10. 23. 21:07경 한방 플랫폼에서 노출 종료되었다.\n\n다. 협회는 네이버 부동산 사이트와 업무협약(MOU) 후 매물 무료전송 계약을\n체결하여 한방 플랫폼을 통하여 사용자가 선택적으로 매물을 전송할 수\n있도록 하고 있다. 한방 플랫폼을 통하여 네이버로 전송된 매물은 실거래\n신고가 완료된 경우와 매물 의뢰인(집주인)이 거래 완료를 처리한 경우에는\n광고가 자동 삭제(노출종료)되나, 중개사가 공동중개 등의 다른 사유로\n거래완료 처리를 한 경우에는 한방 플랫폼을 통하여 네이버로 전송된 동일\n매물이 자동 삭제되지 않고, 한방 플랫폼 로그인 시 알림 팝업으로만\n사용자에게 전달되어 실시간 확인은 시스템 구조상 어렵다.\n\n라. 서울특별시 영등포구청장은 2025. 4. 10. ’위반자가 2024. 10. 23. 이\n사건 아파트에 관한 계약이 체결된 사실을 알고 있음에도 불구하고 지체 없이\n이 사건 광고를 삭제하지 않았다’는 위반행위(이하 ’이 사건 위반행위’라\n한다)를 이유로 공인중개사법 제18조의2, 제51조 및 질서위반행위규제법\n제17조를 적용하여 위반자에게 과태료 1,250,000원을 부과하는 통지(이하 ’이\n사건 부과 통지’라 한다)를 하였다.\n\n마. 위반자가 2025. 5. 12. 이 사건 부과 통지에 이의제기를 하자\n제1심법원은 2026. 3. 17. 위반자에게 과태료 1,250,000원을 부과하는\n약식결정을 하였다. 위 약식결정에 다시 위반자가 이의신청을 하자\n제1심법원은 2026. 6. 2. 위반자에게 과태료 1,250,000원을 부과하는 제1심\n결정을 하였다.\n\n2.  판단\n\n위반자는 한방 플랫폼상의 이 사건 아파트에 대한 중개대상물 광고를 지연\n삭제한 사실은 인정되나, 네이버 부동산 사이트와 한방 플랫폼의\n거래완료시스템이 실거래 신고가 완료된 경우와 매물 의뢰인(집주인)이 거래\n완료를 처리한 경우에는 연계되어 자동 삭제(노출종료)되지만, 중개사가\n공동중개 등의 다른 사유로 거래완료 처리를 한 경우에는 한방 플랫폼을\n통하여 네이버로 전송된 동일 매물이 자동 삭제되지 않는다는 사실을\n인지하지 못하고 있었던 것으로 보인다.\n\n공인중개사법 제18조의2 제4항 및 제5항, 같은 법 시행령 제17조의2 제4항에\n따른 부당한 중개대상물 표시·광고의 세부적인 유형과 기준을 예시함으로써\n부당한 중개대상물 표시·광고에 대한 법 집행의 객관성과 투명성을 확보하고\n개업공인중개사가 중개대상물에 올바른 표시·광고를 하도록 하여 소비자\n보호에 이바지함을 목적으로 제정된 국토교통부고시 ‘부당한 중개대상물\n표시·광고행위의 유형 및 기준’(이하 ’이 사건 고시’라 한다)은 원래 제5조\n제3항에서 다음과 같이 규정하고 있었다.\n\n“영 제17조의2 제4항 제2호에 따른 중개대상물이 존재하지만 실제로 중개할\n의사가 없는 중개대상물에 대한 부당한 표시·광고의 유형과 기준 등은 다음과\n같다. 2. 개업공인중개사가 중개대상물에 관한 거래계약서를 작성하는 등\n계약이 체결된 사실을 알고 있음에도 불구하고 지체 없이 표시·광고를\n삭제하지 않는 경우”\n\n위와 같은 고시 규정으로 인하여 계약 완료된 중개대상물의 표시·광고를 단순\n실수로 제때 삭제하지 못하는 경우에도 과태료를 부과하게 되는 운영상의\n미비점이 발생하게 되자, 이를 방지하기 위하여 계약 체결된 중개대상물을\n허위·미끼 매물로 활용한 경우에만 과태료가 부과되도록 하는 내용으로 2026.\n7. 3. 이 사건 고시가 개정되었다(국토교통부고시 제2026-345호).\n\n위 개정된 고시 규정에 따르면 제5조 제3항 중 “부당한 표시·광고의 유형과\n기준 등은 다음과 같다.”는 “부당한 표시·광고란 표시·광고한 중개대상물에\n대한 중개요청에 응하지 않고 다른 중개대상물을 권유하는 등 실제로 중개할\n의사가 없는 중개대상물에 대한 표시·광고를 말한다.”로 개정되었고, 제5조\n제3항 제1호 및 제2호가 삭제되는 동시에 제5조 제2항 제4호 및 제5호가\n신설되었다.\n\n신설된 제5조 제2항 제4호는 다음과 같이 규정하고 있다.\n\n“표시·광고한 중개대상물에 관한 계약이 체결된 사실을 알고 있음에도\n표시·광고를 삭제하지 않은 개업공인중개사가 해당 표시·광고 대상물에 관한\n중개 요청을 하는 의뢰인에게 다른 중개대상물을 권유하는 경우. 다만,\n의뢰인의 요청에 따라 대체 중개대상물을 안내하는 것은 제외한다.”\n\n위반자가 이 사건 아파트에 대한 거래가 완료된 후에도 이 사건 광고를 본\n의뢰인을 상대로 다른 중개대상물을 권유하기 위하여 실제로 중개할 의사가\n없이 이 사건 광고를 삭제하지 않은 것으로 보이지는 아니한다.\n\n위반행위의 경위와 내용, 기간, 위반자가 조사 이후 보인 태도 등 제반\n사정을 종합적으로 고려하면, 위반자를 처벌할 필요성을 인정하기 어렵거나\n처벌 필요성에 비하여 불처벌의 필요성이 보다 커 보인다.\n\n3.  결론\n\n그렇다면 이와 결론을 달리한 제1심 결정은 위법하므로 이를 취소하고,\n위반자에게 과태료를 부과하지 아니하기로 하여 주문과 같이 결정한다.\n\n2026. 7.  28. \n\n재판장 판사 손승온 판사 이정형 판사 송승우\n\n[문서 안내] 문서 첫 장 우측 상단의 QR코드로 대한민국법원 앱에서 진위와\n전자서명 여부를 확인할 수 있고, 텍스트 음성 지원을 받을 수 있다. 또한\n전자소송포털 및 각급 법원 민원실에 설치된 사건검색 컴퓨터의\n발급문서(번호) 조회 메뉴에서 문서 좌측 하단의 발급번호를 이용하여\n위·변조 여부를 확인할 수 있다.\n\n※ 업로드된 PDF에서 읽을 수 있는 내용을 텍스트로 옮긴 것입니다.\n개인정보가 삭제된 부분과 OCR 판독 오류가 있을 수 있으므로 원본과 대조해\n확인하시기 바랍니다.",
    "relatedLinks": [
      {
        "url": "https://www.law.go.kr",
        "title": "공인중개사법 및 국토교통부 고시 (부당한 중개대상물 표시·광고)"
      },
      {
        "url": "https://glaw.scourt.go.kr",
        "title": "대법원 종합법률정보 (2026라242 결정/판결)"
      }
    ],
    "specialClause": "[부동산 표시·광고 및 거래완료 매물 정산 확인 특약]\n본 계약이 유효하게 체결됨에 따라 개업공인중개사는 인터넷 포털 및 부동산망에 게시된 광고를 지체 없이 노출 종료 및 거래완료 처리하며 당사자는 이에 동의함.",
    "summaryBullets": [
      "네이버 부동산에는 거래완료 처리했으나 협회 한방망 시스템상 자동 삭제되지 않아 구청으로부터 과태료 125만 원 부과 결정을 받은 사건입니다.",
      "국토교통부 고시(제2026-345호) 개정으로 단순 지연 삭제가 아닌 ‘실제 중개의사 없이 타 매물 유인(미끼매물)’ 목적일 때만 과태료를 부과하도록 기준이 완화되었습니다.",
      "법원은 중개사에게 미끼매물 유인 목적이 없었고 고시 개정의 불처벌 취지를 고려하여 1심 과태료 결정을 취소하고 불처벌(0원) 결정을 내렸습니다."
    ],
    "contentMarkdown": "## 1. 사건의 발단: 한방 플랫폼 연계 오류와 과태료 125만 원 통지\n개업공인중개사는 아파트 매매계약을 체결한 뒤 네이버 부동산에는 거래완료 처리를 하였으나, 협회 한방 부동산거래정보망을 통해 전송된 매물이 시스템 구조상 자동 삭제되지 않고 남아 있었습니다.\n\n관할 구청장은 계약 체결 사실을 알고도 지체 없이 광고를 삭제하지 않았다며 공인중개사법 위반으로 **과태료 125만 원 부과 처분**을 통지하였고, 1심 법원 역시 과태료를 부과하는 약식결정을 내렸습니다.\n\n## 2. 법원의 판단: “단순 지연 삭제는 불처벌, 국토부 고시 개정 취지 반영”\n항고심 법원(서울남부지방법원)은 1심 결정을 뒤집고 **과태료 부과 결정을 전격 취소(불처벌)**하였습니다.\n- **시스템 구조의 한계 참작:** 한방 플랫폼을 통해 네이버로 전송된 매물은 공동중개 처리 시 자동 삭제되지 않는 시스템적 한계가 있어 중개사가 이를 즉시 인지하기 어려웠던 점을 인정했습니다.\n- **국토교통부 고시 개정:** 국토교통부 고시 제2026-345호 개정으로, 계약 완료 매물을 단순 실수로 늦게 삭제한 것은 제외하고 ‘의뢰인에게 다른 중개대상물을 권유하는 등 미끼매물로 악용한 경우’에만 과태료를 부과하도록 기준이 완화된 점을 적극 반영했습니다.\n- **결론:** 미끼매물로 활용할 의사가 없었으므로 처벌 필요성이 없다고 판단하여 **과태료를 부과하지 아니하기로 결정**했습니다.\n\n## 3. 개업공인중개사 실무 팁 & 대응 가이드\n1. **과태료 사전통지 시 즉시 이의신청:** 구청의 과태료 처분에 불복하는 경우 통지를 받은 날부터 60일 이내에 서면으로 이의신청하면 관할 법원에서 정식 과태료 재판을 받을 수 있습니다.\n2. **국토부 고시 개정 규정 적극 원용:** 단순 지연 삭제인 경우 고시 제5조 제2항 제4호 개정 규정을 근거로 ‘다른 매물 유인 목적이 없었음’을 적극 소명하세요."
  },
  {
    "id": "art-discipline-01",
    "title": "[행정처분] 초과보수 수수로 인한 ‘업무정지 3개월 처분’ 취소 소송, 법원의 최종 판단은?",
    "category": "행정처분",
    "issueVol": "2026. 10 창간호 · Vol.01",
    "subtitle": "지자체(구청)의 업무정지 처분에 맞선 개업공인중개사의 재량권 일탈·남용 및 감경 법리 심층 분석",
    "caseNumber": "서울행정법원 2025구단53704 판결",
    "isFeatured": true,
    "publishedAt": "2026-10-23",
    "rawJudgment": "서울행정법원 2025구단53704 업무정지처분취소 판결 요지",
    "relatedLinks": [
      {
        "url": "https://www.law.go.kr",
        "title": "공인중개사법 및 시행규칙 법정 중개보수 요율 조회"
      },
      {
        "url": "https://sladmin.scourt.go.kr",
        "title": "서울행정법원 판례 및 행정소송 서식 안내"
      }
    ],
    "specialClause": "[법정 중개보수 및 정산 확인 특약]\n본 계약에 관한 중개보수는 공인중개사법 시행규칙 제20조에서 정한 법정 요율에 따라 정확히 산정되었음을 거래당사자 쌍방이 확인하고 지급하기로 합의함.",
    "summaryBullets": [
      "구청은 오피스텔 임대차 중개 시 법정 중개보수를 초과 수수했다는 민원에 따라 개업공인중개사에게 업무정지 3개월 처분을 부과하였습니다.",
      "법원은 위반 경위, 고의성 유무, 초과 수수한 금액의 규모 및 자진 반환 조치 등을 종합하여 행정청의 처분이 재량권을 일탈·남용하였는지 엄격히 판단하였습니다.",
      "중개사는 행정처분 사전통지서 수령 즉시 의견제출 절차를 통해 정상참작 사유를 소명하고 2분의 1 감경을 적극 요청해야 구제받을 수 있습니다."
    ],
    "contentMarkdown": "## 1. 행정처분의 발단: 구청의 업무정지 3개월 통보와 중개사의 위기\n개업공인중개사가 오피스텔 등 임대차계약을 중개하는 과정에서 법정 중개보수 한도를 초과하여 수수하였다는 의뢰인의 민원이 접수되었고, 관할 구청장은 공인중개사법 위반을 이유로 **업무정지 3개월 처분**을 내렸습니다.\n\n중개사무소 문을 3개월간 닫아야 하는 업무정지는 개업공인중개사의 생계와 직결되는 치명적인 처분입니다. 이에 불복한 공인중개사는 서울행정법원에 행정소송(업무정지처분 취소청구)을 제기하였습니다.\n\n## 2. 법원의 판단 이유와 판결 요지\n법원은 행정청의 처분이 적법한지, 아니면 재량권을 일탈·남용한 위법한 처분인지를 다음과 같은 핵심 법리에 따라 판단하였습니다:\n\n- **초과보수 산정 기준:** 공인중개사법 시행규칙상 주거용 오피스텔(전용 85㎡ 이하) 임대차 요율(0.4%) 적용 대상인지 여부 및 거래금액 산정(보증금 + 차임×70)이 정확했는지 심리하였습니다.\n- **재량권 일탈·남용 여부:** 설령 위반 사실이 인정되더라도 동종 전과가 없는 점, 위반의 동기와 경위, 초과 수수한 금액의 규모 및 즉시 반환 조치 등을 종합적으로 고려할 때 3개월의 업무정지 처분은 비례의 원칙에 위배되어 지나치게 가혹하므로 취소 또는 감경되어야 함을 판시하였습니다.\n\n## 3. 개업공인중개사 실무 방어 프로토콜\n소장님들께서 지자체의 행정처분 위기에 직면했을 때 반드시 갖추어야 할 3대 방어선입니다.\n\n1. **오피스텔 요율 적용 철저:** 주거용 오피스텔(0.4%)과 일반 업무용 오피스텔(0.9%)의 요율 적용 요건을 확인·설명서 작성 시 반드시 점검하세요.\n2. **청문 절차에서의 적극적 소명:** 구청으로부터 행정처분 사전통지서(청문)를 받았을 때 고의가 없었음과 거래 경위를 명확히 소명하고 감경(2분의 1 범위 감경)을 적극 요청해야 합니다.\n3. **신속한 합의 및 반환 조치:** 의뢰인과의 분쟁 발생 시 지체 없이 법정 초과분을 정산·반환하고 영수증 및 확인서를 확보해 두는 것이 행정소송 및 과태료 방어의 핵심입니다."
  },
  {
    "id": "art-2026-04",
    "title": "가계약금 300만 원 넣었는데 매수인이 변심했다면? 계약금 전체 기준 배액상환일까, 300만 원만 포기일까?",
    "category": "계약·실무소식",
    "issueVol": "2026. 10 창간호 (Vol.01)",
    "subtitle": "가계약 문자 발송 시 ‘해약금 기준 금액’을 명시하지 않으면 벌어지는 해약금 소송 핵심 정리",
    "caseNumber": "대법원 2022다247503 판결",
    "isFeatured": false,
    "publishedAt": "2026-10-15",
    "rawJudgment": "대법원 2022다247503 판결",
    "relatedLinks": [
      {
        "url": "https://www.law.go.kr",
        "title": "민법 제565조"
      }
    ],
    "specialClause": "[가계약금 입금 시 문자 안내 필수 문구]\\n본 가계약금은 매물 확보를 위한 금원이며 정식 계약 전 일방 변심 시 실제 입금된 가계약금액만을 해약금 기준으로 합의함.",
    "summaryBullets": [
      "중요 사항에 관한 합의가 이루어진 상태에서 지급된 가계약금은 정식 계약금의 일부로 인정될 수 있습니다.",
      "대법원은 가계약 해약금의 기준이 ‘실제 받은 가계약금(300만 원)’이 아니라 ‘약정 계약금 전체(5,000만 원)’가 될 수 있다고 판시했습니다.",
      "따라서 중개사가 가계약 문자를 보낼 때 “실제 입금된 가계약금만을 해약금 기준으로 한다”는 문구를 꼭 넣어야 분쟁을 막습니다."
    ],
    "contentMarkdown": "## 1. 사건의 발단\\n가계약금 300만원을 넣고 하루 뒤 변심하여 해약하려 하자 매도인이 약정 계약금 5천만원을 기준으로 손해배상을 청구한 사건입니다.\\n\\n## 2. 법원의 판단\\n계약의 중요사항에 합의가 있었다면 해약금의 기준은 실제 교부받은 금원이 아니라 약정한 계약금 전체를 기준으로 해야 한다고 판결했습니다."
  },
  {
    "id": "art-2026-03",
    "title": "묵시적 갱신 후 세입자가 “3개월 뒤 나갑니다” 통보했을 때, 새 세입자 중개보수는 누가 내야 할까?",
    "category": "주택임대차",
    "issueVol": "2026. 10 창간호 (Vol.01)",
    "subtitle": "현장에서 가장 자주 다투는 ‘중도퇴거 중개보수 부담 주체’ 법원 판단과 명쾌한 중재 기준",
    "caseNumber": "주택임대차보호법 제6조의2",
    "isFeatured": false,
    "publishedAt": "2026-10-18",
    "rawJudgment": "주택임대차보호법 제6조의2",
    "relatedLinks": [
      {
        "url": "https://www.law.go.kr",
        "title": "주택임대차보호법 제6조의2"
      }
    ],
    "specialClause": "[중도 퇴거 및 묵시적 갱신 시 중개보수 부담 특약]\\n묵시적 갱신 후 법정기간(3개월)이 경과하여 계약이 종료되는 경우의 신규 중개보수는 임대인이 부담한다.",
    "summaryBullets": [
      "묵시적 갱신 후 임차인이 해지 통고를 하면 임대인이 통지를 받은 날부터 3개월이 지나면 임대차계약은 정상 종료됩니다.",
      "따라서 통지 후 3개월이 지난 시점에 퇴거하는 것은 정상 만료이므로 신규 임차인 중개보수는 임대인(집주인)이 부담합니다.",
      "단, 임차인이 3개월이 되기 전에 급히 나가는 합의 해지의 경우에는 임차인이 부담하기로 약정할 수 있습니다."
    ],
    "contentMarkdown": "## 1. 사건의 발단\\n묵시적 갱신 후 4개월 만에 3개월 뒤 이사 통보를 한 세입자에게 집주인이 복비를 내고 나가라고 주장한 사건입니다.\\n\\n## 2. 법원의 판단\\n해지 통지 후 3개월이 지나면 계약은 적법하게 종료되므로 새로운 임차인을 들이기 위한 중개보수는 원칙적으로 임대인이 부담합니다."
  },
  {
    "id": "art-2026-02",
    "title": "다가구주택 전세 중개 시 ‘선순위 보증금’ 구두 설명만 믿었다가 경매 넘어가면 중개사 책임은 몇 %?",
    "category": "중개책임·보수",
    "issueVol": "2026. 10 창간호 (Vol.01)",
    "subtitle": "집주인이 자료 제공을 거부하거나 축소 고지했을 때 개업공인중개사가 반드시 남겨야 할 면책 방어선",
    "caseNumber": "대법원 2022다255126 판결",
    "isFeatured": false,
    "publishedAt": "2026-10-20",
    "rawJudgment": "대법원 2022다255126 판결",
    "relatedLinks": [
      {
        "url": "https://www.law.go.kr",
        "title": "공인중개사법 제25조"
      }
    ],
    "specialClause": "[다가구주택 선순위 권리관계 확인 특약]\\n임대인은 선순위 보증금 총액이 OOO원임을 고지하며, 실제와 다를 경우 계약을 해제할 수 있다.",
    "summaryBullets": [
      "다가구주택 중개 시 개업공인중개사는 기존 세입자들의 보증금 총액·확정일자 현황을 적극적으로 조사·확인할 의무가 있습니다.",
      "임대인이 자료 제출을 거부하거나 구두로만 알려준 경우 확인설명서에 기재하지 않으면 중개사 과실이 인정됩니다.",
      "법원은 손해액의 20%~40%까지 배상 책임을 인정하므로 특약과 확인설명서 기재가 필수입니다."
    ],
    "contentMarkdown": "## 1. 사건의 발단\\n집주인 말만 믿고 선순위 2억이라 적었으나 실제 6억이 넘어 경매 배당을 못 받은 임차인이 소송을 제기했습니다.\\n\\n## 2. 법원의 판단\\n임대인 구두 진술만 믿은 것은 주의의무 위반으로 손해배상 책임이 인정되었습니다."
  },
  {
    "id": "art-2026-01",
    "title": "“재건축할 거니 그냥 나가세요” 임대인의 통보, 신규 임차인 안 데려와도 권리금 손해배상 받을 수 있을까?",
    "category": "상가·권리금",
    "issueVol": "2026. 10 창간호 (Vol.01)",
    "subtitle": "임대인이 정당한 사유 없이 신규 임차인과의 계약 체결을 거절할 뜻을 확정적으로 표시한 경우의 법리",
    "caseNumber": "대법원 2023다289142 판결",
    "isFeatured": true,
    "publishedAt": "2026-10-21",
    "rawJudgment": "대법원 2023다289142 판결",
    "relatedLinks": [
      {
        "url": "https://www.law.go.kr",
        "title": "상가건물 임대차보호법 제10조의4"
      }
    ],
    "specialClause": "[상가 권리금 회수기회 보호 특약]\\n임대인과 임차인은 상가임대차보호법 제10조의4에 따른 권리금 회수기회 보호 의무를 상호 확인하며, 정당한 사유 없이 신규 계약을 거절하지 않기로 한다.",
    "summaryBullets": [
      "임대인이 처음부터 누구를 데려와도 계약 안 해준다고 못 박았다면, 신규 임차인을 주선하지 않아도 권리금 회수기회 방해가 성립합니다.",
      "노후 건물 철거·재건축을 이유로 권리금 보호를 거절하려면 계약 체결 당시 공사시기와 소요기간을 미리 고지했거나 안전사고 우려가 입증되어야 합니다.",
      "개업공인중개사는 상가 만기 전 임대인의 거절 의사가 있을 때 거절 증거(문자, 녹취 등) 확보 방법을 안내해야 분쟁을 예방합니다."
    ],
    "contentMarkdown": "## 1. 사건의 발단\\n상가 임차인 A씨는 5년간 카페를 운영하다가 점포를 넘기기 위해 공인중개사사무소에 매물을 내놓았습니다. 그러나 건물주는 리모델링 후 직접 사용하겠다며 계약 체결을 거절했습니다.\\n\\n## 2. 법원의 판단\\n대법원은 임대인이 계약 거절 의사를 확정적으로 표시했다면 실제로 신규 임차인을 주선하지 않았더라도 권리금 회수방해 손해배상 책임을 진다고 판결했습니다."
  }
];

async function shareCurrentArticle() {
  if (!state.currentArticleId) return;
  const art = state.articles.find(a => a.id === state.currentArticleId);
  if (!art) return;

  const shareUrl = `https://no1korealtor.github.io/ter-magazine/?article=${encodeURIComponent(art.id)}`;
  const bullets = (art.summaryBullets && art.summaryBullets.length > 0)
    ? '\n\n💡 [핵심 요약]\n' + art.summaryBullets.map(b => `• ${b}`).join('\n')
    : '';

  const shareTitle = `[공인중개사 소식지 터] ${art.title}`;
  const shareText = `📘 [공인중개사 소식지 터]\n📌 ${art.category} | ${art.caseNumber || ''}\n\n"${art.title}"${bullets}\n\n👇 아래 링크를 누르면 '공인중개사 소식지 터'에서 기사 전문을 바로 보실 수 있습니다.\n${shareUrl}`;

  // 1순위: 안드로이드 네이티브 브릿지 지원 시
  if (window.AndroidBridge && typeof window.AndroidBridge.shareText === 'function') {
    window.AndroidBridge.shareText(shareTitle, shareText);
    return;
  }

  // 2순위: 모바일 브라우저 Web Share API (카카오톡, 문자 등 선택 창 호출)
  if (navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText
      });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  // 3순위: PC 또는 구형 환경 클립보드 복사
  try {
    await navigator.clipboard.writeText(shareText);
    showToast('💬 기사 요약과 소식지 링크가 복사되었습니다! 카카오톡 대화창에 붙여넣기(Ctrl+V) 하세요.');
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = shareText;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('💬 기사 요약과 소식지 링크가 복사되었습니다! 카카오톡에 붙여넣기 하세요.');
  }
}
