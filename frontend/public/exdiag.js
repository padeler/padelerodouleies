/*
 * On-device diagnostic for the exercise option/match image bug.
 * Kept in a separate file (not inline) because the production CSP is
 * `script-src 'self'`, and written in ES5 so an old engine can never fail to
 * parse the very page meant to diagnose it.
 */
(function () {
  'use strict';

  // A 1:1 SVG and a PNG, both as data: URIs (CSP allows `img-src 'self' data:`),
  // so the probes never depend on a bundle existing on the device.
  var SVG_SRC =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">' +
        '<rect width="100" height="100" fill="#2f6fd0"/>' +
        '<circle cx="50" cy="50" r="34" fill="#ffd400"/>' +
        '<text x="50" y="62" font-size="34" text-anchor="middle" fill="#111">SVG</text>' +
        '</svg>',
    );

  // 8x8 solid green PNG, scaled up by the layout.
  var PNG_SRC =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHElEQVQoz2NkYPjPQApgYhhVMKpg' +
    'VMGoglEFxCkAAF9EAAF6Q2/1AAAAAElFTkSuQmCC';

  // ?img=<url> tests a real bundle asset; ?src=png switches the built-in probe.
  function queryParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  }

  var custom = queryParam('img');
  var which = queryParam('src');
  var SRC = custom ? custom : which === 'png' ? PNG_SRC : SVG_SRC;

  var IMG_IDS = ['a1i', 'a2i', 'a3i', 'b1i', 'b2i', 'b3i', 'b4i', 'b5i'];
  var WRAP_IDS = ['a1w', 'a2w', 'a3w', 'b3w', 'b4w', 'b5w'];

  function byId(id) {
    return document.getElementById(id);
  }

  function css(el, prop) {
    if (!el || !window.getComputedStyle) return '?';
    return window.getComputedStyle(el).getPropertyValue(prop);
  }

  function supports(prop, value) {
    if (window.CSS && window.CSS.supports) {
      return window.CSS.supports(prop, value) ? 'yes' : 'NO';
    }
    return 'unknown (CSS.supports missing)';
  }

  function describeEnv() {
    var lines = [];
    lines.push('userAgent: ' + navigator.userAgent);
    lines.push('viewport: ' + window.innerWidth + ' x ' + window.innerHeight);
    lines.push('devicePixelRatio: ' + (window.devicePixelRatio || 1));
    lines.push('probe src: ' + (custom ? custom : which === 'png' ? 'built-in PNG' : 'built-in SVG'));
    lines.push('--- feature support ---');
    lines.push('display:flex        ' + supports('display', 'flex'));
    lines.push('display:grid        ' + supports('display', 'grid'));
    lines.push('aspect-ratio        ' + supports('aspect-ratio', '1 / 1'));
    lines.push('object-fit:contain  ' + supports('object-fit', 'contain'));
    lines.push('css variables       ' + supports('--x', '1'));
    lines.push('position:sticky     ' + supports('position', 'sticky'));
    byId('env').textContent = lines.join('\n');
  }

  function pad(s, n) {
    s = String(s);
    while (s.length < n) s += ' ';
    return s;
  }

  function measure() {
    var out = [];

    out.push('=== IMAGES (did the bitmap load, and does it occupy space?) ===');
    out.push(pad('id', 6) + pad('natural', 12) + pad('boxWxH', 12) + pad('display', 10) + pad('position', 10) + 'object-fit');
    for (var i = 0; i < IMG_IDS.length; i++) {
      var img = byId(IMG_IDS[i]);
      if (!img) continue;
      var r = img.getBoundingClientRect();
      out.push(
        pad(IMG_IDS[i], 6) +
          pad(img.naturalWidth + 'x' + img.naturalHeight, 12) +
          pad(Math.round(r.width) + 'x' + Math.round(r.height), 12) +
          pad(css(img, 'display'), 10) +
          pad(css(img, 'position'), 10) +
          css(img, 'object-fit'),
      );
    }

    out.push('');
    out.push('=== WRAPPERS (did the box get height?) ===');
    out.push(pad('id', 6) + pad('boxWxH', 12) + pad('display', 14) + pad('position', 10) + 'padding-bottom');
    for (var j = 0; j < WRAP_IDS.length; j++) {
      var w = byId(WRAP_IDS[j]);
      if (!w) continue;
      var wr = w.getBoundingClientRect();
      out.push(
        pad(WRAP_IDS[j], 6) +
          pad(Math.round(wr.width) + 'x' + Math.round(wr.height), 12) +
          pad(css(w, 'display'), 14) +
          pad(css(w, 'position'), 10) +
          css(w, 'padding-bottom'),
      );
    }

    // The headline answer: loaded-but-not-painted vs never-loaded vs collapsed.
    out.push('');
    out.push('=== VERDICT ===');
    var a1 = byId('a1i');
    var a2 = byId('a2i');
    if (a1 && a2) {
      var loaded = a2.naturalWidth > 0;
      var box = a2.getBoundingClientRect();
      var sized = box.width > 1 && box.height > 1;
      out.push('MC image bitmap loaded : ' + (loaded ? 'YES' : 'NO  <-- image never decoded'));
      out.push('MC image box has size  : ' + (sized ? 'YES' : 'NO  <-- box collapsed to zero'));
      if (loaded && sized) {
        out.push('=> Image loaded AND is sized: a paint/stacking issue, not layout.');
      } else if (loaded && !sized) {
        out.push('=> Image loaded but box is zero: layout/containing-block issue.');
      } else {
        out.push('=> Bitmap never loaded: network/decode issue, not CSS.');
      }
    }

    byId('report').textContent = out.join('\n');
  }

  describeEnv();

  // Point every probe at the same source so the cases are directly comparable.
  var pending = IMG_IDS.length;
  function done() {
    pending--;
    if (pending <= 0) setTimeout(measure, 60);
  }
  for (var k = 0; k < IMG_IDS.length; k++) {
    var el = byId(IMG_IDS[k]);
    if (!el) {
      pending--;
      continue;
    }
    el.onload = done;
    el.onerror = done;
    el.src = SRC;
  }
  // Measure regardless, in case a load event never fires on this engine.
  setTimeout(measure, 1200);
  window.onload = function () {
    setTimeout(measure, 200);
  };
})();
