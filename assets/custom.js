document.addEventListener('DOMContentLoaded', () => {
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
    const triggerLink = megaMenuItem.querySelector('> .ct-menu-link');
    
    // Toggle on touch devices or keyboard
    if (triggerLink) {
      triggerLink.addEventListener('click', (e) => {
        // If clicking on touchscreen or wanting to toggle
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

  // 4. Scroll to top handler
  const scrollTops = document.querySelectorAll('[data-shortcut="scroll_top"]');
  scrollTops.forEach(st => {
    st.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
});
