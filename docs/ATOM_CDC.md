# Atom CDC — dummy first, real-pod hooks

Unofficial change detection over Fusion-style `atomfeeds`. **Not** Oracle CDC product parity.

## Dummy

```bash
npm run dummy-hcm
# tools: hcm_atom_poll → hcm_atom_replay → hcm_atom_consume
```

## Real pod

1. Set `ORACLE_HCM_BASE_URL` to a **non-prod** pod.
2. `hcm_smoke_probe` — expect `atomfeeds` **200** (or **403** if duty roles missing; **404** if collection absent).
3. `hcm_list_atom_feeds` / `hcm_atom_poll`.
4. `hcm_atom_replay` to validate parsers without advancing checkpoint.
5. `hcm_atom_consume` to advance `ORACLE_HCM_ATOM_CHECKPOINT_PATH`.

See also tool `hcm_atom_real_pod_guide`.
