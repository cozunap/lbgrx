(function() {
  function initGlobalEnhancements() { 
  // 1. Offcanvas mobile menu toggle
  const offcanvas = document.getElementById('offcanvas');
  const triggers = document.querySelectorAll('[data-toggle-panel="#offcanvas"], .ct-header-trigger, [data-id="trigger"]');
  const closeBtn = document.querySelector('.ct-toggle-close');

  function openMenu(e) {
    if (e) e.preventDefault();
    if (offcanvas) {
      offcanvas.classList.add('is-active', 'active');
      offcanvas.removeAttribute('inert');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeMenu(e) {
    if (e) e.preventDefault();
    if (offcanvas) {
      offcanvas.classList.remove('is-active', 'active');
      offcanvas.setAttribute('inert', '');
      document.body.style.overflow = '';
    }
  }

  triggers.forEach(t => t.addEventListener('click', openMenu));
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  // Submenu toggles inside offcanvas (Mobile)
  const dropdownButtons = document.querySelectorAll('#offcanvas .ct-toggle-dropdown-mobile');
  dropdownButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const parent = btn.closest('li');
      const sub = parent ? parent.querySelector('.sub-menu') : null;
      if (sub) {
        sub.classList.toggle('is-open');
        const isOpen = sub.classList.contains('is-open');
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }
    });
  });

  // 2. Desktop Mega Menu click/touch support
  const megaMenuItem = document.querySelector('.ct-mega-menu-item');
  if (megaMenuItem) {
    const triggerLink = megaMenuItem.querySelector(':scope > .ct-menu-link');
    
    // Toggle on touch devices or keyboard
    if (triggerLink) {
      triggerLink.addEventListener('click', (e) => {
        if (window.innerWidth >= 1000 && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
          if (!megaMenuItem.classList.contains('is-active')) {
            e.preventDefault();
            megaMenuItem.classList.add('is-active');
          }
        }
      });
    }

    // Close mega menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!megaMenuItem.contains(e.target)) {
        megaMenuItem.classList.remove('is-active');
      }
    });
  }

  // 3. Sticky Header scroll detection
  const header = document.querySelector('header.ct-header');
  const stickyContainer = document.querySelector('.ct-sticky-container');
  
  if (header || stickyContainer) {
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY || window.pageYOffset;
      if (scrollY > 50) {
        if (header) header.classList.add('is-sticky');
        if (stickyContainer) stickyContainer.classList.add('is-sticky');
      } else {
        if (header) header.classList.remove('is-sticky');
        if (stickyContainer) stickyContainer.classList.remove('is-sticky');
      }
    }, { passive: true });
  }

  // 5. Automatic Browser Language Detection (Bilingual English / Spanish routing)
  (function initLanguageRouting() {
    try {
      const path = window.location.pathname;
      const isSpanishPath = path.startsWith('/es/') || path === '/es';
      
      const userLangPreference = localStorage.getItem('lbgrx_lang_pref');
      
      if (isSpanishPath) {
        localStorage.setItem('lbgrx_lang_pref', 'es');
        return;
      }

      const browserLang = (navigator.languages && navigator.languages.length ? navigator.languages[0] : navigator.language || navigator.userLanguage || '').toLowerCase();
      const isSpanishBrowser = browserLang.startsWith('es');

      if (isSpanishBrowser && userLangPreference !== 'en') {
        localStorage.setItem('lbgrx_lang_pref', 'es');
        const search = window.location.search || '';
        const hash = window.location.hash || '';
        const targetPath = path === '/' ? '/es/' : ('/es' + path);
        window.location.replace(targetPath + search + hash);
      }
    } catch (e) {
      console.warn('Language detection routing error:', e);
    }
  })();

  // 5.5. Active Menu Item Highlighter (Brand Orange)
  (function initActiveMenuHighlighting() {
    try {
      const rawPath = window.location.pathname.replace(/\/index\.html$/, '/');
      const normalizedPath = rawPath.endsWith('/') ? rawPath : (rawPath + '/');
      
      const allMenuLinks = document.querySelectorAll('.ct-header-nav .menu a, #offcanvas .mobile-menu a');
      
      allMenuLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        let linkPath = href;
        if (linkPath.startsWith('http://') || linkPath.startsWith('https://')) {
          try {
            linkPath = new URL(linkPath).pathname;
          } catch(e) {}
        }
        linkPath = linkPath.replace(/\/index\.html$/, '/');
        if (!linkPath.endsWith('/') && !linkPath.includes('#')) linkPath += '/';
        
        // Exact match for Home (English '/' or Spanish '/es/')
        const isHomeLink = linkPath === '/' || linkPath === '/es/';
        const isCurrentHome = normalizedPath === '/' || normalizedPath === '/es/';
        
        let isMatch = false;
        if (isHomeLink) {
          isMatch = isCurrentHome && (linkPath === normalizedPath);
        } else if (linkPath !== '/' && linkPath !== '/es/') {
          // Exact match or sub-page match
          if (normalizedPath === linkPath) {
            isMatch = true;
          } else if (linkPath !== '/' && normalizedPath.startsWith(linkPath)) {
            isMatch = true;
          }
        }
        
        if (isMatch) {
          link.classList.add('is-active', 'current-menu-link');
          const li = link.closest('li');
          if (li) {
            li.classList.add('current-menu-item', 'current_page_item', 'is-active');
          }
          // If in mega menu, also highlight parent Services item
          const parentMega = link.closest('.ct-mega-menu-item');
          if (parentMega) {
            parentMega.classList.add('current-menu-item', 'is-active');
            const parentTrigger = parentMega.querySelector(':scope > .ct-menu-link');
            if (parentTrigger) parentTrigger.classList.add('is-active', 'current-menu-link');
          }
        }
      });
    } catch(err) {
      console.warn('Active menu highlight error:', err);
    }
  })();

  // 6. Interactive Instant Search Engine across Entire Site
  (function initInteractiveSearch() {
    const searchModal = document.getElementById('search-modal');
    if (!searchModal) return;

    const searchInput = searchModal.querySelector('input[type="search"]');
    const searchForm = searchModal.querySelector('form');
    let resultsBox = null;
    let searchData = null;

    // Remove Blocksy live-search attribute so WordPress ajax isn't triggered
    if (searchForm) {
      searchForm.removeAttribute('data-live-results');
      searchForm.classList.remove('ct-searching');
    }

    async function getSearchData() {
      if (!searchData) {
        try {
          const res = await fetch('/assets/search-index.json');
          if (res.ok) {
            searchData = await res.json();
          }
        } catch (err) {
          console.warn('Failed to load search index:', err);
        }
      }
      return searchData || [];
    }

    // Preload index
    setTimeout(getSearchData, 1500);

    function getResultsBox() {
      if (!resultsBox) {
        resultsBox = document.createElement('div');
        resultsBox.className = 'live-search-results-box';
        resultsBox.style.display = 'none';
        const panelContent = searchModal.querySelector('.ct-panel-content') || searchModal;
        panelContent.appendChild(resultsBox);
      }
      return resultsBox;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[m]);
    }

    async function runSearch(query) {
      const box = getResultsBox();
      if (!box) return;

      const trimmed = (query || '').trim();
      if (trimmed.length < 2) {
        box.innerHTML = '';
        box.style.display = 'none';
        return;
      }

      const list = await getSearchData();
      const q = trimmed.toLowerCase();
      const isSpanish = window.location.pathname.startsWith('/es/') || window.location.pathname === '/es';

      const results = list.filter(item => {
        return (item.keywords && item.keywords.includes(q)) ||
               (item.title && item.title.toLowerCase().includes(q)) ||
               (item.excerpt && item.excerpt.toLowerCase().includes(q));
      }).sort((a, b) => {
        if (a.is_es === isSpanish && b.is_es !== isSpanish) return -1;
        if (b.is_es === isSpanish && a.is_es !== isSpanish) return 1;
        const aTitle = a.title.toLowerCase().includes(q);
        const bTitle = b.title.toLowerCase().includes(q);
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;
        return 0;
      }).slice(0, 8);

      if (results.length === 0) {
        const noText = isSpanish
          ? `No se encontraron resultados para "<strong>${escapeHtml(trimmed)}</strong>".`
          : `No products or pages found for "<strong>${escapeHtml(trimmed)}</strong>".`;
        box.innerHTML = `<div class="live-search-empty">${noText}</div>`;
        box.style.display = 'block';
        return;
      }

      let html = '';
      results.forEach(item => {
        html += `
          <a href="${escapeHtml(item.url)}" class="live-search-item">
            <div class="live-search-info">
              <span class="live-search-category">${escapeHtml(item.category)}</span>
              <span class="live-search-title">${escapeHtml(item.title)}</span>
              ${item.excerpt ? `<span class="live-search-excerpt">${escapeHtml(item.excerpt)}</span>` : ''}
            </div>
            <span class="live-search-arrow">&rarr;</span>
          </a>
        `;
      });

      box.innerHTML = html;
      box.style.display = 'block';
    }

    if (searchInput) {
      let timer;
      const onType = (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          runSearch(searchInput.value);
        }, 120);
      };

      searchInput.addEventListener('input', onType);
      searchInput.addEventListener('keyup', onType);
    }

    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (searchInput && searchInput.value.trim()) {
          runSearch(searchInput.value.trim());
        }
      });
    }

    // Auto focus and auto run when modal opens
    const observer = new MutationObserver(() => {
      const isOpen = searchModal.classList.contains('active') || searchModal.classList.contains('is-active');
      if (isOpen && searchInput) {
        setTimeout(() => {
          searchInput.focus();
          if (searchInput.value.trim().length >= 2) {
            runSearch(searchInput.value.trim());
          }
        }, 100);
      } else if (!isOpen && resultsBox) {
        resultsBox.style.display = 'none';
      }
    });

    observer.observe(searchModal, { attributes: true, attributeFilter: ['class'] });
  })();

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalEnhancements);
  } else {
    initGlobalEnhancements();
  }
})();
