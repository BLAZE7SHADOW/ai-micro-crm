import { ArrowLeftOutlined, PlusOutlined, MailOutlined } from '@ant-design/icons';
import { Alert, Button, Drawer, Skeleton, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api';
import { InsightCard } from '../components/InsightCard';
import { InteractionForm } from '../components/InteractionForm';
import { InteractionTimeline } from '../components/InteractionTimeline';
import type { CustomerDetail as Detail, CustomerInsight } from '../types';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  return <AccountDetail key={id} id={id!} returnSearch={location.search} />;
}
function AccountDetail({ id, returnSearch }: { id: string; returnSearch: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [insight, setInsight] = useState<CustomerInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [detailError, setDetailError] = useState(false);
  const [insightError, setInsightError] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [insightAttempt, setInsightAttempt] = useState(0);
  const [regenerating, setRegenerating] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(timer.current); }; }, []);
  useEffect(() => {
    let active = true; setDetailError(false);
    api.customer(id).then(v => { if (active) setDetail(v); }).catch(() => { if (active) setDetailError(true); });
    return () => { active = false; };
  }, [id, attempt]);
  useEffect(() => {
    let active = true; setInsightLoading(true); setInsightError(false);
    api.insight(id).then(v => { if (active) setInsight(v); }).catch(() => { if (active) setInsightError(true); }).finally(() => { if (active) setInsightLoading(false); });
    return () => { active = false; };
  }, [id, attempt, insightAttempt]);
  const regenerate = async () => {
    setRegenerating(true);
    try { const result = await api.regenerateInsight(id); if (alive.current) { setInsight(result); setInsightError(false); } }
    catch { if (alive.current) message.error('Could not refresh this insight. Please try again.'); }
    finally { if (alive.current) setRegenerating(false); }
  };
  const scrollToInteraction = (interactionId: string) => {
    clearTimeout(timer.current); setHighlightedId(interactionId);
    const target = document.getElementById(`interaction-${interactionId}`);
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    target?.focus({ preventScroll: true });
    timer.current = setTimeout(() => setHighlightedId(null), 2500);
  };
  const citedIds = new Set([...(insight?.cited_interaction_ids ?? []), ...(insight?.action_cited_interaction_ids ?? [])]);
  return <>
    <Link className="back-link" to={`/${returnSearch}`}><ArrowLeftOutlined /> Back to briefing</Link>
    {detailError && <Alert type="error" showIcon message="This account could not be loaded." action={<Button onClick={() => setAttempt(a => a + 1)}>Retry</Button>} />}
    {!detail && !detailError && <div className="detail-skeleton"><Skeleton active paragraph={{ rows: 8 }} /></div>}
    {detail && <>
      <section className="detail-heading"><div className="detail-identity"><div className="account-avatar large">{detail.customer.name.split(/\s+/).slice(0, 2).map(w => w[0]).join('')}</div><div><div className="eyebrow">RELATIONSHIP OVERVIEW</div><h1>{detail.customer.name}</h1><span className="status-label">{detail.customer.status}</span></div></div><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setDrawer(true)}>Log interaction</Button></section>
      <div className="detail-grid"><div className="detail-primary">
        {insightError && <Alert type="warning" showIcon message="The account insight could not be loaded." action={<Button onClick={() => setInsightAttempt(a => a + 1)}>Retry</Button>} />}
        {insightLoading ? <section className="surface insight-skeleton"><Skeleton active paragraph={{ rows: 4 }} /></section> : insight && <InsightCard insight={insight} contacts={detail.contacts} interactions={detail.interactions} regenerating={regenerating} onRegenerate={regenerate} onCitationClick={scrollToInteraction} />}
        <section className="surface history-panel"><div className="section-heading"><div><p className="eyebrow">THE FULL PICTURE</p><h2>Interaction history <span className="count-pill">{detail.interactions.length}</span></h2></div><span className="muted">Most recent first</span></div>
          {detail.interactions.length ? <InteractionTimeline interactions={detail.interactions} contacts={detail.contacts} citedIds={citedIds} highlightedId={highlightedId} /> : <p className="muted">No interactions yet. Log your first conversation to add context.</p>}
        </section>
      </div><aside className="detail-sidebar"><section className="surface contacts-panel"><p className="eyebrow">PEOPLE BEHIND THE ACCOUNT</p><h2>Contacts <span className="count-pill">{detail.contacts.length}</span></h2>{detail.contacts.map(c => <div className="contact" key={c.id}><div className="contact-avatar">{c.name.split(' ').map(n => n[0]).join('')}</div><div className="contact-body"><strong>{c.name}</strong><span>{c.role}</span><a href={`mailto:${c.email}`}><MailOutlined /> {c.email}</a></div></div>)}{!detail.contacts.length && <p className="muted">No contacts recorded.</p>}</section><div className="context-note"><span className="context-note-mark">✧</span><h3>Context, kept close.</h3><p>Insights are based on your recorded conversations. Open a source to see the original note before deciding what comes next.</p></div></aside></div>
      <Drawer title="Log an interaction" open={drawer} onClose={() => setDrawer(false)} width={440} destroyOnClose><p className="drawer-description">Capture a little context for {detail.customer.name}. Your account insight will update after saving.</p><InteractionForm customerId={id} contacts={detail.contacts} onAdded={() => { if (alive.current) { setDrawer(false); setAttempt(a => a + 1); } }} /></Drawer>
    </>}
  </>;
}
