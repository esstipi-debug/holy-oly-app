/* Holy Oly · medallas — SVG procedural (oro/plata/bronce, cinta azul/blanca)
   + registro de competencias en localStorage. Compartido por coach y atleta. */
(function () {
  var METALS = {
    oro:    { rim: ['#ffedb0', '#d59b2c', '#875812'], face: ['#fff8da', '#f6c94f', '#a96d12'], plate: ['#b78c2c', '#946818'], sheen: '#fff6d8', sw: '#e7b53a', name: 'Oro' },
    plata:  { rim: ['#f4f7fa', '#abb7c3', '#5d6975'], face: ['#ffffff', '#cad3dd', '#717e8c'], plate: ['#aab4bf', '#8b97a4'], sheen: '#ffffff', sw: '#b9c2cc', name: 'Plata' },
    bronce: { rim: ['#eec197', '#b1713b', '#693b18'], face: ['#f8d6b1', '#d18a4f', '#7d451a'], plate: ['#b07a48', '#8a5a2e'], sheen: '#ffe3c6', sw: '#c07f49', name: 'Bronce' }
  };
  var uid = 0;

  function HOmedal(key, S) {
    var m = METALS[key] || METALS.oro, id = 'md' + (uid++);
    var defs = '<defs>'
      + '<radialGradient id="f' + id + '" cx="38%" cy="30%" r="78%"><stop offset="0" stop-color="' + m.face[0] + '"/><stop offset="45%" stop-color="' + m.face[1] + '"/><stop offset="100%" stop-color="' + m.face[2] + '"/></radialGradient>'
      + '<linearGradient id="r' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + m.rim[0] + '"/><stop offset="50%" stop-color="' + m.rim[1] + '"/><stop offset="100%" stop-color="' + m.rim[2] + '"/></linearGradient>'
      + '<radialGradient id="p' + id + '" cx="50%" cy="50%" r="62%"><stop offset="0" stop-color="' + m.plate[0] + '"/><stop offset="100%" stop-color="' + m.plate[1] + '"/></radialGradient>'
      + '</defs>';
    // cinta (rayas azul/blanca), detrás del disco
    var rx = 21, rw = 22, ry = 1, rh = 36, cols = ['#1f47bf', '#fbfcfe', '#1f47bf', '#fbfcfe', '#1f47bf'], sw = rw / cols.length, rib = '';
    cols.forEach(function (c, i) { rib += '<rect x="' + (rx + i * sw).toFixed(2) + '" y="' + ry + '" width="' + (sw + 0.3).toFixed(2) + '" height="' + rh + '" fill="' + c + '"/>'; });
    rib += '<rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" fill="none" stroke="#0e2a73" stroke-width="0.6" stroke-opacity=".45"/>';
    // disco
    var cx = 32, cy = 54, r = 24;
    var disc = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#r' + id + ')"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#000" stroke-width="0.5" stroke-opacity=".35"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.84).toFixed(2) + '" fill="url(#f' + id + ')"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.5).toFixed(2) + '" fill="url(#p' + id + ')"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.5).toFixed(2) + '" fill="none" stroke="#000" stroke-width="1.6" stroke-opacity=".14"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.5).toFixed(2) + '" fill="none" stroke="' + m.sheen + '" stroke-width="0.7" stroke-opacity=".5"/>';
    return '<svg viewBox="0 0 64 80" width="' + S + '" height="' + (S * 1.25).toFixed(0) + '" style="display:block">' + defs + rib + disc + '</svg>';
  }

  // ── registro (localStorage) ──
  var KEY = 'ho_medals';
  function HOmedalsGet() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function HOmedalsSet(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function HOmedalsAdd(rec) { var a = HOmedalsGet(); a.unshift(rec); HOmedalsSet(a); return a; }
  function HOmedalsCount() { var c = { oro: 0, plata: 0, bronce: 0 }, a = HOmedalsGet(); a.forEach(function (r) { if (c[r.medal] != null) c[r.medal]++; }); return c; }
  function HOmedalsSeed() {
    if (localStorage.getItem(KEY)) return;
    HOmedalsSet([
      { comp: 'Nacional Absoluto', date: '2026-03', cat: '−81', medal: 'oro', sn: 128, cj: 160, place: '1º' },
      { comp: 'Apertura Regional', date: '2025-11', cat: '−81', medal: 'plata', sn: 122, cj: 152, place: '2º' }
    ]);
  }

  window.HOmedal = HOmedal;
  window.HOmedalsGet = HOmedalsGet;
  window.HOmedalsSet = HOmedalsSet;
  window.HOmedalsAdd = HOmedalsAdd;
  window.HOmedalsCount = HOmedalsCount;
  window.HOmedalsSeed = HOmedalsSeed;
  window.HO_METAL_NAMES = { oro: 'Oro', plata: 'Plata', bronce: 'Bronce' };
})();
