import { authHandlers, documentHandlers } from './core';
import { profileHandlers } from './profile';
import { assistantHandlers } from './assistant';
import { missionHandlers, opportunityHandlers, runHandlers } from './discovery';
import { applicationHandlers, draftHandlers, monitoringHandlers } from './action';
import { onboardingHandlers } from './onboarding';
import { capabilityHandlers } from './capability';
import { nextActionHandlers } from './next-action';

export const handlers = [
  ...authHandlers,
  ...profileHandlers,
  ...documentHandlers,
  ...onboardingHandlers,
  ...capabilityHandlers,
  ...nextActionHandlers,
  ...assistantHandlers,
  ...missionHandlers,
  ...runHandlers,
  ...opportunityHandlers,
  ...applicationHandlers,
  ...draftHandlers,
  ...monitoringHandlers,
  ...assistantHandlers,
];
