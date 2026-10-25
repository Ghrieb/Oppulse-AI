import {
  Bell,
  ClipboardList,
  Compass,
  FolderOpen,
  House,
  MessageSquareText,
  Settings,
  Target,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Primary navigation.
 *
 * These are the destinations from the product specification (§3.1). The
 * order is deliberate: discovery first, then the artefacts of acting.
 */
export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile drawer; keep the mobile list short. */
  primaryMobile: boolean;
  /** Number of unread alerts, injected at render time. */
  badge?: 'alerts';
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/home', label: 'Home', icon: House, primaryMobile: true },
  { to: '/goals', label: 'My goals', icon: Target, primaryMobile: true },
  { to: '/opportunities', label: 'Opportunities', icon: Compass, primaryMobile: true },
  { to: '/profile', label: 'Profile & CV', icon: UserRound, primaryMobile: false },
  { to: '/documents', label: 'My documents', icon: FolderOpen, primaryMobile: false },
  {
    to: '/applications',
    label: 'Application workspace',
    icon: ClipboardList,
    primaryMobile: true,
  },
  {
    to: '/monitoring',
    label: 'Monitoring & alerts',
    icon: Bell,
    primaryMobile: false,
    badge: 'alerts',
  },
  { to: '/assistant', label: 'AI assistant', icon: MessageSquareText, primaryMobile: false },
  { to: '/settings', label: 'Settings', icon: Settings, primaryMobile: false },
];

/** Routes reachable from the top-bar command palette. */
export const COMMAND_ITEMS = [
  { to: '/home', label: 'Go to home', group: 'Navigate' },
  { to: '/goals', label: 'Create or review a mission', group: 'Navigate' },
  { to: '/opportunities', label: 'Browse opportunities', group: 'Navigate' },
  { to: '/profile', label: 'Open my profile passport', group: 'Navigate' },
  { to: '/documents', label: 'Upload or review documents', group: 'Navigate' },
  { to: '/applications', label: 'Open an application workspace', group: 'Navigate' },
  { to: '/monitoring', label: 'Review monitoring and alerts', group: 'Navigate' },
  { to: '/assistant', label: 'Ask Oppulse a question', group: 'Navigate' },
  { to: '/settings', label: 'Open settings', group: 'Navigate' },
] as const;
