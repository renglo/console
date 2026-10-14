import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileKey2,
  FolderPlus,
  Layers3,
  Link2,
  MailPlus,
  Users,
  X,
} from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { caption, captionList } from '@/lib/messages';

import './onboarding-funnel.css';
import {
  PROJECT_EXTENSIONS,
  parseGuestEmails,
  runNewProject,
  type NewProjectDraft,
  type PortfolioChoice,
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
  const projectTypes = captionList('onboarding.entity.types');
  const [path, setPath] = useState<'new' | 'existing' | null>(null);
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState(projectTypes[0] ?? '');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [portfolioMode, setPortfolioMode] = useState<'existing' | 'new'>('new');
  const [portfolioId, setPortfolioId] = useState('');
  const [portfolioName, setPortfolioName] = useState(projectTypes[0] ?? '');
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
  const eyebrow = !path
    ? caption('onboarding.welcome')
    : step > totalSteps
      ? caption('onboarding.doneLabel')
      : caption('onboarding.step', { step: String(step), total: String(totalSteps) });
  const startTitle = splitColoredTitle(caption('onboarding.start.title'));
  const startKicker = caption('onboarding.start.kicker');
  const dialogTitle = startTitle.accent ? `${startTitle.lead} ${startTitle.accent}` : startTitle.lead;
  const selectedPortfolio = portfolios.find((portfolio) => portfolio.id === portfolioId);

  const portfolioChoice: PortfolioChoice = useMemo(() => {
    if (portfolioMode === 'existing' && selectedPortfolio) {
      return {
        mode: 'existing',
        portfolioId: selectedPortfolio.id,
        portfolioName: selectedPortfolio.name,
      };
    }
    return { mode: 'new', portfolioName: portfolioName.trim() };
  }, [portfolioMode, portfolioName, selectedPortfolio]);

  const chooseType = (next: string) => {
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
      setError(caught instanceof Error ? caught.message : caption('onboarding.errors.setup'));
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
        throw new Error(payload.message || caption('onboarding.errors.token'));
      }
      const document = payload.document || {};
      const place = [document.portfolio_name, document.team_name].filter(Boolean).join(' / ');
      setJoinDetail(
        document.status === 'member'
          ? caption('onboarding.join.already', {
              place: place || caption('onboarding.join.thisTeam'),
            })
          : caption('onboarding.join.requested', {
              place: place ? caption('onboarding.join.forPlace', { place }) : '',
            }),
      );
      setStep(2);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : caption('onboarding.errors.token'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="onboarding-funnel w-[min(960px,calc(100vw-1.5rem))] max-w-[960px] gap-0 border-0 bg-transparent p-0 shadow-none sm:rounded-none [&>button]:text-[#6f6970]">
        <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>
        <section className="of-card" aria-labelledby="onboarding-title">
          <div className="of-progress-row">
            <div className="of-eyebrow">{eyebrow}</div>
            {path && (
              <button type="button" className="of-text-button" onClick={reset}>
                <X size={14} /> {caption('onboarding.startOver')}
              </button>
            )}
          </div>
          {path && step <= totalSteps && (
            <div className="of-track" aria-label={caption('onboarding.step', { step: String(step), total: String(totalSteps) })}>
              <span style={{ width: `${(Math.min(step, totalSteps) / totalSteps) * 100}%` }} />
            </div>
          )}

          {!path && (
            <div>
              {startKicker ? <div className="of-kicker">{startKicker}</div> : null}
              <h1 id="onboarding-title">
                {startTitle.lead}
                {startTitle.accent ? <><br /><em>{startTitle.accent}</em></> : null}
              </h1>
              <p className="of-lede">{caption('onboarding.start.lede')}</p>
              <div className="of-path-grid">
                <button type="button" className="of-path-card of-path-primary" onClick={() => { setPath('new'); setStep(1); }}>
                  <span className="of-card-icon of-peach"><FolderPlus size={18} /></span>
                  <span className="of-path-number">01</span>
                  <span className="of-path-title">{caption('onboarding.start.createTitle')}</span>
                  <span className="of-path-description">{caption('onboarding.start.createDescription')}</span>
                  <span className="of-path-arrow"><ArrowRight size={16} /></span>
                </button>
                <button type="button" className="of-path-card of-path-secondary" onClick={() => { setPath('existing'); setStep(1); }}>
                  <span className="of-card-icon of-lavender"><Link2 size={18} /></span>
                  <span className="of-path-number">02</span>
                  <span className="of-path-title">{caption('onboarding.start.joinTitle')}</span>
                  <span className="of-path-description">{caption('onboarding.start.joinDescription')}</span>
                  <span className="of-path-arrow"><ArrowRight size={16} /></span>
                </button>
              </div>
              <p className="of-quiet">{caption('onboarding.start.note')}</p>
            </div>
          )}

          {path === 'new' && step === 1 && (
            <div className="of-step">
              <StepHeading icon={<FolderPlus size={18} />} label={caption('onboarding.entity.label')} title={caption('onboarding.entity.title')} description={caption('onboarding.entity.description')} />
              <div className="of-form">
                <label className="of-field">
                  <span>{caption('onboarding.entity.name')}</span>
                  <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder={caption('onboarding.entity.namePlaceholder')} />
                </label>
                {projectTypes.length > 0 && (
                  <fieldset className="of-field">
                    <legend>{caption('onboarding.entity.making')}</legend>
                    <div className="of-types">
                      {projectTypes.map((type) => (
                        <button type="button" key={type} className={`of-type ${projectType === type ? 'selected' : ''}`} onClick={() => chooseType(type)}>
                          {type}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                <label className="of-field">
                  <span>{caption('onboarding.entity.portfolio')}</span>
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
                      {caption('onboarding.entity.newPortfolio')}
                    </button>
                  </div>
                  {portfolioMode === 'new' && (
                    <input
                      value={portfolioName}
                      onChange={(event) => { setPortfolioNameEdited(true); setPortfolioName(event.target.value); }}
                      placeholder={caption('onboarding.entity.portfolioPlaceholder')}
                    />
                  )}
                  <button type="button" className="of-text-button" onClick={() => setShowProjects((current) => !current)}>
                    {caption('onboarding.entity.showExisting')}
                  </button>
                  {showProjects && (
                    <div className="of-chips">
                      {(portfolioMode === 'existing' ? selectedPortfolio?.orgs || [] : []).map((org) => (
                        <span className="of-chip" key={org.id}>{org.name}</span>
                      ))}
                      {portfolioMode === 'existing' && (selectedPortfolio?.orgs.length || 0) === 0 && (
                        <span className="of-help">{caption('onboarding.entity.noneInPortfolio')}</span>
                      )}
                      {portfolioMode === 'new' && <span className="of-help">{caption('onboarding.entity.newPortfolioEmpty')}</span>}
                    </div>
                  )}
                </label>
                <label className="of-field">
                  <span>{caption('onboarding.entity.descriptionLabel')} <small>{caption('onboarding.entity.optional')}</small></span>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={caption('onboarding.entity.descriptionPlaceholder')} rows={3} />
                </label>
                <div className="of-field">
                  <span>{caption('onboarding.entity.tags')} <small>{caption('onboarding.entity.optional')}</small></span>
                  <div className="of-tags">
                    <div className="of-tag-list">
                      {tags.map((item) => (
                        <span className="of-tag" key={item}>
                          {item}
                          <button type="button" aria-label={caption('onboarding.entity.removeTag', { item })} onClick={() => setTags(tags.filter((entry) => entry !== item))}><X size={12} /></button>
                        </span>
                      ))}
                      <input
                        value={tag}
                        onChange={(event) => setTag(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }}
                        onBlur={addTag}
                        placeholder={tags.length ? caption('onboarding.entity.addAnother') : caption('onboarding.entity.tagPlaceholder')}
                      />
                    </div>
                  </div>
                </div>
                <label className="of-field">
                  <span>{caption('onboarding.entity.thumbnail')} <small>{caption('onboarding.entity.optional')}</small></span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(event) => setThumbnail(event.target.files?.[0] || null)}
                  />
                </label>
              </div>
              <div className="of-actions">
                <button type="button" className="of-text-button" onClick={() => setPath(null)}><ArrowLeft size={16} /> {caption('onboarding.entity.back')}</button>
                <button type="button" className="of-primary" disabled={!stepOneReady} onClick={() => setStep(2)}>{caption('onboarding.entity.continue')} <ArrowRight size={16} /></button>
              </div>
            </div>
          )}

          {path === 'new' && step === 2 && (
            <div className="of-step">
              <StepHeading icon={<Layers3 size={18} />} label={caption('onboarding.review.label')} title={caption('onboarding.review.title')} description={caption('onboarding.review.description')} />
              <div className="of-setup">
                <SetupItem title={caption('onboarding.review.workspace', { portfolio: portfolioChoice.portfolioName })} detail={caption('onboarding.review.detail', { type: projectType, name: projectName || caption('onboarding.review.untitled') })} />
                <SetupItem title={caption('onboarding.review.extensions')} detail={PROJECT_EXTENSIONS.join(', ')} />
                <SetupItem title={caption('onboarding.review.teams')} detail={caption('onboarding.review.teamsDetail', { portfolio: portfolioChoice.portfolioName })} />
              </div>
              <div className="of-actions">
                <button type="button" className="of-text-button" onClick={() => setStep(1)}><ArrowLeft size={16} /> {caption('onboarding.entity.back')}</button>
                <button type="button" className="of-primary" onClick={() => setStep(3)}>{caption('onboarding.review.continue')} <ArrowRight size={16} /></button>
              </div>
            </div>
          )}

          {path === 'new' && step === 3 && (
            <div className="of-step">
              <StepHeading icon={<MailPlus size={18} />} label={caption('onboarding.invite.label')} title={caption('onboarding.invite.title')} description={caption('onboarding.invite.description')} />
              <label className="of-field">
                <span>{caption('onboarding.invite.emails')} <small>{caption('onboarding.invite.emailsHint')}</small></span>
                <textarea value={emails} onChange={(event) => setEmails(event.target.value)} placeholder={caption('onboarding.invite.emailsPlaceholder')} rows={4} />
              </label>
              <p className="of-help">{caption('onboarding.invite.later')}</p>
              {statusLabel && <p className="of-help">{statusLabel}</p>}
              {error && <p className="of-error">{error}</p>}
              <div className="of-actions">
                <button type="button" className="of-text-button" onClick={() => setStep(2)} disabled={busy}><ArrowLeft size={16} /> {caption('onboarding.entity.back')}</button>
                <button type="button" className="of-primary" onClick={finish} disabled={busy}>
                  {busy ? caption('onboarding.invite.working') : progress ? caption('onboarding.invite.retry') : caption('onboarding.invite.finish')} <Check size={16} />
                </button>
              </div>
            </div>
          )}

          {path === 'new' && step === 4 && result && (
            <div className="of-complete">
              <div className="of-mark"><Check /></div>
              <div className="of-kicker">{caption('onboarding.complete.label')}</div>
              <h2>{caption('onboarding.complete.title')}</h2>
              <p>{caption('onboarding.complete.ready', { name: result.projectName })}</p>
              {result.invitesSkipped && (
                <p>{caption('onboarding.complete.invitesSkipped')}</p>
              )}
              <button type="button" className="of-primary" onClick={() => onOpenChange(false)}>{caption('onboarding.complete.go')} <ArrowRight size={16} /></button>
            </div>
          )}

          {path === 'existing' && step === 1 && (
            <div className="of-step">
              <StepHeading icon={<FileKey2 size={18} />} label={caption('onboarding.join.label')} title={caption('onboarding.join.title')} description={caption('onboarding.join.description')} />
              <label className="of-field">
                <span>{caption('onboarding.join.token')}</span>
                <input value={token} onChange={(event) => setToken(event.target.value)} placeholder={caption('onboarding.join.tokenPlaceholder')} />
              </label>
              <p className="of-help">{caption('onboarding.join.tokenHelp')}</p>
              {error && <p className="of-error">{error}</p>}
              <div className="of-actions">
                <button type="button" className="of-text-button" onClick={() => setPath(null)} disabled={busy}><ArrowLeft size={16} /> {caption('onboarding.entity.back')}</button>
                <button type="button" className="of-primary" disabled={!token.trim() || busy} onClick={join}>
                  {busy ? caption('onboarding.join.working') : caption('onboarding.join.submit')} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {path === 'existing' && step === 2 && (
            <div className="of-complete">
              <div className="of-mark"><Check /></div>
              <div className="of-kicker">{caption('onboarding.doneLabel')}</div>
              <h2>{caption('onboarding.join.doneTitle')}</h2>
              <p>{joinDetail}</p>
              <button type="button" className="of-primary" onClick={() => onOpenChange(false)}>{caption('onboarding.join.home')} <ArrowRight size={16} /></button>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

/** Text before the first comma stays the heading color. Text after it uses the accent color. */
function splitColoredTitle(title: string): { lead: string; accent: string } {
  const splitAt = title.indexOf(',');
  if (splitAt === -1) return { lead: title.trim(), accent: '' };
  return {
    lead: title.slice(0, splitAt).trim(),
    accent: title.slice(splitAt + 1).trim(),
  };
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
