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

  // Submenu toggles inside offcanvas
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

  // 2. Sticky Header scroll detection
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

  // 3. Scroll to top handler
  const scrollTops = document.querySelectorAll('[data-shortcut="scroll_top"]');
  scrollTops.forEach(st => {
    st.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
});
