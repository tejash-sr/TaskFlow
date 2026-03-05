document.addEventListener('DOMContentLoaded', function () {

  /* ─── Toast notification system ─── */
  var toastContainer = document.getElementById('toastContainer');

  function showToast(message, type, duration) {
    if (!toastContainer) return;
    type = type || 'info';
    duration = duration || 4000;

    var icons = {
      success: 'fa-check-circle',
      error:   'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info:    'fa-info-circle'
    };

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML =
      '<i class="fas ' + (icons[type] || icons.info) + ' toast-icon"></i>' +
      '<span class="toast-msg">' + message + '</span>' +
      '<button class="toast-close" aria-label="Close"><i class="fas fa-times"></i></button>';

    toastContainer.appendChild(toast);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add('toast-show');
      });
    });

    var closeBtn = toast.querySelector('.toast-close');
    function dismiss() {
      toast.classList.remove('toast-show');
      toast.classList.add('toast-hide');
      setTimeout(function () { toast.remove(); }, 350);
    }
    closeBtn.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  }

  window.showToast = showToast;

  /* ─── Convert server-rendered flash messages to toasts ─── */
  document.querySelectorAll('.flash-message').forEach(function (el) {
    var type = el.classList.contains('flash-success') ? 'success' : 'error';
    var msgEl = el.querySelector('.flash-message-text') || el;
    var text = '';
    el.childNodes.forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent.trim();
    });
    if (!text) text = el.textContent.replace(/×/g, '').trim();
    showToast(text || (type === 'success' ? 'Done!' : 'Something went wrong.'), type);
    el.remove();
  });

  /* ─── Confirm modal system ─── */
  var confirmBackdrop = document.getElementById('confirmModalBackdrop');
  var confirmMessage  = document.getElementById('confirmModalMessage');
  var confirmBtn      = document.getElementById('confirmModalConfirm');
  var cancelBtn       = document.getElementById('confirmModalCancel');
  var pendingFormId   = null;

  function openConfirmModal(formId, message) {
    pendingFormId = formId;
    if (confirmMessage) confirmMessage.textContent = message || 'This action cannot be undone.';
    if (confirmBackdrop) {
      confirmBackdrop.style.display = 'flex';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          confirmBackdrop.classList.add('open');
        });
      });
    }
  }

  function closeConfirmModal() {
    if (confirmBackdrop) {
      confirmBackdrop.classList.remove('open');
      setTimeout(function () { confirmBackdrop.style.display = 'none'; }, 250);
    }
    pendingFormId = null;
  }

  window.openConfirmModal = openConfirmModal;

  if (cancelBtn) cancelBtn.addEventListener('click', closeConfirmModal);

  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      if (pendingFormId) {
        var form = document.getElementById(pendingFormId);
        if (form) form.submit();
      }
      closeConfirmModal();
    });
  }

  if (confirmBackdrop) {
    confirmBackdrop.addEventListener('click', function (e) {
      if (e.target === confirmBackdrop) closeConfirmModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeConfirmModal();
  });

  /* ─── Inline alert auto-dismiss (form error alerts) ─── */
  document.querySelectorAll('.alert').forEach(function (el) {
    setTimeout(function () {
      el.style.transition = 'opacity 300ms ease, transform 300ms ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(function () { el.remove(); }, 300);
    }, 6000);
  });

  /* ─── Navbar scroll effect ─── */
  var navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      navbar.classList.toggle('scrolled', window.scrollY > 10);
    });
  }

  /* ─── Mobile navbar hamburger toggle ─── */
  var navbarToggle = document.querySelector('.navbar-toggle');
  var navbarMenu   = document.querySelector('.navbar-menu');
  if (navbarToggle && navbarMenu) {
    navbarToggle.addEventListener('click', function () {
      navbarMenu.classList.toggle('open');
    });
  }

  /* ─── User dropdown ─── */
  var userDropdown = document.querySelector('.user-dropdown');
  if (userDropdown) {
    var dropdownBtn = userDropdown.querySelector('.user-avatar-btn');
    if (dropdownBtn) {
      dropdownBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        userDropdown.classList.toggle('open');
      });
    }
    document.addEventListener('click', function () {
      userDropdown.classList.remove('open');
    });
  }

  /* ─── Sidebar toggle ─── */
  var sidebar        = document.getElementById('sidebar');
  var sidebarOverlay = document.getElementById('sidebarOverlay');
  var sidebarToggles = document.querySelectorAll('#sidebarToggle');
  var sidebarClose   = document.querySelector('.sidebar-close');

  function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarOverlay) sidebarOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  sidebarToggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (sidebar && sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  });

  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

  /* ─── Scroll-triggered animations ─── */
  var animatedEls = document.querySelectorAll('[data-animate]');
  if (animatedEls.length > 0 && window.IntersectionObserver) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var delay = parseInt(entry.target.dataset.delay || '0', 10);
          setTimeout(function () { entry.target.classList.add('animated'); }, delay);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    animatedEls.forEach(function (el) { observer.observe(el); });
  }

  /* ─── View toggle (list/grid) ─── */
  var viewBtns = document.querySelectorAll('.view-btn');
  viewBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      viewBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

});

/* ─── File upload label updater (called inline) ─── */
function updateFileName(input) {
  var id = input.id.replace('fileInput-', 'fileName-');
  var label = document.getElementById(id);
  if (label) {
    label.textContent = input.files && input.files[0] ? input.files[0].name : 'Choose a file to upload';
  }
}


