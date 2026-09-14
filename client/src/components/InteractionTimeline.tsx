import { CalendarOutlined, FileTextOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { Tag, Timeline, Typography } from 'antd';
import { formatDate } from '../demoConfig';
import type { Contact, Interaction, InteractionType } from '../types';

const { Text, Paragraph } = Typography;

const TYPE_ICON: Record<InteractionType, React.ReactNode> = {
  email: <MailOutlined />,
  call: <PhoneOutlined />,
  meeting: <CalendarOutlined />,
  note: <FileTextOutlined />,
};

interface Props {
  interactions: Interaction[]; // oldest first from the API; rendered newest first
  contacts: Contact[];
  citedIds?: Set<string>;
  highlightedId?: string | null;
}

export function InteractionTimeline({ interactions, contacts, citedIds, highlightedId }: Props) {
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const newestFirst = [...interactions].reverse();

  return (
    <Timeline
      items={newestFirst.map((i) => {
        const contact = contactById.get(i.contact_id);
        const cited = citedIds?.has(i.id);
        const highlighted = highlightedId === i.id;
        return {
          dot: TYPE_ICON[i.type],
          color: cited ? '#0e7a6f' : 'gray',
          children: (
            <div
              id={`interaction-${i.id}`}
              tabIndex={-1}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: highlighted ? '#dceee8' : cited ? '#f5f9f7' : 'transparent',
                border: highlighted ? '1px solid #91caff' : '1px solid transparent',
                transition: 'background 0.6s, border 0.6s',
              }}
            >
              <div style={{ marginBottom: 4 }}>
                <Text strong>{formatDate(i.occurred_at, true)}</Text>{' '}
                <Tag style={{ fontSize: 11 }}>{i.type}</Tag>
                {contact && (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {contact.name} · {contact.role}
                  </Text>
                )}
                {cited && (
                  <Tag color="default" style={{ fontSize: 10, marginLeft: 8 }}>
                    Insight source
                  </Tag>
                )}
              </div>
              <Paragraph style={{ marginBottom: 0 }}>{i.notes}</Paragraph>
            </div>
          ),
        };
      })}
    />
  );
}
