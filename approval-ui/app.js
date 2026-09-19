(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let lastPending = [];

  function token() {
    return ($('token').value || '').trim();
  }

  function authHeaders(extra) {
    const h = Object.assign({ Accept: 'application/json' }, extra || {});
    const t = token();
    if (t) {
      h.Authorization = 'Bearer ' + t;
      h['X-HCM-Token'] = t;
    }
    return h;
  }

  function text(el, value) {
    el.textContent = value == null ? '' : String(value);
    return el;
  }

  async function callTool(name, args) {
    const base = $('base').value.replace(/\/+$/, '');
    const res = await fetch(base + '/mcp', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name, arguments: args || {} },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText || String(res.status));
    const raw = data?.result?.content?.find((c) => c.type === 'text')?.text;
    return raw ? JSON.parse(raw) : data;
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

  async function restJson(path, opts) {
    const base = $('base').value.replace(/\/+$/, '');
    const res = await fetch(base + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText || String(res.status));
    return data;
  }

  async function refresh() {
    const status = $('status');
    status.hidden = false;
    status.textContent = 'Loading…';
    try {
      const domain = $('domain').value;
      let pending = [];
      try {
        const j = await restJson('/approvals', { headers: authHeaders() });
        pending = (j.pending || []).map((p) => ({
          approval_id: p.approval_id || p.approvalId,
          tool: p.tool || p.toolName,
          summary: p.summary,
          expires_at: p.expires_at,
          domain: domainOf(p.tool || p.toolName),
        }));
        if (domain) pending = pending.filter((p) => p.domain === domain);
      } catch {
        const j = await callTool('hcm_list_pending_approvals', {});
        pending = (j.pending || j.items || []).map((p) => ({
          approval_id: p.approval_id || p.approvalId,
          tool: p.tool || p.toolName,
          summary: p.summary,
          expires_at: p.expires_at,
          domain: domainOf(p.tool || p.toolName),
        }));
        if (domain) pending = pending.filter((p) => p.domain === domain);
      }
      lastPending = pending;
      status.textContent = JSON.stringify({ count: pending.length, domain: domain || 'all' }, null, 2);
      const ul = $('list');
      ul.replaceChildren();
      if (!pending.length) {
        const li = document.createElement('li');
        li.className = 'meta';
        text(li, 'No pending approvals.');
        ul.appendChild(li);
        return;
      }
      for (const p of pending) {
        const id = p.approval_id;
        const li = document.createElement('li');
        const title = document.createElement('div');
        const strong = document.createElement('strong');
        text(strong, p.tool || '?');
        const domainSpan = document.createElement('span');
        domainSpan.className = 'meta';
        text(domainSpan, ' [' + (p.domain || domainOf(p.tool)) + ']');
        title.append(strong, domainSpan);
        const summary = document.createElement('div');
        summary.className = 'meta';
        text(summary, p.summary || '');
        const meta = document.createElement('div');
        meta.className = 'meta';
        text(meta, 'id: ' + id + (p.expires_at ? ' · expires ' + p.expires_at : ''));
        const actions = document.createElement('div');
        actions.className = 'actions';
        const approve = document.createElement('button');
        approve.className = 'btn primary';
        approve.type = 'button';
        text(approve, 'Approve');
        approve.addEventListener('click', async () => {
          approve.disabled = true;
          try {
            await restJson('/approvals/' + encodeURIComponent(id) + '/approve', {
              method: 'POST',
              headers: authHeaders({ 'Content-Type': 'application/json' }),
              body: '{}',
            });
            await refresh();
          } catch (e) {
            status.textContent = String(e);
            approve.disabled = false;
          }
        });
        const deny = document.createElement('button');
        deny.className = 'btn danger';
        deny.type = 'button';
        text(deny, 'Deny');
        deny.addEventListener('click', async () => {
          deny.disabled = true;
          try {
            await restJson('/approvals/' + encodeURIComponent(id) + '/deny', {
              method: 'POST',
              headers: authHeaders({ 'Content-Type': 'application/json' }),
              body: '{}',
            });
            await refresh();
          } catch (e) {
            status.textContent = String(e);
            deny.disabled = false;
          }
        });
        actions.append(approve, deny);
        li.append(title, summary, meta, actions);
        ul.append(li);
      }
    } catch (e) {
      status.textContent = e instanceof Error ? e.message : String(e);
    }
  }

  $('refresh').addEventListener('click', refresh);
  $('domain').addEventListener('change', refresh);
  $('bulkApprove').addEventListener('click', async () => {
    const ids = lastPending.map((p) => p.approval_id).filter(Boolean);
    if (!ids.length) {
      $('status').textContent = 'Nothing to approve';
      return;
    }
    $('status').hidden = false;
    $('status').textContent = 'Bulk approving ' + ids.length + '…';
    try {
      const r = await restJson('/approvals/bulk-approve', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ids }),
      });
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
