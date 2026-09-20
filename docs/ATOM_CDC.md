# Atom CDC — official atomservlet

Unofficial change detection over Fusion **Atom servlet** feeds. **Not** Oracle CDC product parity.

Official path (not under `resources/`):

```
{ORACLE_HCM_BASE_URL}/atomservlet/{workspace}/{collection}
```

Catalog:

- `employee/newhire`, `employee/empassignment`, `employee/empupdate`, `employee/payupdate`, `employee/termination`
- `workstructures/grades`, `workstructures/jobs`, `workstructures/locations`, `workstructures/positions`

Default tool collection `all` maps to `employee/empupdate`. Invented names (`atomfeeds`, `workers` as a feed) are rejected.

## Dummy

```bash
npm run dummy-hcm
# GET /hcmRestApi/atomservlet/employee/empupdate
# tools: hcm_list_atom_feeds → hcm_atom_poll → hcm_atom_replay → hcm_atom_consume
```

## Real pod

1. Set `ORACLE_HCM_BASE_URL` to a **non-prod** pod.
2. `hcm_list_atom_feeds` then `hcm_atom_poll` with `collection=empupdate`.
3. `hcm_atom_replay` to validate parsers without advancing checkpoint.
4. `hcm_atom_consume` to advance `ORACLE_HCM_ATOM_CHECKPOINT_PATH`.

See also tool `hcm_atom_real_pod_guide`.

`hcm_atom_cdc_status` reports durable cursor store path + checkpoints.
