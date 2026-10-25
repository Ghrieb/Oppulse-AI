import { z } from 'zod';
import { isoDateTimeSchema, urlSchema, uuidSchema } from './common';

/**
 * Monitoring and alert schemas.
 *
 * Monitoring is scheduled, not real-time. The UI must always show the real
 * `lastSuccessfulCheckAt` and `nextScheduledCheckAt` (spec §9.2).
 */

export const monitorTargetTypeSchema = z.enum(['mission', 'opportunity', 'url']);

export const monitorFrequencySchema = z.enum(['hourly', 'daily', 'weekly']);

export const monitorStatusSchema = z.enum(['active', 'paused', 'error']);

export const monitorTargetSchema = z.object({
  id: uuidSchema,
  targetType: monitorTargetTypeSchema,
  /** For `mission` and `opportunity` targets. */
  targetId: uuidSchema.nullable(),
  label: z.string(),
  url: urlSchema.nullable(),
  frequency: monitorFrequencySchema,
  status: monitorStatusSchema,
  /** Null when no check has ever succeeded — never a fake timestamp. */
  lastSuccessfulCheckAt: isoDateTimeSchema.nullable(),
  nextScheduledCheckAt: isoDateTimeSchema.nullable(),
  eventsDetected: z.number().int().nonnegative(),
  /** True when the last attempt could not reach the source. */
  sourceUnreachable: z.boolean(),
});

export const monitorTargetListSchema = z.object({
  targets: z.array(monitorTargetSchema),
});

export const monitorEventTypeSchema = z.enum([
  'deadline_changed',
  'applications_opened',
  'funding_updated',
  'eligibility_changed',
  'new_opportunity',
  'page_unreachable',
  'content_updated',
]);

export const monitorEventSchema = z.object({
  id: uuidSchema,
  monitorTargetId: uuidSchema,
  type: monitorEventTypeSchema,
  /** 1. What changed? */
  whatChanged: z.string(),
  /** 2. Why does it matter to this student? */
  whyItMatters: z.string(),
  /** 3. What should they do next? */
  recommendedAction: z.string(),
  detectedAt: isoDateTimeSchema,
  sourceUrl: urlSchema,
  previousHash: z.string().nullable(),
  contentHash: z.string(),
  /** True for the deliberately triggered demonstration event. */
  isTestEvent: z.boolean(),
});

export const monitorEventListSchema = z.object({
  events: z.array(monitorEventSchema),
});

export const alertSeveritySchema = z.enum(['info', 'success', 'warning', 'danger']);

/**
 * The channels the product can deliver on **right now**.
 *
 * An email channel and a mobile-push channel are *future* capabilities and
 * are deliberately absent from this runtime schema. They may not be added to
 * one side of the contract alone: the OpenAPI comparison in CI fails the
 * build if the frontend and the backend disagree about the public channel
 * set, and the backend filters delivery records to the active set before
 * serialising them.
 *
 * The future set is declared in `FUTURE_NOTIFICATION_CHANNELS` so the
 * backend design and the interface cannot drift apart, without putting an
 * undeliverable channel into the contract the client parses.
 */
export const activeNotificationChannelSchema = z.enum(['in_app']);
export type ActiveNotificationChannel = z.infer<typeof activeNotificationChannelSchema>;

/**
 * The channels that are designed for, but not implemented.
 *
 * Email is an optional future adapter: it arrives when the core AI flow is
 * stable, and not before. Mobile push waits for a mobile app.
 */
export const FUTURE_NOTIFICATION_CHANNELS = ['email', 'mobile_push'] as const;
export type FutureNotificationChannel = (typeof FUTURE_NOTIFICATION_CHANNELS)[number];

/** The channel a delivery record is about. */
export const notificationChannelSchema = activeNotificationChannelSchema;
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

/**
 * The outcome of one delivery attempt on one channel.
 *
 * `suppressed` is deliberately distinct from `not_configured`: a suppressed
 * delivery means the user asked for no email of this type, which is a
 * working setting rather than a fault, and the interface must not invite
 * them to "fix" it.
 */
export const deliveryStatusSchema = z.enum([
  'not_configured',
  'pending',
  'delivered',
  'failed',
  'suppressed',
]);

/** One channel's delivery record for one alert. */
export const channelDeliverySchema = z.object({
  channel: notificationChannelSchema,
  status: deliveryStatusSchema,
  /** A safe reason — never the message body. Null when there is no problem. */
  error: z.string().nullable(),
  attemptedAt: isoDateTimeSchema.nullable(),
  deliveredAt: isoDateTimeSchema.nullable(),
  /** Makes a retry idempotent: the same key is never delivered twice. */
  idempotencyKey: z.string().nullable(),
});
export type ChannelDelivery = z.infer<typeof channelDeliverySchema>;

/**
 * How much of the student's personal data an alert would carry.
 *
 * A `sensitive` alert is never emailed with its payload: the email is a
 * pointer back into the product, and it is never sent to an unverified
 * address at all.
 */
export const alertSensitivitySchema = z.enum(['routine', 'sensitive']);

/**
 * The kinds of alert the user can be emailed about.
 *
 * Each one has its own cadence, so a student can take a daily digest of
 * deadline changes and an immediate note about a funding change.
 */
export const alertCategorySchema = z.enum([
  'deadline',
  'source_change',
  'run_complete',
  'application_task',
]);
/** How often, and whether, a category is emailed. */
export const emailCadenceSchema = z.enum(['off', 'immediate', 'daily_digest', 'weekly_digest']);
export const alertSchema = z.object({
  id: uuidSchema,
  monitorEventId: uuidSchema,
  title: z.string(),
  body: z.string(),
  severity: alertSeveritySchema,
  category: alertCategorySchema,
  sensitivity: alertSensitivitySchema,
  /** One record per channel. The in-app record is always present. */
  delivery: z.object({
    channels: z.array(channelDeliverySchema),
  }),
  read: z.boolean(),
  createdAt: isoDateTimeSchema,
});

export const alertListSchema = z.object({
  alerts: z.array(alertSchema),
  unreadCount: z.number().int().nonnegative(),
});

export const createMonitorTargetRequestSchema = z.object({
  targetType: monitorTargetTypeSchema,
  targetId: uuidSchema.optional(),
  url: urlSchema.optional(),
  label: z.string().min(1).max(140),
  frequency: monitorFrequencySchema,
});

export const updateMonitorTargetRequestSchema = z.object({
  status: z.enum(['active', 'paused']).optional(),
  frequency: monitorFrequencySchema.optional(),
});

export type MonitorTarget = z.infer<typeof monitorTargetSchema>;
export type MonitorTargetType = z.infer<typeof monitorTargetTypeSchema>;
export type MonitorFrequency = z.infer<typeof monitorFrequencySchema>;
export type MonitorEvent = z.infer<typeof monitorEventSchema>;
export type MonitorEventType = z.infer<typeof monitorEventTypeSchema>;
export type Alert = z.infer<typeof alertSchema>;
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;
export type AlertCategory = z.infer<typeof alertCategorySchema>;
export type AlertSensitivity = z.infer<typeof alertSensitivitySchema>;
export type EmailCadence = z.infer<typeof emailCadenceSchema>;
export type CreateMonitorTargetRequest = z.infer<typeof createMonitorTargetRequestSchema>;
export type UpdateMonitorTargetRequest = z.infer<typeof updateMonitorTargetRequestSchema>;
