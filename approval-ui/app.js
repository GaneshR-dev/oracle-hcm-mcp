(function () {
  const $ = (id) => document.getElementById(id);
  async function callTool(name, args) {
    const base = $('base').value.replace(/\/+$/, '');
    const res = await fetch(base + '/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name, arguments: args || {} },
      }),
    });
    const data = await res.json();
    const text = data?.result?.content?.find((c) => c.type === 'text')?.text;
    return text ? JSON.parse(text) : data;
  }

  async function refresh() {
    const status = $('status');
    status.hidden = false;
    status.textContent = 'Loading…';
    try {
      // Prefer REST helper on HTTP transport
      const base = $('base').value.replace(/\/+$/, '');
      let pending = [];
      try {
        const r = await fetch(base + '/approvals');
        if (r.ok) {
          const j = await r.json();
          pending = j.pending || [];
        } else {
          const j = await callTool('hcm_list_pending_approvals', {});
          pending = j.pending || j.items || [];
        }
      } catch {
        const j = await callTool('hcm_list_pending_approvals', {});
        pending = j.pending || j.items || [];
      }
      status.textContent = JSON.stringify({ count: pending.length }, null, 2);
      const ul = $('list');
      ul.innerHTML = '';
      if (!pending.length) {
        ul.innerHTML = '<li class="meta">No pending approvals.</li>';
        return;
      }
      for (const p of pending) {
        const id = p.approval_id || p.approvalId;
        const li = document.createElement('li');
        li.innerHTML =
          '<div><strong>' +
          (p.tool || p.toolName || '?') +
          '</strong></div>' +
          '<div class="meta">' +
          (p.summary || '') +
          '</div>' +
          '<div class="meta">id: ' +
          id +
          (p.expires_at ? ' · expires ' + p.expires_at : '') +
          '</div>';
        const actions = document.createElement('div');
        actions.className = 'actions';
        const approve = document.createElement('button');
        approve.className = 'btn primary';
        approve.textContent = 'Approve';
        approve.onclick = async () => {
          approve.disabled = true;
          try {
            await callTool('hcm_approve_write', { approval_id: id });
            await refresh();
          } catch (e) {
            status.textContent = String(e);
          }
        };
        const deny = document.createElement('button');
        deny.className = 'btn danger';
        deny.textContent = 'Deny';
        deny.onclick = async () => {
          deny.disabled = true;
          try {
            await callTool('hcm_deny_write', { approval_id: id });
            await refresh();
          } catch (e) {
            status.textContent = String(e);
          }
        };
        actions.append(approve, deny);
        li.append(actions);
        ul.append(li);
      }
    } catch (e) {
      status.textContent = e instanceof Error ? e.message : String(e);
    }
  }

  $('refresh').addEventListener('click', refresh);
  refresh();
})();
