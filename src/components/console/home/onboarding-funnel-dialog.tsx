import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clapperboard,
  FileKey2,
  FolderPlus,
  Layers3,
  Link2,
  MailPlus,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

import './onboarding-funnel.css';
import {
  PROJECT_EXTENSIONS,
  PROJECT_TYPES,
  parseGuestEmails,
  runNewProject,
  type NewProjectDraft,
  type PortfolioChoice,
  type ProjectType,
  type SetupProgress,
  type SetupResult,
} from './run-new-project';

export type FunnelPortfolio = {
  id: string;
  name: string;
  orgs: { id: string; name: string }[];
  teamIds: string[];
};

type OnboardingFunnelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolios: FunnelPortfolio[];
  onFinished: () => void;
};

export default function OnboardingFunnelDialog({
  open,
  onOpenChange,
  portfolios,
  onFinished,
}: OnboardingFunnelDialogProps) {
  const [path, setPath] = useState<'new' | 'existing' | null>(null);
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('Movie');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [portfolioMode, setPortfolioMode] = useState<'existing' | 'new'>('new');
  const [portfolioId, setPortfolioId] = useState('');
  const [portfolioName, setPortfolioName] = useState('Movie');
  const [portfolioNameEdited, setPortfolioNameEdited] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [emails, setEmails] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<SetupProgress | undefined>();
  const [result, setResult] = useState<SetupResult | null>(null);
  const [joinDetail, setJoinDetail] = useState('');

  const totalSteps = path === 'new' ? 3 : 1;
  const eyebrow = !path ? 'Welcome' : step > totalSteps ? 'All set' : `Step ${step} of ${totalSteps}`;
  const selectedPortfolio = portfolios.find((portfolio) => portfolio.id === portfolioId);

  const portfolioChoice: PortfolioChoice = useMemo(() => {
    if (portfolioMode === 'existing' && selectedPortfolio) {
      return {
        mode: 'existing',
        portfolioId: selectedPortfolio.id,
        portfolioName: selectedPortfolio.name,
      };
    }
    return { mode: 'new', portfolioName: portfolioName.trim() || projectType };
  }, [portfolioMode, portfolioName, projectType, selectedPortfolio]);

  const chooseType = (next: ProjectType) => {
    setProjectType(next);
    if (!portfolioNameEdited) setPortfolioName(next);
  };

  const addTag = () => {
    const next = tag.trim();
    if (next && !tags.includes(next)) setTags((current) => [...current, next]);
    setTag('');
  };

  const reset = () => {
    setPath(null);
    setStep(1);
    setError('');
    setStatusLabel('');
    setProgress(undefined);
    setResult(null);
    setJoinDetail('');
    setBusy(false);
  };

  const stepOneReady =
    projectName.trim().length > 0 &&
    (portfolioChoice.mode === 'new'
      ? portfolioChoice.portfolioName.trim().length > 0
      : !!portfolioChoice.portfolioId);

  const finish = async () => {
    setBusy(true);
    setError('');
    const draft: NewProjectDraft = {
      projectName,
      projectType,
      description,
      tags,
      thumbnail,
      portfolio: portfolioChoice,
      guestEmails: emails,
    };
    try {
      parseGuestEmails(emails);
      const outcome = await runNewProject(
        draft,
        progress,
        (next, label) => {
          setProgress(next);
          setStatusLabel(label);
        },
        (id) => portfolios.find((portfolio) => portfolio.id === id)?.teamIds || [],
      );
      setResult(outcome);
      setStep(4);
      onFinished();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The setup could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/_auth/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionStorage.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || 'That invitation token is not valid.');
      }
      const document = payload.document || {};
      const place = [document.portfolio_name, document.team_name].filter(Boolean).join(' / ');
      setJoinDetail(
        document.status === 'member'
          ? `You are already on ${place || 'this team'}.`
          : `Access requested${place ? ` for ${place}` : ''}. A teammate still needs to approve you.`,
      );
      setStep(2);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That invitation token is not valid.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="onboarding-funnel w-[min(960px,calc(100vw-1.5rem))] max-w-[960px] gap-0 border-0 bg-transparent p-0 shadow-none sm:rounded-none [&>button]:text-[#6f6970]">
        <DialogTitle className="sr-only">Where should we start?</DialogTitle>
        <section className="of-card" aria-labelledby="onboarding-title">
          <div className="of-progress-row">
            <div className="of-eyebrow">{eyebrow}</div>
            {path && (
              <button type="button" className="of-text-button" onClick={reset}>
                <X size={14} /> Start over
              </button>
            )}
          </div>
          {path && step <= totalSteps && (
            <div className="of-track" aria-label={`Step ${step} of ${totalSteps}`}>
              <span style={{ width: `${(Math.min(step, totalSteps) / totalSteps) * 100}%` }} />
            </div>
          )}

          {!path && (
            <div>
              <div className="of-kicker"><Sparkles size={15} /> Let's make something</div>
              <h1 id="onboarding-title">Where should we<br /><em>start?</em></h1>
              <p className="of-lede">Every great project has a first frame. Choose how you'd like to join the story.</p>
              <div className="of-path-grid">
                <button type="button" className="of-path-card of-path-primary" onClick={() => { setPath('new'); setStep(1); }}>
                  <span className="of-card-icon of-peach"><FolderPlus size={18} /></span>
                  <span className="of-path-number">01</span>
                  <span className="of-path-title">Create a new project</span>
                  <span className="of-path-description">Set up your portfolio, connect your team, and get moving.</span>
                  <span className="of-path-arrow"><ArrowRight size={16} /></span>
                </button>
                <button type="button" className="of-path-card of-path-secondary" onClick={() => { setPath('existing'); setStep(1); }}>
                  <span className="of-card-icon of-lavender"><Link2 size={18} /></span>
                  <span className="of-path-number">02</span>
                  <span className="of-path-title">Join an existing project</span>
                  <span className="of-path-description">Have an invitation token? Pick up right where your team left off.</span>
                  <span className="of-path-arrow"><ArrowRight size={16} /></span>
                </button>
              </div>
              <p className="of-quiet"><Clapperboard size={15} /> You can always invite people and add details later.</p>
            </div>
          )}

          {path === 'new' && step === 1 && (
            <div className="of-step">
              <StepHeading icon={<FolderPlus size={18} />} label="A fresh canvas" title="Tell us about your project" description="This is the home base for your team. Nothing is created until you finish setup." />
              <div className="of-form">
                <label className="of-field">
                  <span>Project name</span>
                  <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. The Long Way Home" />
                </label>
                <fieldset className="of-field">
                  <legend>What are you making?</legend>
                  <div className="of-types">
                    {PROJECT_TYPES.map((type) => (
                      <button type="button" key={type} className={`of-type ${projectType === type ? 'selected' : ''}`} onClick={() => chooseType(type)}>
                        {type}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="of-field">
                  <span>Portfolio</span>
                  <div className="of-choices">
                    {portfolios.map((portfolio) => (
                      <button
                        type="button"
                        key={portfolio.id}
                        className={`of-choice ${portfolioMode === 'existing' && portfolioId === portfolio.id ? 'selected' : ''}`}
                        onClick={() => { setPortfolioMode('existing'); setPortfolioId(portfolio.id); }}
                      >
                        {portfolio.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`of-choice ${portfolioMode === 'new' ? 'selected' : ''}`}
                      onClick={() => setPortfolioMode('new')}
                    >
                      Create a new portfolio
                    </button>
                  </div>
                  {portfolioMode === 'new' && (
                    <input
                      value={portfolioName}
                      onChange={(event) => { setPortfolioNameEdited(true); setPortfolioName(event.target.value); }}
                      placeholder="Portfolio name"
                    />
                  )}
                  <button type="button" className="of-text-button" onClick={() => setShowProjects((current) => !current)}>
                    Show existing projects
                  </button>
                  {showProjects && (
                    <div className="of-chips">
                      {(portfolioMode === 'existing' ? selectedPortfolio?.orgs || [] : []).map((org) => (
                        <span className="of-chip" key={org.id}>{org.name}</span>
                      ))}
                      {portfolioMode === 'existing' && (selectedPortfolio?.orgs.length || 0) === 0 && (
                        <span className="of-help">No projects in this portfolio yet.</span>
                      )}
                      {portfolioMode === 'new' && <span className="of-help">A new portfolio starts without existing projects.</span>}
                    </div>
                  )}
                </label>
                <label className="of-field">
                  <span>Description <small>Optional</small></span>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A sentence or two about what you're making..." rows={3} />
                </label>
                <div className="of-field">
                  <span>Tags <small>Optional</small></span>
                  <div className="of-tags">
                    <div className="of-tag-list">
                      {tags.map((item) => (
                        <span className="of-tag" key={item}>
                          {item}
                          <button type="button" aria-label={`Remove ${item}`} onClick={() => setTags(tags.filter((entry) => entry !== item))}><X size={12} /></button>
                        </span>
                      ))}
                      <input
                        value={tag}
                        onChange={(event) => setTag(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }}
                        onBlur={addTag}
                        placeholder={tags.length ? 'Add another' : 'e.g. documentary'}
                      />
                    </div>
                  </div>
                </div>
                <label className="of-field">
                  <span>Thumbnail <small>Optional</small></span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(event) => setThumbnail(event.target.files?.[0] || null)}
                  />
                </label>
              </div>
              <div className="of-actions">
                <button type="button" className="of-text-button" onClick={() => setPath(null)}><ArrowLeft size={16} /> Back</button>
                <button type="button" className="of-primary" disabled={!stepOneReady} onClick={() => setStep(2)}>Save & continue <ArrowRight size={16} /></button>
              </div>
            </div>
          )}

          {path === 'new' && step === 2 && (
            <div className="of-step">
              <StepHeading icon={<Layers3 size={18} />} label="A little magic" title="Your project, all connected" description="We'll set this up when you finish. Nothing is saved yet." />
              <div className="of-setup">
                <SetupItem title={`${portfolioChoice.portfolioName} workspace`} detail={`${projectType} project: ${projectName || 'Untitled'}`} />
                <SetupItem title="Extensions" detail={PROJECT_EXTENSIONS.join(', ')} />
                <SetupItem title="Teams" detail={`${portfolioChoice.portfolioName} Admin and ${portfolioChoice.portfolioName} Staff`} />
              </div>
              <div className="of-actions">
                <button type="button" className="of-text-button" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</button>
                <button type="button" className="of-primary" onClick={() => setStep(3)}>Looks good <ArrowRight size={16} /></button>
              </div>
            </div>
          )}

          {path === 'new' && step === 3 && (
            <div className="of-step">
              <StepHeading icon={<MailPlus size={18} />} label="Bring your people" title="Invite your collaborators" description="Add teammates now, or leave this blank. They are invited to Staff when setup finishes." />
              <label className="of-field">
                <span>Email addresses <small>Separate with commas</small></span>
                <textarea value={emails} onChange={(event) => setEmails(event.target.value)} placeholder="alex@example.com, sam@example.com" rows={4} />
              </label>
              <p className="of-help">You can add more people from your project settings.</p>
              {statusLabel && <p className="of-help">{statusLabel}</p>}
              {error && <p className="of-error">{error}</p>}
              <div className="of-actions">
                <button type="button" className="of-text-button" onClick={() => setStep(2)} disabled={busy}><ArrowLeft size={16} /> Back</button>
                <button type="button" className="of-primary" onClick={finish} disabled={busy}>
                  {busy ? 'Setting up…' : progress ? 'Retry setup' : 'Finish setup'} <Check size={16} />
                </button>
              </div>
            </div>
          )}

          {path === 'new' && step === 4 && result && (
            <div className="of-complete">
              <div className="of-mark"><Check /></div>
              <div className="of-kicker">All set</div>
              <h2>Your studio is ready.</h2>
              <p>{result.projectName} is ready for its first frame.</p>
              {result.invitesSkipped && (
                <p>Collaborator invites were not sent because you are not on the Staff team.</p>
              )}
              <button type="button" className="of-primary" onClick={() => onOpenChange(false)}>Go to your projects <ArrowRight size={16} /></button>
            </div>
          )}

          {path === 'existing' && step === 1 && (
            <div className="of-step">
              <StepHeading icon={<FileKey2 size={18} />} label="You've got an invite" title="Enter your invitation token" description="Paste the open token from the team. Your request waits for someone on that team to approve it." />
              <label className="of-field">
                <span>Invitation token</span>
                <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="e.g. FRM-8H2K-91QD" />
              </label>
              <p className="of-help">Tokens are case-insensitive and usually look like FRM-8H2K-91QD.</p>
              {error && <p className="of-error">{error}</p>}
              <div className="of-actions">
                <button type="button" className="of-text-button" onClick={() => setPath(null)} disabled={busy}><ArrowLeft size={16} /> Back</button>
                <button type="button" className="of-primary" disabled={!token.trim() || busy} onClick={join}>
                  {busy ? 'Requesting…' : 'Join project'} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {path === 'existing' && step === 2 && (
            <div className="of-complete">
              <div className="of-mark"><Check /></div>
              <div className="of-kicker">All set</div>
              <h2>Access requested.</h2>
              <p>{joinDetail}</p>
              <button type="button" className="of-primary" onClick={() => onOpenChange(false)}>Back to home <ArrowRight size={16} /></button>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function StepHeading({
  icon,
  label,
  title,
  description,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="of-heading">
      <span className="of-step-icon">{icon}</span>
      <div>
        <div className="of-kicker">{label}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function SetupItem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="of-setup-item">
      <span className="of-step-icon"><Users size={16} /></span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <Check className="of-check" size={17} />
    </div>
  );
}
