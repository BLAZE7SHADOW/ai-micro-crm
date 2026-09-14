import { Alert, Button } from 'antd';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
const DemoConfig = createContext<string | null>(null);
export function DemoConfigProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    api.config().then(c => { if (active) setDate(c.reference_date); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  return <DemoConfig.Provider value={date}>{error && <Alert type="warning" message="The demo reference date could not be loaded." action={<Button onClick={() => setAttempt(a => a + 1)}>Retry</Button>} />}{children}</DemoConfig.Provider>;
}
export const useReferenceDate = () => useContext(DemoConfig);
export function formatDate(value: string, long = false) {
  return new Intl.DateTimeFormat('en-US', { month: long ? 'long' : 'short', day: 'numeric', ...(long ? { year: 'numeric' as const } : {}), timeZone: 'UTC' }).format(new Date(value));
}
export function activityLabel(value: string | null, reference: string | null) {
  if (!value) return 'No activity yet';
  if (!reference) return formatDate(value);
  const days = Math.floor((Date.parse(reference) - Date.parse(value)) / 86400000);
  return days === 0 ? 'Today' : days === 1 ? '1 day ago' : days > 1 ? `${days} days ago` : formatDate(value);
}
