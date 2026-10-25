import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api/client';
import { sessionSchema } from '@/lib/schemas';
import { queryKeys, useSession } from '@/lib/queries';
import type { IntentChoice } from '@/lib/schemas/onboarding';

const DEMO_EMAIL = 'sara.benali@example.edu';
const DEMO_PASSWORD = 'demo-workspace-access';

/**
 * Starting Oppulse.
 *
 * A signed-in visitor goes straight to onboarding. A signed-out visitor is
 * sent to register and is returned to the same step afterwards. Exploration
 * is intentionally separate: the landing page can be visited without an
 * account, while personal inputs still begin here.
 */
export function useStartOnboarding(): (intent?: IntentChoice) => void {
  const navigate = useNavigate();
  const { data: session } = useSession();

  return (intent?: IntentChoice) => {
    const target = intent ? `/onboarding?intent=${intent}` : '/onboarding';

    if (session) {
      void navigate(target);
      return;
    }

    void navigate(`/auth/sign-up?next=${encodeURIComponent(target)}`);
  };
}

/**
 * Demo access.
 *
 * Signs in as the demo student and continues through the real onboarding
 * flow, so a reviewer sees the agent learning the user rather than a
 * pre-baked screen.
 */
export function useDemoAccess() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiClient.post(
        '/auth/sign-in',
        { email: DEMO_EMAIL, password: DEMO_PASSWORD },
        { schema: sessionSchema },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      void navigate('/onboarding');
    },
  });
}
