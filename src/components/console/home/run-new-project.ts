import { rowsToTags, type TagRow } from '@/lib/entity-tags';
import { orgIdFromCreateResponse, uploadOrgThumbnail } from '@/lib/org-project-api';

export const PROJECT_EXTENSIONS = [
  'breakdown',
  'elements',
  'ols',
  'scenebreakdown',
  'data',
  'schd',
] as const;

export type PortfolioChoice =
  | { mode: 'existing'; portfolioId: string; portfolioName: string }
  | { mode: 'new'; portfolioName: string };

export type NewProjectDraft = {
  projectName: string;
  projectType: string;
  description: string;
  tags: string[];
  thumbnail: File | null;
  portfolio: PortfolioChoice;
  guestEmails: string;
};

export type SetupProgress = {
  portfolioId?: string;
  adminTeamId?: string;
  staffTeamId?: string;
  staffCreated?: boolean;
  orgId?: string;
  thumbnailDone?: boolean;
  installed: string[];
  grantsDone?: boolean;
  invited: string[];
};

export type SetupResult = {
  portfolioId: string;
  orgId: string;
  projectName: string;
  invitesSkipped: boolean;
};

const emptyProgress = (): SetupProgress => ({ installed: [], invited: [] });

const apiBase = () => import.meta.env.VITE_API_URL as string;

async function authFetch(path: string, method: string, body?: unknown) {
  const response = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${sessionStorage.accessToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || 'The setup could not be completed.');
  }
  return payload;
}

