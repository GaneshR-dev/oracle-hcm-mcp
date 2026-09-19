(function () {
  const $ = (id) => document.getElementById(id);
  let lastPending = [];

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

  function domainOf(tool) {
    const n = String(tool || '').toLowerCase();
    if (n.includes('absence') || n.includes('entitlement') || n.includes('accrual')) return 'absence';
    if (n.includes('worker') || n.includes('assignment') || n.includes('transfer') || n.includes('terminate') || n.includes('promote') || n.includes('contingent')) return 'worker';
    if (n.includes('learning') || n.includes('goal')) return 'learning';
    if (n.includes('compensat') || n.includes('salary') || n.includes('payroll') || n.includes('element')) return 'compensation';
    if (n.includes('document')) return 'documents';
    if (n.includes('journey') || n.includes('checklist')) return 'journeys';
    if (n.includes('feedback') || n.includes('check_in') || n.includes('review') || n.includes('performance')) return 'performance';
    if (n.includes('benefit')) return 'benefits';
    if (n.includes('recruit') || n.includes('candidate') || n.includes('offer')) return 'recruiting';
    if (n.includes('webhook') || n.includes('atom') || n.includes('allowlist') || n.includes('profile')) return 'platform';
    return 'other';
  }

  async function refresh() {
    const status = $('status');
    status.hidden = false;
    status.textContent = 'Loading…';
    try {
      const base = $('base').value.replace(/\/+$/, '');
      const domain = $('domain').value;
      let pending = [];
      try {
        const j = await callTool('hcm_list_pending_approvals_by_domain', domain ? { domain } : {});
        pending = j.pending || [];
      } catch {
        try {
          const r = await fetch(base + '/approvals');
          if (r.ok) {
            const j = await r.json();
            pending = (j.pending || []).map((p) => ({
              ...p,
              domain: domainOf(p.tool || p.toolName),
            }));
            if (domain) pending = pending.filter((p) => p.domain === domain);
          } else {
            const j = await callTool('hcm_list_pending_approvals', {});
            pending = (j.pending || j.items || []).map((p) => ({
              ...p,
              domain: domainOf(p.tool || p.toolName),
            }));
            if (domain) pending = pending.filter((p) => p.domain === domain);
          }
        } catch {
          const j = await callTool('hcm_list_pending_approvals', {});
          pending = (j.pending || j.items || []).map((p) => ({
            ...p,
            domain: domainOf(p.tool || p.toolName),
          }));
          if (domain) pending = pending.filter((p) => p.domain === domain);
        }
      }
      lastPending = pending;
      status.textContent = JSON.stringify({ count: pending.length, domain: domain || 'all' }, null, 2);
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
          '</strong> <span class="meta">[' +
          (p.domain || domainOf(p.tool || p.toolName)) +
          ']</span></div>' +
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
  $('domain').addEventListener('change', refresh);
  $('bulkApprove').addEventListener('click', async () => {
    const ids = lastPending.map((p) => p.approval_id || p.approvalId).filter(Boolean);
    if (!ids.length) {
      $('status').textContent = 'Nothing to approve';
      return;
    }
    $('status').hidden = false;
    $('status').textContent = 'Bulk approving ' + ids.length + '…';
    try {
      const r = await callTool('hcm_bulk_approve_writes', { approvalIds: ids });
      $('status').textContent = JSON.stringify(r, null, 2);
      await refresh();
    } catch (e) {
      $('status').textContent = String(e);
    }
  });
  $('exportAudit').addEventListener('click', async () => {
    try {
      const r = await callTool('hcm_export_approval_audit', { limit: 200 });
      const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'hcm-approval-audit-' + Date.now() + '.json';
      a.click();
      $('status').hidden = false;
      $('status').textContent = 'Exported audit JSON (' + (r.audit?.length || 0) + ' events)';
    } catch (e) {
      $('status').hidden = false;
      $('status').textContent = String(e);
    }
  });
  refresh();
})();
