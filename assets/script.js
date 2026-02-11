/* ═══════════════════════════════════════════════
   CUITE — Site JavaScript
   Navigation, TOC, Code Blocks, Animations
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    setupNavigation();
    setupTOC();
    setupCodeBlocks();
    setupScrollAnimations();
    setupHeadingAnchors();
    highlightSyntax();
  }

  /* ── Mobile Navigation ── */
  function setupNavigation() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.site-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      toggle.classList.toggle('active');
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.classList.remove('active');
      });
    });
  }

  /* ── Table of Contents (Scroll Spy) ── */
  function setupTOC() {
    var sidebar = document.querySelector('.doc-sidebar');
    var tocToggle = document.querySelector('.toc-toggle');
    var tocLinks = document.querySelectorAll('.toc-link');
    if (!sidebar) return;

    if (tocToggle) {
      tocToggle.addEventListener('click', function () {
        sidebar.classList.toggle('open');
      });
      document.addEventListener('click', function (e) {
        if (!sidebar.contains(e.target) && !tocToggle.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      });
    }

    if (tocLinks.length === 0) return;

    var headings = [];
    tocLinks.forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        var target = document.getElementById(href.slice(1));
        if (target) headings.push({ el: target, link: link });
      }
    });

    function updateActive() {
      var scrollTop = window.scrollY + 120;
      var current = null;
      headings.forEach(function (item) {
        if (item.el.offsetTop <= scrollTop) {
          current = item.link;
        }
      });
      tocLinks.forEach(function (l) { l.classList.remove('active'); });
      if (current) current.classList.add('active');
    }

    window.addEventListener('scroll', throttle(updateActive, 80));
    updateActive();

    tocLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('open');
        }
      });
    });
  }

  /* ── Code Blocks (Copy Button) ── */
  function setupCodeBlocks() {
    document.querySelectorAll('pre').forEach(function (pre) {
      if (pre.querySelector('.code-copy')) return;
      var btn = document.createElement('button');
      btn.className = 'code-copy';
      btn.textContent = 'Copy';
      btn.addEventListener('click', function () {
        var code = pre.querySelector('code') || pre;
        var text = code.textContent;
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 2000);
        }).catch(function () {
          btn.textContent = 'Failed';
          setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
        });
      });
      pre.appendChild(btn);
    });
  }

  /* ── Basic Syntax Highlighting ── */
  function highlightSyntax() {
    document.querySelectorAll('pre code[data-lang]').forEach(function (block) {
      var lang = block.dataset.lang;
      var html = block.innerHTML;
      if (html.indexOf('syn-') !== -1) return;

      var tokens = [];
      function protect(s) {
        tokens.push(s);
        return '\x00' + (tokens.length - 1) + '\x00';
      }

      // Strings
      html = html.replace(/"(?:[^"\\]|\\.)*"/g, function (m) {
        return protect('<span class="syn-str">' + m + '</span>');
      });
      html = html.replace(/'(?:[^'\\]|\\.)*'/g, function (m) {
        return protect('<span class="syn-str">' + m + '</span>');
      });

      // Comments (# ...)
      html = html.replace(/(^|\n)(#[^\n]*)/g, function (_, pre, cmt) {
        if (cmt.indexOf('\x00') !== -1) return _ ;
        return pre + protect('<span class="syn-cmt">' + cmt + '</span>');
      });

      if (lang === 'bash' || lang === 'shell') {
        html = html.replace(/(\$[\w]+|\$\{[^}]+\})/g, '<span class="syn-var">$1</span>');
      }

      if (lang === 'yaml') {
        html = html.replace(/^(\s*)([\w][\w.-]*)(:)/gm, '$1<span class="syn-prop">$2</span>$3');
      }

      // Restore
      html = html.replace(/\x00(\d+)\x00/g, function (_, i) { return tokens[i]; });
      block.innerHTML = html;
    });
  }

  /* ── Heading Anchor Links ── */
  function setupHeadingAnchors() {
    document.querySelectorAll('.doc-content h2[id], .doc-content h3[id]').forEach(function (h) {
      var a = document.createElement('a');
      a.className = 'heading-anchor';
      a.href = '#' + h.id;
      a.textContent = '\u00A7';
      a.setAttribute('aria-label', 'Link to this section');
      h.appendChild(a);
    });
  }

  /* ── Scroll Animations ── */
  function setupScrollAnimations() {
    if (!('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.fade-in, .stagger').forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ── Utility ── */
  function throttle(fn, wait) {
    var last = 0;
    return function () {
      var now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(this, arguments);
      }
    };
  }
})();