export function parseGuestEmails(raw: string): string[] {
  const unique = [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const invalid = unique.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (invalid.length > 0) {
    throw new Error(`Check these email addresses: ${invalid.join(', ')}`);
  }
  return unique;
}

function documentsFromFunnel(body: { document?: { document?: Record<string, string> }[] }) {
  const steps = Array.isArray(body?.document) ? body.document : [];
  return steps
    .map((step) => step?.document)
    .filter((document): document is Record<string, string> => !!document && !!document._id);
}

export function idsFromPortfolioCreate(body: { document?: { document?: Record<string, string> }[] }) {
  const documents = documentsFromFunnel(body);
  const portfolio = documents.find((document) => document.type === 'portfolio');
  const admin = documents.find((document) => document.type === 'team');
  if (!portfolio?._id || !admin?._id) {
    throw new Error('The portfolio was created but its team id was missing.');
  }
  return { portfolioId: portfolio._id, adminTeamId: admin._id };
}

export function idFromTeamCreate(body: { document?: { document?: Record<string, string> }[] }) {
  const team = documentsFromFunnel(body).find((document) => document.type === 'team');
  if (!team?._id) {
    throw new Error('The staff team was created but its id was missing.');
  }
  return team._id;
}

type CoreTeam = { team_id: string; name: string } | null;

async function loadCoreTeams(portfolioId: string) {
  const payload = await authFetch(`/_auth/portfolios/${portfolioId}/core-teams`, 'GET');
  const document = payload.document || {};
  return {
    admin: (document.admin || null) as CoreTeam,
    staff: (document.staff || null) as CoreTeam,
  };
}

function catalogForExtensions(portfolio: {
  tools?: Record<string, { handle?: string; roles?: string[] }>;
  extensions?: Record<string, { handle?: string; roles?: string[] }>;
}) {
  const wanted = new Set<string>(PROJECT_EXTENSIONS);
  const found = new Map<string, { id: string; roles: string[] }>();
  for (const bag of [portfolio.tools, portfolio.extensions]) {
    for (const [id, doc] of Object.entries(bag || {})) {
      const handle = String(doc?.handle || '').toLowerCase();
      if (!wanted.has(handle)) continue;
      found.set(handle, { id, roles: Array.isArray(doc?.roles) ? doc.roles : [] });
    }
  }
  return found;
}

export async function runNewProject(
  draft: NewProjectDraft,
  prior: SetupProgress | undefined,
  onProgress: (progress: SetupProgress, label: string) => void,
  callerTeamIds: (portfolioId: string) => string[],
): Promise<SetupResult> {
  const progress: SetupProgress = {
    ...emptyProgress(),
    ...prior,
    installed: [...(prior?.installed || [])],
    invited: [...(prior?.invited || [])],
  };
  const guests = parseGuestEmails(draft.guestEmails);
  const report = (label: string) =>
    onProgress(
      { ...progress, installed: [...progress.installed], invited: [...progress.invited] },
      label,
    );

  if (!progress.portfolioId) {
    if (draft.portfolio.mode === 'existing') {
      progress.portfolioId = draft.portfolio.portfolioId;
      report('Using the selected portfolio');
    } else {
      report('Creating the portfolio');
      const created = await authFetch('/_auth/portfolios', 'POST', {
        name: draft.portfolio.portfolioName.trim(),
      });
      const ids = idsFromPortfolioCreate(created);
      progress.portfolioId = ids.portfolioId;
      progress.adminTeamId = ids.adminTeamId;
      report('Portfolio created');
    }
  }

  const portfolioId = progress.portfolioId;
  const portfolioName = draft.portfolio.portfolioName.trim();

  if (!progress.staffTeamId || !progress.adminTeamId) {
    report('Checking teams');
    const core = await loadCoreTeams(portfolioId);
    if (!progress.adminTeamId && core.admin?.team_id) {
      progress.adminTeamId = core.admin.team_id;
    }
    if (!progress.staffTeamId && core.staff?.team_id) {
      progress.staffTeamId = core.staff.team_id;
      progress.staffCreated = false;
    }
    report('Teams checked');
  }

  if (!progress.staffTeamId) {
    report(`Creating ${portfolioName} Staff`);
    const created = await authFetch(`/_auth/teams/${portfolioId}`, 'POST', {
      name: `${portfolioName} Staff`,
    });
    progress.staffTeamId = idFromTeamCreate(created);
    progress.staffCreated = true;
    report('Staff team created');
  }

  if (!progress.orgId) {
    report('Creating the project');
    const tagRows: TagRow[] = [
      ...(draft.projectType.trim()
        ? [{ id: 'type', key: 'type', value: draft.projectType.trim() }]
        : []),
      ...draft.tags.map((value, index) => ({ id: `tag-${index}`, key: 'tag', value })),
    ];
    const created = await authFetch(`/_auth/orgs/${portfolioId}`, 'POST', {
      name: draft.projectName.trim(),
      about: draft.description.trim(),
      tags: rowsToTags(tagRows),
    });
    const orgId = orgIdFromCreateResponse(created);
    if (!orgId) {
      throw new Error('The project was created but no id was returned.');
    }
    progress.orgId = orgId;
    report('Project created');
  }

  if (draft.thumbnail && !progress.thumbnailDone) {
    report('Uploading the thumbnail');
    await uploadOrgThumbnail(portfolioId, progress.orgId, draft.thumbnail);
    progress.thumbnailDone = true;
    report('Thumbnail uploaded');
  }

  for (const handle of PROJECT_EXTENSIONS) {
    if (progress.installed.includes(handle)) continue;
    report(`Installing ${handle}`);
    await authFetch(`/_schd/run/${handle}/${handle}_onboardings`, 'POST', { portfolio: portfolioId });
    progress.installed.push(handle);
    report(`${handle} installed`);
  }

  let memberTeamIds = callerTeamIds(portfolioId);

  if (!progress.grantsDone) {
    report('Connecting extensions');
    const tree = await authFetch('/_auth/tree/refresh', 'GET');
    const portfolio = tree?.portfolios?.[portfolioId] || {};
    memberTeamIds = Object.keys(portfolio.teams || {});
    const catalog = catalogForExtensions(portfolio);
    const teamIds = [
      ...new Set(
        [progress.adminTeamId, progress.staffTeamId, ...memberTeamIds].filter(
          (teamId): teamId is string => !!teamId,
        ),
      ),
    ];
    for (const handle of PROJECT_EXTENSIONS) {
      const entry = catalog.get(handle);
      if (!entry) {
        throw new Error(`${handle} was installed but is not on the portfolio yet.`);
      }
      for (const teamId of teamIds) {
        await authFetch(`/_auth/teams/${teamId}/tools/${entry.id}/orgs/${progress.orgId}`, 'POST');
        for (const roleId of entry.roles) {
          await authFetch(
            `/_auth/teams/${teamId}/tools/${entry.id}/roles/${encodeURIComponent(roleId)}`,
            'POST',
          );
        }
      }
    }
    progress.grantsDone = true;
    report('Extensions connected');
  }

  const callerOnStaff =
    progress.staffCreated || memberTeamIds.includes(progress.staffTeamId || '');
  if (guests.length > 0 && callerOnStaff && progress.staffTeamId) {
    for (const email of guests) {
      if (progress.invited.includes(email)) continue;
      report(`Inviting ${email}`);
      const body = { email, team_id: progress.staffTeamId, portfolio_id: portfolioId };
      await authFetch('/_auth/user/invite', 'POST', body);
      await authFetch('/_auth/user/invite/email', 'POST', body);
      progress.invited.push(email);
      report(`Invited ${email}`);
    }
  }

  if (!progress.orgId) {
    throw new Error('The project was created but no id was returned.');
  }

  report('Ready');
  return {
    portfolioId,
    orgId: progress.orgId,
    projectName: draft.projectName.trim(),
    invitesSkipped: guests.length > 0 && !callerOnStaff,
  };
}
