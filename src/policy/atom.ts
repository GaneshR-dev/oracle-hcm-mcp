/**
 * Official Fusion HCM Atom feeds live under /hcmRestApi/atomservlet/{workspace}/{collection},
 * not under resources/{version}/. Catalog from
 * https://docs.oracle.com/en/cloud/saas/human-resources/farws/Employee_Atom_Feeds.html
 * and Workstructures_Atom_Feeds.html
 */

export type AtomFeedDef = {
  workspace: string;
  collection: string;
  title: string;
};

export const ATOM_FEEDS: AtomFeedDef[] = [
  { workspace: 'employee', collection: 'newhire', title: 'New hire / rehire' },
  { workspace: 'employee', collection: 'empassignment', title: 'Assignment changes' },
  { workspace: 'employee', collection: 'empupdate', title: 'Person / employee updates' },
  { workspace: 'employee', collection: 'payupdate', title: 'Payroll assignment updates' },
  { workspace: 'employee', collection: 'termination', title: 'Terminations' },
  { workspace: 'employee', collection: 'workrelshipupdate', title: 'Work relationship updates' },
  { workspace: 'workstructures', collection: 'grades', title: 'Grades' },
  { workspace: 'workstructures', collection: 'jobs', title: 'Jobs' },
  { workspace: 'workstructures', collection: 'locations', title: 'Locations' },
  { workspace: 'workstructures', collection: 'positions', title: 'Positions' },
  { workspace: 'workstructures', collection: 'position', title: 'Position (singular feed name)' },
];

const TOKEN = /^[A-Za-z][A-Za-z0-9_]*$/;

export function atomFeedId(workspace: string, collection: string): string {
  return `atom:${workspace}/${collection}`;
}

export function resolveAtomFeed(input?: string): AtomFeedDef {
  const raw = (input ?? '').trim();
  if (!raw || raw === 'all') {
    return ATOM_FEEDS.find((f) => f.workspace === 'employee' && f.collection === 'empupdate')!;
  }
  const slash = raw.indexOf('/');
  let workspace: string;
  let collection: string;
  if (slash > 0) {
    workspace = raw.slice(0, slash);
    collection = raw.slice(slash + 1);
  } else {
    const hits = ATOM_FEEDS.filter((f) => f.collection === raw);
    if (hits.length === 1) return hits[0]!;
    if (hits.length > 1) {
      throw new Error(
        `Ambiguous Atom collection '${raw}'. Specify workspace/collection. Official: ${ATOM_FEEDS.map((f) => `${f.workspace}/${f.collection}`).join(', ')}`,
      );
    }
    throw new Error(
      `Unknown Atom collection '${raw}'. Official Fusion feeds: ${ATOM_FEEDS.map((f) => `${f.workspace}/${f.collection}`).join(', ')}`,
    );
  }
  if (!TOKEN.test(workspace) || !TOKEN.test(collection)) {
    throw new Error(`Invalid Atom path: ${raw}`);
  }
  const found = ATOM_FEEDS.find((f) => f.workspace === workspace && f.collection === collection);
  if (!found) {
    throw new Error(
      `Unknown Atom feed ${workspace}/${collection}. Official: ${ATOM_FEEDS.map((f) => `${f.workspace}/${f.collection}`).join(', ')}`,
    );
  }
  return found;
}

export function assertAtomTokens(workspace: string, collection: string, entryId?: string): void {
  if (!TOKEN.test(workspace) || !TOKEN.test(collection)) {
    throw new Error('Invalid Atom workspace/collection');
  }
  if (!ATOM_FEEDS.some((f) => f.workspace === workspace && f.collection === collection)) {
    throw new Error(
      `Unknown Atom feed ${workspace}/${collection}. Official: ${ATOM_FEEDS.map((f) => `${f.workspace}/${f.collection}`).join(', ')}`,
    );
  }
  if (entryId != null && (entryId.includes('/') || entryId.includes('\\') || entryId.includes('..') || entryId.includes('\0'))) {
    throw new Error('Invalid Atom entry id');
  }
}
