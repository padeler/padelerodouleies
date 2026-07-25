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

  var IMG_IDS = ['a1i', 'a2i', 'a3i', 'b1i', 'b2i', 'b3i', 'b4i', 'b5i', 'd1i', 'd2i', 'd3i'];
  var WRAP_IDS = ['a1w', 'a2w', 'a3w', 'b3w', 'b4w', 'b5w', 'd1w', 'd3w'];

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
    var allIds = IMG_IDS.slice();
    for (var c = 0; c < cImgs.length; c++) allIds.push(cImgs[c].id);
    for (var i = 0; i < allIds.length; i++) {
      var img = byId(allIds[i]);
      if (!img) continue;
      var r = img.getBoundingClientRect();
      out.push(
        pad(allIds[i], 6) +
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

  /* ---------------------------------------------------------------
   * Section C: the real images, fetched through the real endpoints.
   * Sections A/B use data: URIs and paint fine on the device, so the
   * source URL is the only untested variable left.
   * ------------------------------------------------------------- */

  var cImgs = []; // {id, url, type, field, bundle}

  // Images under these keys render inside the option/match button (the reported
  // failure); anything else is the exercise-level prompt icon or scene image.
  function buttonLevel(item) {
    return (
      item.field === 'options' ||
      item.field === 'items' ||
      item.field === 'left' ||
      item.field === 'right'
    );
  }

  function xhrJson(url, cb) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.withCredentials = true; // same-origin session cookie
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var data = null;
      try {
        data = JSON.parse(x.responseText);
      } catch (e) {
        data = null;
      }
      cb(x.status, data);
    };
    x.onerror = function () {
      cb(0, null);
    };
    x.send();
  }

  // Report status/content-type/size for one asset URL, so a 401/404/wrong MIME
  // is distinguishable from "downloaded fine but refused to paint".
  function probeUrl(url, cb) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.withCredentials = true;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var ct = '?';
      try {
        ct = x.getResponseHeader('Content-Type') || '(none)';
      } catch (e) {
        ct = '(unreadable)';
      }
      cb(x.status, ct, (x.responseText || '').length);
    };
    x.onerror = function () {
      cb(0, '(network error)', 0);
    };
    x.send();
  }

  // Bundle manifests nest differently per exercise type, so walk the JSON for
  // any `image`/`icon` string rather than assuming a shape.
  function collectImages(node, type, bundleId, field, out) {
    if (!node || typeof node !== 'object') return;
    if (node.type && typeof node.type === 'string') type = node.type;
    for (var key in node) {
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
      var val = node[key];
      if ((key === 'image' || key === 'icon') && typeof val === 'string' && val) {
        out.push({
          raw: val,
          url: val.indexOf('/api/icons/svg/') === 0 ? val : '/api/exercises/assets/' + encodeURIComponent(bundleId) + '/' + val,
          type: type || '?',
          field: field,
          bundle: bundleId,
        });
      } else if (val && typeof val === 'object') {
        // Array indices are meaningless as labels — keep the owning key
        // ("options", "items", "left") so the report says where the image sits.
        var childField = /^\d+$/.test(key) ? field : key;
        collectImages(val, type, bundleId, childField, out);
      }
    }
  }

  function renderCase(item, index) {
    var id = 'c' + index + 'i';
    var bareId = 'c' + index + 'b';
    var div = document.createElement('div');
    div.className = 'case';
    div.innerHTML =
      '<div class="case-title">C' + index + ' — ' + item.type + ' · ' + item.field +
      (buttonLevel(item) ? ' (ON BUTTON — the failing case)' : ' (prompt/scene — renders fine today)') +
      ' · ' + item.bundle + '</div>' +
      '<div class="mc-options">' +
      '<div class="mc-option-wrap"><button type="button" class="mc-option">' +
      '<span class="mc-option-img-wrap probe"><img class="mc-option-img" id="' + id + '" alt="" /></span>' +
      '<span>real layout</span></button></div>' +
      '<div class="mc-option-wrap"><button type="button" class="mc-option">' +
      '<img class="fix1-img probe" id="' + bareId + '" alt="" />' +
      '<span>bare img</span></button></div>' +
      '</div>' +
      '<div class="mono" id="c' + index + 'm">' + item.url + '\nprobing…</div>';
    document.getElementById('cases').appendChild(div);

    cImgs.push({ id: id, url: item.url });

    // Transfer status and decode status settle independently, so keep both in
    // one state object and re-render the line whenever either lands. Reading
    // naturalWidth when only the XHR has finished reports a false "never
    // decoded" — the <img> may not have decoded yet.
    var state = { http: null, ct: '', len: 0, settled: false };

    function draw() {
      var img = byId(id);
      var lines = [item.url];
      if (state.http === null) {
        lines.push('HTTP: probing…');
      } else {
        lines.push('HTTP ' + state.http + (state.http === 200 ? '' : '  <-- NOT 200'));
        lines.push('Content-Type: ' + state.ct);
        lines.push('bytes(approx): ' + state.len);
      }
      if (!state.settled) {
        lines.push('decode: waiting…');
      } else if (img.naturalWidth === 0) {
        lines.push('decode: FAILED  <-- downloaded but the bitmap never decoded');
      } else {
        lines.push('decode: ok  natural ' + img.naturalWidth + 'x' + img.naturalHeight);
        var r = img.getBoundingClientRect();
        lines.push('painted box: ' + Math.round(r.width) + 'x' + Math.round(r.height));
      }
      byId('c' + index + 'm').textContent = lines.join('\n');
    }

    var main = byId(id);
    main.onload = function () {
      state.settled = true;
      draw();
    };
    main.onerror = function () {
      state.settled = true;
      draw();
    };
    main.src = item.url;
    byId(bareId).src = item.url;

    probeUrl(item.url, function (status, ct, len) {
      state.http = status;
      state.ct = ct;
      state.len = len;
      draw();
    });

    // Some old engines fire no load event for a cached image; settle anyway.
    setTimeout(function () {
      if (!state.settled && byId(id).naturalWidth > 0) {
        state.settled = true;
        draw();
      }
    }, 2500);
  }

  function runRealImages() {
    xhrJson('/api/exercises/bundles', function (status, data) {
      if (status === 401 || status === 403) {
        byId('creport').textContent =
          'HTTP ' + status + ' from /api/exercises/bundles.\n' +
          'Log into the app in THIS browser (as the kid account that sees the ' +
          'failing exercises), then reload this page.';
        return;
      }
      if (status !== 200 || !data) {
        byId('creport').textContent = 'HTTP ' + status + ' from /api/exercises/bundles — could not read the bundle list.';
        return;
      }
      var list = data.bundles || data.items || (data.length ? data : []);
      if (!list || !list.length) {
        byId('creport').textContent = 'No bundles visible to this account (check the kid birthdate / age targeting).';
        return;
      }

      var found = [];
      var pendingBundles = list.length;
      var lines = ['bundles visible: ' + list.length];

      function finish() {
        // Only `options`/`items`/`left`/`right` images render ON a button — the
        // reported failure. An exercise-level `icon`/`image` is the prompt icon
        // or scene, which renders fine, so sort the button ones to the front.
        found.sort(function (a, b) {
          return buttonLevel(a) === buttonLevel(b) ? 0 : buttonLevel(a) ? -1 : 1;
        });
        var nButton = 0;
        for (var q = 0; q < found.length; q++) if (buttonLevel(found[q])) nButton++;
        lines.push('images found: ' + found.length + ' (' + nButton + ' on buttons)');
        if (nButton === 0) {
          lines.push('');
          lines.push('!! No button-level images are visible to this account, so the');
          lines.push('!! failing case cannot be shown. Button images live in the');
          lines.push('!! younger-age bundles — log in as the kid who actually sees');
          lines.push('!! the broken exercise and reload.');
        }
        var byType = {};
        for (var i = 0; i < found.length; i++) {
          var k = found[i].type + '/' + found[i].field;
          byType[k] = (byType[k] || 0) + 1;
        }
        for (var key in byType) {
          if (Object.prototype.hasOwnProperty.call(byType, key)) lines.push('  ' + key + ': ' + byType[key]);
        }
        byId('creport').textContent = lines.join('\n');

        var limit = Math.min(found.length, 8);
        for (var j = 0; j < limit; j++) renderCase(found[j], j);
        setTimeout(measure, 1500);
      }

      for (var i = 0; i < list.length; i++) {
        (function (bundle) {
          var bid = bundle.id || bundle.bundle_id;
          xhrJson('/api/exercises/bundles/' + encodeURIComponent(bid), function (st, manifest) {
            if (st === 200 && manifest) collectImages(manifest, null, bid, 'root', found);
            pendingBundles--;
            if (pendingBundles === 0) finish();
          });
        })(list[i]);
      }
    });
  }

  describeEnv();
  runRealImages();

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
