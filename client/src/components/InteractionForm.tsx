import { Button, DatePicker, Form, Input, Select, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useReferenceDate } from '../demoConfig';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Contact, InteractionType } from '../types';

interface Props {
  customerId: string;
  contacts: Contact[];
  onAdded: () => void; // parent refetches timeline + insight
}

interface FormValues {
  contact_id: string;
  type: InteractionType;
  occurred_at: Dayjs;
  notes: string;
}

export function InteractionForm({ customerId, contacts, onAdded }: Props) {
  const referenceDate = useReferenceDate();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (referenceDate && !form.getFieldValue('occurred_at')) {
      form.setFieldValue('occurred_at', dayjs(referenceDate));
    }
  }, [referenceDate, form]);

  const submit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await api.addInteraction({
        customer_id: customerId,
        contact_id: values.contact_id,
        type: values.type,
        occurred_at: values.occurred_at.format('YYYY-MM-DD'),
        notes: values.notes,
      });
      form.resetFields(['notes']);
      message.success('Interaction logged — insight is being refreshed');
      onAdded();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to log interaction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={submit}
      initialValues={{ type: 'note', occurred_at: referenceDate ? dayjs(referenceDate) : undefined }}
    >
      <Form.Item name="contact_id" label="Contact" rules={[{ required: true, message: 'Pick a contact' }]}>
        <Select
          placeholder="Who was this with?"
          options={contacts.map((c) => ({ value: c.id, label: `${c.name} (${c.role})` }))}
        />
      </Form.Item>
      <Form.Item name="type" label="Type" rules={[{ required: true }]}>
        <Select
          options={[
            { value: 'call', label: 'Call' },
            { value: 'email', label: 'Email' },
            { value: 'meeting', label: 'Meeting' },
            { value: 'note', label: 'Note' },
          ]}
        />
      </Form.Item>
      <Form.Item name="occurred_at" label="Date" rules={[{ required: true }]}>
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="notes" label="Notes" rules={[{ required: true, message: 'What happened?' }]}>
        <Input.TextArea rows={3} placeholder="e.g. Sarah replied — wants a contract call on Friday." />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={submitting} block>
        Log interaction
      </Button>
    </Form>
  );
}
