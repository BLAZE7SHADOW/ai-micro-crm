import { ArrowRightOutlined, ReloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { Alert, Button, Tooltip } from 'antd';
import { UrgencyTag } from './UrgencyTag';
import { formatDate } from '../demoConfig';
import type { Contact, CustomerInsight, Interaction } from '../types';
interface Props {
  insight: CustomerInsight;
  contacts: Contact[];
  interactions: Interaction[];
  regenerating?: boolean;
  onRegenerate?: () => void;
  onCitationClick?: (id: string) => void;
}
export function InsightCard({ insight, contacts, interactions, regenerating, onRegenerate, onCitationClick }: Props) {
  const citations = (ids: string[]) => <div className="citation-list">{ids.map(id => {
    const interaction = interactions.find(i => i.id === id);
    if (!interaction) return null;
    const contact = contacts.find(c => c.id === interaction.contact_id);
    const kind = interaction.type.charAt(0).toUpperCase() + interaction.type.slice(1);
    return <button className="citation-button" key={id} onClick={() => onCitationClick?.(id)}><FileTextOutlined />{kind}{contact ? ` · ${contact.name}` : ''} · {formatDate(interaction.occurred_at)}</button>;
  })}</div>;
  return <section className="surface insight-panel">
    <div className="section-heading"><div className="insight-label"><span className="insight-spark">✧</span><Tooltip title={insight.source === 'ai' ? 'Generated with AI from this account’s recorded interactions.' : 'Generated using rules because AI is unavailable or not configured.'}><span>{insight.source === 'ai' ? 'AI insight' : 'Rule-based insight'}</span></Tooltip></div><Button type="text" size="small" icon={<ReloadOutlined />} loading={regenerating} onClick={onRegenerate}>Refresh insight</Button></div>
    {insight.low_confidence && <Alert type="warning" showIcon className="confidence-alert" message="Some source references could not be verified. Review the original notes before acting." />}
    <h2>Where things stand</h2><p className="insight-summary">{insight.summary}</p>
    <div className="insight-reason"><UrgencyTag urgency={insight.urgency} /><p>{insight.urgency_reason}</p></div>
    {citations(insight.cited_interaction_ids)}
    <div className="next-action"><p className="eyebrow"><ArrowRightOutlined /> YOUR NEXT STEP</p><h3>{insight.suggested_action}</h3><p>{insight.action_reason}</p>{citations(insight.action_cited_interaction_ids)}</div>
  </section>;
}
