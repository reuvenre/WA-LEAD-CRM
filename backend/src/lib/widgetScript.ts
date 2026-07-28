// The embeddable chat widget, served as a string from GET /widget.js so it's always
// part of the compiled bundle (no reliance on the Docker image shipping a /public dir).
// Vanilla JS, Shadow DOM (style isolation from the host site), RTL Hebrew, 4s polling.
// It reads its tenant key from the <script data-key> tag and the API base from its own src.

// The marketing site the credit line links back to. Resolved at import time from the
// same env the rest of the backend uses, then substituted into the script body — the
// widget runs on the CUSTOMER's domain, so it can't infer our site from its own origin.
const SITE_URL = (process.env.FRONTEND_URL || 'https://wa-lead-crm.vercel.app')
  .split(',')[0]
  .replace(/\/+$/, '');

const WIDGET_JS_TEMPLATE = String.raw`(function () {
  var script = document.currentScript;
  if (!script) return;
  var KEY = script.getAttribute('data-key');
  if (!KEY) { console.warn('[wa-widget] missing data-key'); return; }
  var BASE;
  var SITE = '__SITE_URL__';
  try { BASE = new URL(script.src).origin; } catch (e) { return; }

  var VKEY = 'wa_widget_visitor';
  var visitorId = localStorage.getItem(VKEY);
  if (!visitorId) {
    // The visitorId is a bearer identifier for this visitor's transcript — always
    // derive it from a CSPRNG (getRandomValues fallback covers pre-randomUUID browsers).
    if (window.crypto && crypto.randomUUID) {
      visitorId = 'v_' + crypto.randomUUID().replace(/-/g, '');
    } else if (window.crypto && crypto.getRandomValues) {
      var buf = new Uint8Array(16); crypto.getRandomValues(buf);
      visitorId = 'v_' + Array.prototype.map.call(buf, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    } else {
      visitorId = 'v_' + (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    }
    localStorage.setItem(VKEY, visitorId);
  }

  var config = { title: 'צ׳אט', greeting: '', color: '#25D366', branded: true };
  // lastTs (the poll cursor) is advanced ONLY from server-supplied timestamps: the
  // visitor's clock may be minutes off, and a locally-stamped cursor either hides
  // agent replies (fast clock) or duplicates messages (slow clock).
  var ready = false, open = false, lastTs = null, pollTimer = null, seen = {}, pendingEcho = {};

  function api(path, opts) {
    return fetch(BASE + '/api/widget' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts))
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'error'); return d; }); });
  }

  // ── Shadow DOM host ──
  var host = document.createElement('div');
  host.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:2147483000;';
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });

  var style = document.createElement('style');
  style.textContent = [
    ':host,*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Rubik,Arial,sans-serif}',
    '.bubble{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.25);transition:transform .15s}',
    '.bubble:hover{transform:scale(1.06)}',
    '.bubble svg{width:28px;height:28px}',
    '.panel{position:absolute;bottom:70px;left:0;width:340px;max-width:calc(100vw - 40px);height:460px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;direction:rtl}',
    '.panel.open{display:flex}',
    '.hd{padding:14px 16px;color:#fff;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:space-between}',
    '.hd button{background:transparent;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;opacity:.9}',
    '.feed{flex:1;overflow-y:auto;padding:12px;background:#f5f7fb;display:flex;flex-direction:column;gap:6px}',
    '.msg{max-width:80%;padding:8px 11px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}',
    '.msg.them{align-self:flex-start;background:#fff;color:#1e293b;border-top-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.08)}',
    '.msg.me{align-self:flex-end;color:#fff;border-top-right-radius:4px}',
    '.ftr{display:flex;gap:6px;padding:10px;border-top:1px solid #eef0f4;background:#fff}',
    '.ftr input{flex:1;border:1px solid #e3e7ee;border-radius:10px;padding:9px 11px;font-size:14px;outline:none}',
    '.ftr button{border:none;border-radius:10px;color:#fff;padding:0 14px;cursor:pointer;font-weight:600;font-size:14px}',
    '.pw{display:block;font-size:10px;color:#9aa4b2;text-align:center;padding:4px;text-decoration:none}'
  ].join('');
  root.appendChild(style);

  var bubble = document.createElement('button');
  bubble.className = 'bubble';
  bubble.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.03 2 11c0 2.4 1.04 4.58 2.75 6.2L4 22l5.1-1.34C10 20.87 11 21 12 21c5.52 0 10-4.03 10-9s-4.48-10-10-10z"/></svg>';
  root.appendChild(bubble);

  var panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML =
    '<div class="hd"><span class="ttl"></span><button aria-label="close">×</button></div>' +
    '<div class="feed"></div>' +
    '<div class="ftr"><input type="text" placeholder="הקלד הודעה..." /><button>שלח</button></div>' +
    '<a class="pw" target="_blank" rel="noopener" href="' + SITE + '/?utm_source=widget&utm_medium=referral">מופעל ע״י Real Estate Lead CRM</a>';
  root.appendChild(panel);

  var feed = panel.querySelector('.feed');
  var input = panel.querySelector('input');
  var sendBtn = panel.querySelector('.ftr button');
  var closeBtn = panel.querySelector('.hd button');
  var titleEl = panel.querySelector('.ttl');

  function applyConfig() {
    bubble.style.background = config.color;
    panel.querySelector('.hd').style.background = config.color;
    sendBtn.style.background = config.color;
    titleEl.textContent = config.title;
    // PRO tenants pay to drop the credit; everyone else keeps the backlink.
    var pw = panel.querySelector('.pw');
    if (pw) pw.style.display = config.branded === false ? 'none' : 'block';
  }

  function bumpCursor(ts) { if (ts && (!lastTs || ts > lastTs)) lastTs = ts; }

  // Render a message. Server-sourced messages (poll / session / POST response) carry
  // an id + server timestamp and advance the cursor; the optimistic local echo does
  // neither (its clock-skewed timestamp must never become the cursor).
  function addMsg(m) {
    if (m.id && seen[m.id]) { bumpCursor(m.timestamp); return; }
    if (m.id) seen[m.id] = 1;
    bumpCursor(m.id ? m.timestamp : null);
    // The server copy of a message we just echoed locally: dedupe by content.
    if (m.id && m.direction === 'inbound' && pendingEcho[m.content]) {
      pendingEcho[m.content]--;
      if (!pendingEcho[m.content]) delete pendingEcho[m.content];
      return;
    }
    var el = document.createElement('div');
    // From the visitor's view: their own messages are stored 'inbound'; agent = 'outbound'.
    el.className = 'msg ' + (m.direction === 'inbound' ? 'me' : 'them');
    if (m.direction === 'inbound') el.style.background = config.color;
    el.textContent = m.content;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
  }

  function startSession() {
    if (ready) return;
    api('/session', { method: 'POST', body: JSON.stringify({ key: KEY, visitorId: visitorId }) })
      .then(function (d) {
        config = d.config; applyConfig(); ready = true;
        if (d.messages && d.messages.length) d.messages.forEach(addMsg);
        else if (config.greeting) { var g = document.createElement('div'); g.className = 'msg them'; g.textContent = config.greeting; feed.appendChild(g); }
        feed.scrollTop = feed.scrollHeight;
      })
      .catch(function () { var g = document.createElement('div'); g.className = 'msg them'; g.textContent = 'הצ׳אט אינו זמין כרגע.'; feed.appendChild(g); });
  }

  function poll() {
    if (!ready) return;
    var q = '/messages?key=' + encodeURIComponent(KEY) + '&visitorId=' + encodeURIComponent(visitorId) + (lastTs ? '&after=' + encodeURIComponent(lastTs) : '');
    api(q, { method: 'GET' }).then(function (arr) { (arr || []).forEach(addMsg); }).catch(function () {});
  }

  function send() {
    var text = input.value.trim();
    if (!text || !ready) return;
    input.value = '';
    pendingEcho[text] = (pendingEcho[text] || 0) + 1;
    addMsg({ content: text, direction: 'inbound' }); // local echo — no id, no cursor bump
    api('/message', { method: 'POST', body: JSON.stringify({ key: KEY, visitorId: visitorId, content: text }) })
      .then(function (d) {
        if (d.message && d.message.id) {
          seen[d.message.id] = 1; bumpCursor(d.message.timestamp);
          // The POST response settles this echo — balance the counter so a later
          // identical message isn't wrongly swallowed.
          if (pendingEcho[text]) { pendingEcho[text]--; if (!pendingEcho[text]) delete pendingEcho[text]; }
        }
      })
      .catch(function () {});
  }

  function openPanel() {
    open = true; panel.classList.add('open');
    startSession();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, 4000);
    setTimeout(function () { input.focus(); }, 50);
  }
  function closePanel() { open = false; panel.classList.remove('open'); if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  bubble.addEventListener('click', function () { open ? closePanel() : openPanel(); });
  closeBtn.addEventListener('click', closePanel);
  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  // Pause polling when the tab is hidden.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
    else if (open && !pollTimer) { pollTimer = setInterval(poll, 4000); poll(); }
  });
})();`;

export const WIDGET_JS = WIDGET_JS_TEMPLATE.replace(/__SITE_URL__/g, SITE_URL);
