// Claude Sidebar - content script running on claude.ai
(function () {
  if (document.getElementById('__csb_root')) return;

  // ── Inject styles ──────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #__csb_root {
      position: fixed;
      top: 0; right: 0;
      width: 360px; height: 100vh;
      background: #ffffff;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 24px rgba(0,0,0,.08);
      display: flex; flex-direction: column;
      z-index: 2147483647;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      color: #111;
      transition: transform .25s ease;
    }
    #__csb_root.hidden { transform: translateX(100%); }

    #__csb_header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #f0f0f0;
      background: #fafafa;
      flex-shrink: 0;
    }
    #__csb_title {
      font-weight: 600; font-size: 14px;
      display: flex; align-items: center; gap: 8px;
    }
    #__csb_dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #d1d5db; flex-shrink: 0;
      transition: background .3s;
    }
    #__csb_dot.ok { background: #22c55e; }
    #__csb_dot.err { background: #ef4444; }

    #__csb_actions { display: flex; gap: 6px; }
    #__csb_clear, #__csb_close {
      background: none; border: none; cursor: pointer;
      color: #9ca3af; font-size: 18px; line-height: 1;
      padding: 2px 4px; border-radius: 4px;
    }
    #__csb_clear:hover, #__csb_close:hover { color: #374151; background: #f3f4f6; }

    #__csb_msgs {
      flex: 1; overflow-y: auto;
      padding: 14px; display: flex; flex-direction: column; gap: 10px;
    }
    .__csb_m {
      max-width: 86%; padding: 9px 13px;
      border-radius: 12px; font-size: 13px; line-height: 1.6;
      white-space: pre-wrap; word-break: break-word;
    }
    .__csb_u { align-self: flex-end; background: #e0e7ff; border-bottom-right-radius: 3px; }
    .__csb_b { align-self: flex-start; background: #f3f4f6; border-bottom-left-radius: 3px; }
    .__csb_sys { align-self: center; font-size: 11px; color: #9ca3af; font-style: italic; }

    #__csb_foot {
      padding: 10px 12px; border-top: 1px solid #f0f0f0;
      display: flex; gap: 8px; flex-shrink: 0;
      background: #fafafa;
    }
    #__csb_inp {
      flex: 1; resize: none;
      border: 1px solid #d1d5db; border-radius: 8px;
      padding: 8px 10px; font-size: 13px;
      font-family: inherit; line-height: 1.4;
      outline: none; max-height: 120px; overflow-y: auto;
      background: #fff;
    }
    #__csb_inp:focus { border-color: #6366f1; }
    #__csb_send {
      padding: 0 14px; height: 36px;
      background: #111; color: #fff;
      border: none; border-radius: 8px;
      font-size: 13px; font-weight: 500;
      cursor: pointer; white-space: nowrap;
      align-self: flex-end;
    }
    #__csb_send:disabled { opacity: .35; cursor: default; }
    #__csb_send:not(:disabled):hover { background: #374151; }

    /* Toggle button when sidebar is hidden */
    #__csb_toggle {
      position: fixed; top: 50%; right: 0;
      transform: translateY(-50%);
      background: #111; color: #fff;
      border: none; border-radius: 8px 0 0 8px;
      padding: 12px 8px; cursor: pointer;
      z-index: 2147483646; font-size: 18px;
      writing-mode: vertical-lr;
      display: none;
    }
    #__csb_toggle.visible { display: block; }
  `;
  document.head.appendChild(style);

  // ── Build DOM ──────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = '__csb_root';
  root.innerHTML = `
    <div id="__csb_header">
      <div id="__csb_title">
        <div id="__csb_dot"></div>
        Claude Sidebar
      </div>
      <div id="__csb_actions">
        <button id="__csb_clear" title="Clear chat">⌫</button>
        <button id="__csb_close" title="Close">✕</button>
      </div>
    </div>
    <div id="__csb_msgs"></div>
    <div id="__csb_foot">
      <textarea id="__csb_inp" rows="1" placeholder="Ask Claude anything… (Enter to send)"></textarea>
      <button id="__csb_send" disabled>Send</button>
    </div>
  `;
  document.body.appendChild(root);

  const toggle = document.createElement('button');
  toggle.id = '__csb_toggle';
  toggle.title = 'Open Claude Sidebar';
  toggle.textContent = '✦';
  document.body.appendChild(toggle);

  // ── State ──────────────────────────────────────────────────────────────────
  const dot    = document.getElementById('__csb_dot');
  const msgs   = document.getElementById('__csb_msgs');
  const inp    = document.getElementById('__csb_inp');
  const btn    = document.getElementById('__csb_send');
  let orgId    = null;
  let busy     = false;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function addMsg(cls, text) {
    const d = document.createElement('div');
    d.className = '__csb_m ' + cls;
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  function sys(text) { addMsg('__csb_sys', text); }

  // ── Init: resolve org ID ───────────────────────────────────────────────────
  fetch('/api/organizations', { credentials: 'include' })
    .then(r => r.json())
    .then(orgs => {
      orgId = orgs && orgs[0] && orgs[0].uuid;
      if (orgId) {
        dot.className = 'ok';
        btn.disabled = false;
        sys('Ready — type a message below');
      } else {
        dot.className = 'err';
        sys('Could not resolve org ID');
      }
    })
    .catch(e => {
      dot.className = 'err';
      sys('Error: ' + e.message);
    });

  // ── Send message ───────────────────────────────────────────────────────────
  async function send() {
    if (busy || !orgId) return;
    const text = inp.value.trim();
    if (!text) return;

    inp.value = '';
    inp.style.height = '';
    busy = true;
    btn.disabled = true;

    addMsg('__csb_u', text);
    const botEl = addMsg('__csb_b', '…');

    try {
      // 1. Create fresh conversation
      const conv = await fetch('/api/organizations/' + orgId + '/chat_conversations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', uuid: crypto.randomUUID() })
      }).then(r => r.json());

      // 2. Stream completion
      const res = await fetch(
        '/api/organizations/' + orgId + '/chat_conversations/' + conv.uuid + '/completion',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: text,
            parent_message_uuid: conv.current_leaf_message_uuid || '00000000-0000-4000-8000-000000000000',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            model: 'claude-sonnet-4-6',
            rendering_mode: 'messages',
            attachments: [], files: [], sync_sources: [],
            personalized_styles: [{
              type: 'default', key: 'Default', name: 'Normal',
              nameKey: 'normal_style_name', prompt: 'Normal\n',
              summary: 'Default responses from Claude',
              summaryKey: 'normal_style_summary', isDefault: true
            }]
          })
        }
      );

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      botEl.textContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data:')) {
            try {
              const j = JSON.parse(line.slice(5));
              if (j.type === 'content_block_delta' && j.delta?.text) {
                full += j.delta.text;
                botEl.textContent = full;
                msgs.scrollTop = msgs.scrollHeight;
              }
            } catch (_) {}
          }
        }
      }

      if (!full) botEl.textContent = '(empty response)';

    } catch (e) {
      botEl.textContent = 'Error: ' + e.message;
    }

    busy = false;
    btn.disabled = false;
    inp.focus();
  }

  // ── UI events ──────────────────────────────────────────────────────────────
  btn.addEventListener('click', send);

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    setTimeout(() => {
      inp.style.height = 'auto';
      inp.style.height = Math.min(inp.scrollHeight, 120) + 'px';
    });
  });

  document.getElementById('__csb_close').addEventListener('click', () => {
    root.classList.add('hidden');
    toggle.classList.add('visible');
  });

  toggle.addEventListener('click', () => {
    root.classList.remove('hidden');
    toggle.classList.remove('visible');
  });

  document.getElementById('__csb_clear').addEventListener('click', () => {
    msgs.innerHTML = '';
    sys('Chat cleared');
  });

  // Listen for toggle from popup button
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'toggle') {
      const hidden = root.classList.toggle('hidden');
      toggle.classList.toggle('visible', hidden);
    }
  });

})();