import { ArrowRightOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Select, Skeleton } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { URGENCY_ORDER, UrgencyTag } from '../components/UrgencyTag';
import { activityLabel, formatDate, useReferenceDate } from '../demoConfig';
import type { CustomerInsight, CustomerListItem } from '../types';

export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const [customers, setCustomers] = useState<CustomerListItem[] | null>(null);
  const [insights, setInsights] = useState<CustomerInsight[] | null>(null);
  const [customerError, setCustomerError] = useState(false);
  const [insightError, setInsightError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reference = useReferenceDate();
  const tab = params.get('tab') === 'all' ? 'all' : 'attention';
  const query = params.get('q') ?? '';
  const status = ['prospect', 'customer'].includes(params.get('status') ?? '') ? params.get('status')! : 'all';
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); setParams(next, { replace: true }); };
  useEffect(() => {
    let active = true;
    setCustomerError(false); setInsightError(false);
    api.customers().then(v => { if (active) setCustomers(v); }).catch(() => { if (active) setCustomerError(true); });
    api.insights().then(v => { if (active) setInsights(v); }).catch(() => { if (active) setInsightError(true); });
    return () => { active = false; };
  }, [attempt]);
  const rows = useMemo(() => {
    const byId = new Map((insights ?? []).map(i => [i.customer_id, i]));
    return (customers ?? []).map(customer => ({ customer, insight: byId.get(customer.id) })).sort((a, b) => {
      const rank = (i?: CustomerInsight) => i ? URGENCY_ORDER.indexOf(i.urgency) : 4;
      return rank(a.insight) - rank(b.insight) || (a.customer.last_interaction_at ?? '').localeCompare(b.customer.last_interaction_at ?? '');
    });
  }, [customers, insights]);
  const attention = rows.filter(r => r.insight && ['high', 'medium'].includes(r.insight.urgency));
  const pending = rows.filter(r => !r.insight).length;
  const visible = rows.filter(r => (tab === 'all' || !r.insight || ['high', 'medium'].includes(r.insight.urgency)) && (status === 'all' || r.customer.status === status) && r.customer.name.toLowerCase().includes(query.trim().toLowerCase()));
  const returnSearch = params.toString() ? `?${params.toString()}` : '';
  return <>
    <section className="workspace-heading">
      <div className="workspace-title">
        <h1>Relationships</h1>
        <button
          className={`attention-indicator${customers && insights && attention.length === 0 ? ' is-clear' : ''}`}
          disabled={!customers || !insights}
          onClick={() => setParams({}, { replace: true })}
          title="Show all accounts that need attention"
        >
          <span className="attention-dot" aria-hidden="true" />
          {customers && insights ? <><strong>{attention.length}</strong> need attention</> : customerError || insightError ? 'Attention count unavailable' : 'Checking attention…'}
        </button>
      </div>
      <span className="reference-label">{reference ? `Demo · As of ${formatDate(reference, true)}` : 'Loading demo date…'}</span>
    </section>
    <section className="queue-panel" aria-label="Relationships">
      <div className="queue-toolbar"><div className="queue-tabs" role="tablist" aria-label="Relationship view">
        <button role="tab" aria-selected={tab === 'attention'} className={tab === 'attention' ? 'selected' : ''} onClick={() => update('tab', '')}>Needs attention</button>
        <button role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'selected' : ''} onClick={() => update('tab', 'all')}>All relationships <span>{customers?.length ?? '—'}</span></button>
      </div><div className="queue-filters"><Input aria-label="Search accounts" placeholder="Search accounts…" prefix={<SearchOutlined />} value={query} allowClear onChange={e => update('q', e.target.value)} /><Select aria-label="Relationship status" value={status} onChange={v => update('status', v === 'all' ? '' : v)} options={[{ value: 'all', label: 'All types' }, { value: 'prospect', label: 'Prospects' }, { value: 'customer', label: 'Customers' }]} /></div></div>
      {customerError && <Alert type="error" showIcon message="Accounts could not be loaded." action={<Button onClick={() => setAttempt(a => a + 1)}>Retry</Button>} />}
      {insightError && <Alert type="warning" showIcon message="Insights are unavailable. You can still review your accounts." action={<Button onClick={() => setAttempt(a => a + 1)}>Retry insights</Button>} />}
      {pending > 0 && <div className="pending-note">{pending} account{pending === 1 ? '' : 's'} {insightError ? 'without an insight' : insights ? 'awaiting analysis' : 'being reviewed'} · not included in attention count</div>}
      {!customers && !customerError && <div className="queue-skeleton"><Skeleton active avatar paragraph={{ rows: 2 }} /><Skeleton active avatar paragraph={{ rows: 2 }} /><Skeleton active avatar paragraph={{ rows: 2 }} /></div>}
      {customers && visible.map(({ customer, insight }) => <article className="account-row" key={customer.id}>
        <div className={`account-avatar ${customer.status}`}>{customer.name.split(/\s+/).slice(0, 2).map(w => w[0]).join('')}</div>
        <div className="account-main"><div className="account-title"><h3><Link to={`/customers/${customer.id}${returnSearch}`}>{customer.name}</Link></h3><span className="status-label">{customer.status}</span></div>
          <p className="account-reason">{insight?.urgency_reason ?? (insightError ? 'Open the account to review its history.' : 'Reviewing the interaction history…')}</p>
          {insight && <p className="account-action"><ArrowRightOutlined />{insight.suggested_action}</p>}
          <div className="account-meta"><span>Last activity {activityLabel(customer.last_interaction_at, reference).toLowerCase()}</span><span>·</span><span>{customer.interaction_count} interactions</span></div>
        </div><div className="account-side">{insight && <UrgencyTag urgency={insight.urgency} />}<Link className="review-link" to={`/customers/${customer.id}${returnSearch}`} aria-label={`Review ${customer.name}`}>Review account <ArrowRightOutlined /></Link></div>
      </article>)}
      {customers && !visible.length && <div className="empty-state"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={query || status !== 'all' ? 'No accounts match these filters.' : 'Nothing needs your attention right now.'} />{query || status !== 'all' ? <Button onClick={() => { const next = new URLSearchParams(params); next.delete('q'); next.delete('status'); setParams(next, { replace: true }); }}>Clear filters</Button> : <Button onClick={() => update('tab', 'all')}>View all relationships</Button>}</div>}
      {customers && <div className="queue-footer"><span>Showing {visible.length} of {customers.length} relationships</span><span>Sorted by priority</span></div>}
    </section>

  </>;
}
