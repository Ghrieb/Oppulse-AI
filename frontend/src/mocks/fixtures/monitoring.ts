import type { Alert, MonitorEvent, MonitorTarget } from '@/lib/schemas';

/**
 * Monitoring fixtures.
 *
 * Monitoring is scheduled, not real-time. `lastSuccessfulCheckAt` is null
 * where no check has ever succeeded, and one target deliberately shows a
 * failed check so the UI has to be honest about it.
 */

export const DEMO_MONITOR_TARGETS: MonitorTarget[] = [
  {
    id: '80000000-0000-4000-8000-000000000001',
    targetType: 'mission',
    targetId: '1b000000-0000-4000-8000-000000000001',
    label: 'Fully funded research internships in Europe',
    url: null,
    frequency: 'daily',
    status: 'active',
    lastSuccessfulCheckAt: '2026-10-19T06:00:12.000Z',
    nextScheduledCheckAt: '2026-10-20T06:00:00.000Z',
    eventsDetected: 2,
    sourceUnreachable: false,
  },
  {
    id: '80000000-0000-4000-8000-000000000002',
    targetType: 'opportunity',
    targetId: 'd4000000-0000-4000-8000-000000000006',
    label: 'Verdant Climate Data Fellowship',
    url: 'https://verdant-fellowship.eu/calls/climate-data',
    frequency: 'daily',
    status: 'active',
    lastSuccessfulCheckAt: '2026-10-19T06:00:20.000Z',
    nextScheduledCheckAt: '2026-10-20T06:00:00.000Z',
    eventsDetected: 1,
    sourceUnreachable: false,
  },
  {
    id: '80000000-0000-4000-8000-000000000003',
    targetType: 'url',
    targetId: null,
    label: 'Northwind Summer Research Programme',
    url: 'https://northwind-program.org/summer-research',
    frequency: 'daily',
    status: 'error',
    lastSuccessfulCheckAt: null,
    nextScheduledCheckAt: '2026-10-20T06:00:00.000Z',
    eventsDetected: 0,
    sourceUnreachable: true,
  },
];

export const DEMO_MONITOR_EVENTS: MonitorEvent[] = [
  {
    id: '90000000-0000-4000-8000-000000000001',
    monitorTargetId: '80000000-0000-4000-8000-000000000001',
    type: 'deadline_changed',
    whatChanged:
      'The Helios Fellowship closing date moved from 13 November 2026 to 20 November 2026.',
    whyItMatters:
      'You have a reference letter waiting on a lecturer, and the extra week gives you room to collect it before the deadline.',
    recommendedAction:
      'Re-check your reference letter request and keep your 5 November proposal deadline — it now sits well inside the window.',
    detectedAt: '2026-10-19T06:00:12.000Z',
    sourceUrl: 'https://helios-fellowship.org/programmes/computational-biology',
    previousHash: 'sha256:9f2c14be77a0',
    contentHash: 'sha256:b8170d4e2fa1',
    isTestEvent: false,
  },
  {
    id: '90000000-0000-4000-8000-000000000002',
    monitorTargetId: '80000000-0000-4000-8000-000000000002',
    type: 'funding_updated',
    whatChanged:
      'The Verdant Climate Data Fellowship increased its equipment budget from EUR 2,500 to EUR 4,000.',
    whyItMatters:
      'Your estimated uncovered cost for this fellowship drops by EUR 1,500, which moves it from partly funded to fully funded in practice.',
    recommendedAction:
      'Open the official call and confirm the new figure, then start the application — the deadline still needs resolving.',
    detectedAt: '2026-10-19T06:00:20.000Z',
    sourceUrl: 'https://verdant-fellowship.eu/calls/climate-data',
    previousHash: 'sha256:3d7c1b8e4409',
    contentHash: 'sha256:71ac09f3b6de',
    isTestEvent: true,
  },
];

export const DEMO_ALERTS: Alert[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    monitorEventId: '90000000-0000-4000-8000-000000000002',
    title: 'Verdant Climate Data Fellowship — funding increased',
    body: 'The equipment budget rose from EUR 2,500 to EUR 4,000. Your uncovered cost drops by EUR 1,500. This was a controlled test event, triggered to demonstrate background monitoring.',
    severity: 'success',
    category: 'source_change',
    // It names a programme the student is tracking, so it is personal.
    sensitivity: 'sensitive',
    delivery: {
      channels: [
        {
          channel: 'in_app',
          status: 'delivered',
          error: null,
          attemptedAt: '2026-10-19T06:00:22.000Z',
          deliveredAt: '2026-10-19T06:00:22.000Z',
          idempotencyKey: 'a0000000-0000-4000-8000-000000000001:in_app',
        },
      ],
    },
    read: false,
    createdAt: '2026-10-19T06:00:22.000Z',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    monitorEventId: '90000000-0000-4000-8000-000000000001',
    title: 'Helios Fellowship — deadline extended by 7 days',
    body: 'The closing date moved from 13 November 2026 to 20 November 2026. This gives you more time to collect your reference letter.',
    severity: 'info',
    category: 'deadline',
    sensitivity: 'sensitive',
    delivery: {
      channels: [
        {
          channel: 'in_app',
          status: 'delivered',
          error: null,
          attemptedAt: '2026-10-19T06:00:14.000Z',
          deliveredAt: '2026-10-19T06:00:14.000Z',
          idempotencyKey: 'a0000000-0000-4000-8000-000000000002:in_app',
        },
      ],
    },
    read: false,
    createdAt: '2026-10-19T06:00:14.000Z',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    monitorEventId: '90000000-0000-4000-8000-000000000003',
    title: 'Northwind Summer Research Programme could not be checked',
    body: 'The scheduled check did not reach the source. No conclusion is drawn about the programme. Open the page manually or upload the announcement PDF.',
    severity: 'warning',
    category: 'source_change',
    sensitivity: 'sensitive',
    delivery: {
      channels: [
        {
          channel: 'in_app',
          status: 'delivered',
          error: null,
          attemptedAt: '2026-10-18T06:00:09.000Z',
          deliveredAt: '2026-10-18T06:00:09.000Z',
          idempotencyKey: 'a0000000-0000-4000-8000-000000000003:in_app',
        },
      ],
    },
    read: true,
    createdAt: '2026-10-18T06:00:09.000Z',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    monitorEventId: '90000000-0000-4000-8000-000000000001',
    title: 'Research run finished — 9 sources reviewed',
    body: 'Your weekly run reviewed 9 sources and found 2 new candidates. Nothing was applied to your plan without you.',
    severity: 'info',
    category: 'run_complete',
    // System news about the run, not about the student's programme.
    sensitivity: 'routine',
    delivery: {
      channels: [
        {
          channel: 'in_app',
          status: 'delivered',
          error: null,
          attemptedAt: '2026-10-18T06:00:08.000Z',
          deliveredAt: '2026-10-18T06:00:08.000Z',
          idempotencyKey: 'a0000000-0000-4000-8000-000000000004:in_app',
        },
      ],
    },
    read: true,
    createdAt: '2026-10-18T06:00:08.000Z',
  },
];
