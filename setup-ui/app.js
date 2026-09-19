/**
 * Setup wizard client — secrets stay in browser memory.
 * Never console.log passwords, tokens, or client secrets.
 */
(function () {
  'use strict';

  const STEPS = [
    'Target',
    'URL',
    'Auth',
    'Writes',
    'Test',
    'mcp.json',
    'Cheat sheet',
  ];

  const DUMMY = {
    baseUrl: 'http://127.0.0.1:9090/hcmRestApi',
    apiVersion: '11.13.18.05',
    authMode: 'basic',
    username: 'demo',
    password: 'demo',
  };

  let step = 0;
  let projectRoot = '';

  const $ = (id) => document.getElementById(id);
  const panels = () => [...document.querySelectorAll('.panel')];

  function selected(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : null;
  }

  function state() {
    return {
      target: selected('target') || 'dummy',
      baseUrl: ($('baseUrl').value || '').trim().replace(/\/+$/, ''),
      apiVersion: ($('apiVersion').value || '11.13.18.05').trim(),
      authMode: $('authMode').value,
      username: $('username').value,
      password: $('password').value,
      bearerToken: $('bearerToken').value,
      tokenUrl: ($('tokenUrl').value || '').trim(),
      clientId: ($('clientId').value || '').trim(),
      clientSecret: $('clientSecret').value,
      writeMode: selected('writeMode') === 'write',
      profile: ($('profile')?.value || '').trim(),
    };
  }

  /** Payload for API — includes secrets for proxy only; response must not echo them. */
  function testPayload() {
    const s = state();
    const p = {
      baseUrl: s.baseUrl,
      apiVersion: s.apiVersion,
      authMode: s.authMode,
    };
    if (s.authMode === 'basic') {
      p.username = s.username;
      p.password = s.password;
    } else if (s.authMode === 'bearer') {
      p.bearerToken = s.bearerToken;
    } else if (s.authMode === 'oauth') {
      p.tokenUrl = s.tokenUrl;
      p.clientId = s.clientId;
      p.clientSecret = s.clientSecret;
    }
    return p;
  }

  function applyDummyDefaults() {
    if (selected('target') !== 'dummy') return;

    $('baseUrl').value = DUMMY.baseUrl;
    $('apiVersion').value = DUMMY.apiVersion;
    $('authMode').value = DUMMY.authMode;
    $('username').value = DUMMY.username;
    $('password').value = DUMMY.password;
    syncAuthBlocks();
  }

  function syncAuthBlocks() {
    const mode = $('authMode').value;
    $('authBasic').classList.toggle('hidden', mode !== 'basic');
    $('authBearer').classList.toggle('hidden', mode !== 'bearer');
    $('authOauth').classList.toggle('hidden', mode !== 'oauth');
  }

  function buildEnvBlock(s) {
    const env = {
      ORACLE_HCM_BASE_URL: s.baseUrl,
      ORACLE_HCM_API_VERSION: s.apiVersion,
      ORACLE_HCM_AUTH: s.authMode,
    };
    if (s.profile) env.ORACLE_HCM_PROFILE = s.profile;
    if (s.authMode === 'basic') {
      env.ORACLE_HCM_USERNAME = s.username;
      env.ORACLE_HCM_PASSWORD = s.password;
    } else if (s.authMode === 'bearer') {
      env.ORACLE_HCM_BEARER_TOKEN = s.bearerToken;
    } else if (s.authMode === 'oauth') {
      env.ORACLE_HCM_TOKEN_URL = s.tokenUrl;
      env.ORACLE_HCM_CLIENT_ID = s.clientId;
      env.ORACLE_HCM_CLIENT_SECRET = s.clientSecret;
    }
    return env;
  }

  function mcpFragment(s) {
    const env = buildEnvBlock(s);
    const writeEnv = { ...env, ORACLE_HCM_WRITE: '1' };
    // Prefer local built entry when known; else npx package name.
    const entry =
      projectRoot
        ? { command: 'node', args: [`${projectRoot}/dist/index.js`] }
        : { command: 'npx', args: ['-y', 'oracle-hcm-mcp'] };
    const writeArgs =
      projectRoot
        ? [`${projectRoot}/dist/index.js`, '--write']
        : ['-y', 'oracle-hcm-mcp', '--write'];

    return {
      mcpServers: {
        'oracle-hcm': {
          command: entry.command,
          args: entry.args,
          env,
        },
        'oracle-hcm-write': {
          command: entry.command,
          args: writeArgs,
          env: writeEnv,
        },
      },
    };
  }

  function refreshMcpPreview() {
    const frag = mcpFragment(state());
    $('mcpJson').textContent = JSON.stringify(frag, null, 2);
  }

  function renderNav() {
    const nav = $('stepNav');
    nav.innerHTML = '';
    STEPS.forEach((label, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${i + 1}. ${label}`;
      if (i === step) b.classList.add('active');
      if (i < step) b.classList.add('done');
      b.addEventListener('click', () => go(i));
      nav.appendChild(b);
    });
    $('stepLabel').textContent = `Step ${step + 1} of ${STEPS.length}`;
    $('btnBack').disabled = step === 0;
    $('btnNext').textContent = step === STEPS.length - 1 ? 'Done' : 'Next';
  }

  function go(n) {
    if (n < 0 || n >= STEPS.length) return;
    if (n === 1) {
      const t = selected('target');
      if (t === 'dummy') applyDummyDefaults();
      if (t === 'sandbox' || t === 'prod') {
        if ($('profile')) $('profile').value = t;
        if (t === 'sandbox' && (!$('baseUrl').value || $('baseUrl').value === DUMMY.baseUrl)) {
          $('baseUrl').value = 'https://fa-xxxx-hcm-test.fa.ocs.oraclecloud.com/hcmRestApi';
        }
        if (t === 'prod' && (!$('baseUrl').value || $('baseUrl').value === DUMMY.baseUrl)) {
          $('baseUrl').value = 'https://fa-xxxx-hcm.fa.ocs.oraclecloud.com/hcmRestApi';
        }
        $('authMode').value = 'oauth';
        syncAuthBlocks();
      }
    }
    if (n === 5) {
      refreshMcpPreview();
      if (typeof refreshReinstall === 'function') refreshReinstall();
    }
    step = n;
    panels().forEach((p) => {
      p.classList.toggle('hidden', Number(p.dataset.step) !== step);
    });
    renderNav();
  }

  async function onTest() {
    const out = $('testResult');
    out.hidden = false;
    out.classList.remove('ok', 'fail');
    out.textContent = 'Probing… (secrets not logged)';
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload()),
      });
      const data = await res.json();
      out.classList.add(data.ok ? 'ok' : 'fail');
      out.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
      out.classList.add('fail');
      out.textContent = JSON.stringify(
        { ok: false, error: e instanceof Error ? e.message : 'request failed' },
        null,
        2,
      );
    }
  }

  async function onCopyMcp() {
    refreshMcpPreview();
    const text = $('mcpJson').textContent;
    try {
      await navigator.clipboard.writeText(text);
      $('envWriteMsg').hidden = false;
      $('envWriteMsg').textContent = 'Copied mcp.json fragment to clipboard.';
    } catch {
      $('envWriteMsg').hidden = false;
      $('envWriteMsg').textContent = 'Clipboard blocked — select the JSON and copy manually.';
    }
  }

  async function onWriteEnv() {
    const s = state();
    const body = { ...testPayload(), writeMode: s.writeMode };
    try {
      const res = await fetch('/api/write-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      $('envWriteMsg').hidden = false;
      $('envWriteMsg').textContent = data.ok
        ? `Wrote ${data.path} (gitignored). Secrets were not logged.`
        : `Write failed: ${data.error || res.status}`;
    } catch (e) {
      $('envWriteMsg').hidden = false;
      $('envWriteMsg').textContent =
        e instanceof Error ? e.message : 'Write request failed';
    }
  }

  function wire() {
    document.querySelectorAll('input[name="target"]').forEach((el) => {
      el.addEventListener('change', () => {
        if (el.value === 'dummy') applyDummyDefaults();
        else if (!$('baseUrl').value || $('baseUrl').value === DUMMY.baseUrl) {
          $('baseUrl').value = '';
          $('username').value = '';
          $('password').value = '';
        }
      });
    });
    $('authMode').addEventListener('change', syncAuthBlocks);
    $('btnTest').addEventListener('click', onTest);
    $('btnCopyMcp').addEventListener('click', onCopyMcp);
    $('btnWriteEnv').addEventListener('click', onWriteEnv);
    $('btnBack').addEventListener('click', () => go(step - 1));
    $('btnNext').addEventListener('click', () => {
      if (step >= STEPS.length - 1) return;
      go(step + 1);
    });
    ['baseUrl', 'apiVersion', 'authMode', 'username', 'password', 'bearerToken', 'tokenUrl', 'clientId', 'clientSecret']
      .forEach((id) => {
        const el = $(id);
        if (el) el.addEventListener('input', () => { if (step === 5) refreshMcpPreview(); });
        if (el) el.addEventListener('change', () => { if (step === 5) refreshMcpPreview(); });
      });
    document.querySelectorAll('input[name="writeMode"]').forEach((el) => {
      el.addEventListener('change', () => { if (step === 5) refreshMcpPreview(); });
    });
  }

  async function init() {
    wire();
    syncAuthBlocks();
    applyDummyDefaults();
    try {
      const res = await fetch('/api/meta');
      const meta = await res.json();
      projectRoot = meta.projectRoot || '';
    } catch {
      projectRoot = '';
    }
    go(0);
  }

  init();

  // v0.5 OAuth polish + multi-env + reinstall
  function refreshReinstall() {
    const s = state();
    const frag = mcpFragment(s);
    const steps = [
      '# Unofficial oracle-hcm-mcp — Cursor MCP reinstall (full tool set)',
      'npm run build',
      '# Paste the mcpServers JSON below into Cursor → MCP settings',
      '# Reload Cursor window',
      '# Confirm tools include hcm_smoke_probe, hcm_recipe_*, hcm_person_deep_read, …',
      '',
      JSON.stringify(frag, null, 2),
    ].join('\n');
    const el = $('reinstallSteps');
    if (el) el.textContent = steps;
  }


  $('btnOAuthRefresh')?.addEventListener('click', async () => {
    const out = $('oauthStatus');
    if (!out) return;
    out.hidden = false;
    out.textContent = 'Requesting token (secret not logged)…';
    try {
      const res = await fetch('/api/oauth-token-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload()),
      });
      const data = await res.json();
      out.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
      out.textContent = JSON.stringify({ ok: false, error: String(e) }, null, 2);
    }
  });

  $('btnTestAsUser')?.addEventListener('click', async () => {
    const out = $('oauthStatus') || $('testResult');
    if (!out) return;
    out.hidden = false;
    const username = ($('testAsUser')?.value || $('username')?.value || '').trim();
    if (!username) {
      out.textContent = JSON.stringify({ ok: false, error: 'Enter test-as-user username' }, null, 2);
      return;
    }
    const payload = testPayload();
    payload.authMode = 'basic';
    payload.username = username;
    payload.password = $('password')?.value || payload.password;
    out.textContent = 'Probing as ' + username + '…';
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      out.textContent = JSON.stringify({ testedAs: username, ...data }, null, 2);
    } catch (e) {
      out.textContent = JSON.stringify({ ok: false, error: String(e) }, null, 2);
    }
  });

  $('btnCopyReinstall')?.addEventListener('click', async () => {
    refreshReinstall();
    const text = $('reinstallSteps')?.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      alert('Reinstall steps copied');
    } catch {
      prompt('Copy:', text);
    }
  });

})();
