(function () {
  var input = document.getElementById('buscar-ayuda');
  var count = document.getElementById('help-count');
  var empty = document.getElementById('help-empty');
  var topics = document.querySelector('.help-topics');
  var articles = Array.prototype.slice.call(document.querySelectorAll('.help-article'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.help-section'));
  if (!input || !articles.length) return;

  function fold(text) {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  var index = articles.map(function (article) {
    var title = article.querySelector('h3');
    return { article: article, title: title, original: title.textContent, text: fold(article.textContent) };
  });

  function escapeHtml(text) {
    return text.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function highlight(entry, terms) {
    if (!terms.length) { entry.title.textContent = entry.original; return; }
    var folded = fold(entry.original);
    var marks = new Array(entry.original.length).fill(false);
    terms.forEach(function (term) {
      var from = 0;
      var at;
      while ((at = folded.indexOf(term, from)) !== -1) {
        for (var i = at; i < at + term.length; i++) marks[i] = true;
        from = at + term.length;
      }
    });
    var html = '';
    var open = false;
    for (var i = 0; i < entry.original.length; i++) {
      if (marks[i] && !open) { html += '<mark>'; open = true; }
      if (!marks[i] && open) { html += '</mark>'; open = false; }
      html += escapeHtml(entry.original[i]);
    }
    if (open) html += '</mark>';
    entry.title.innerHTML = html;
  }

  function search() {
    var terms = fold(input.value).split(/[^a-z0-9ñ]+/).filter(function (t) { return t.length > 1; });
    var shown = 0;
    index.forEach(function (entry) {
      var match = terms.every(function (term) { return entry.text.indexOf(term) !== -1; });
      entry.article.hidden = terms.length > 0 && !match;
      entry.article.open = terms.length > 0 && match;
      highlight(entry, terms);
      if (!entry.article.hidden) shown++;
    });
    sections.forEach(function (section) {
      section.hidden = !section.querySelector('.help-article:not([hidden])');
    });
    if (topics) topics.hidden = terms.length > 0;
    empty.hidden = !(terms.length > 0 && shown === 0);
    count.textContent = terms.length ? (shown === 1 ? '1 artículo encontrado' : shown + ' artículos encontrados') : '';
  }

  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var target = document.getElementById(id);
    if (target && target.classList.contains('help-article')) {
      if (input.value) { input.value = ''; search(); }
      target.open = true;
      target.scrollIntoView({ block: 'start' });
    }
  }

  articles.forEach(function (article) {
    article.addEventListener('toggle', function () {
      if (article.open && !input.value && history.replaceState) history.replaceState(null, '', '#' + article.id);
    });
  });

  input.addEventListener('input', search);
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { input.value = ''; search(); }
  });
  document.addEventListener('keydown', function (event) {
    var tag = document.activeElement && document.activeElement.tagName;
    if (event.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { event.preventDefault(); input.focus(); }
  });
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
})();
