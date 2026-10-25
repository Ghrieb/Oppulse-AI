import { http, HttpResponse, delay } from 'msw';
import { apiUrl } from './urls';
import { applyChaos } from '../chaos';
import { getState } from '../state';
import { recomputeAll } from '@/lib/matching';
import { deterministicUuid } from '@/lib/ids';
import { MOCK_KEYS, readValue, removeValue, writeValue } from '../store';

/** Simulated network latency so loading states are genuinely exercised. */
const LATENCY_MS = 45;

async function pause(): Promise<void> {
  await delay(LATENCY_MS);
}

/* ------------------------------------------------------------------ */
/* Authentication                                                       */
/* ------------------------------------------------------------------ */
export const authHandlers = [
  http.get(apiUrl('/auth/session'), async () => {
    const state = getState();

    // The session survives a page reload, exactly as a server-side session
    // would. Without this, a refresh would sign the user out.
    if (!state.signedIn && !readValue<boolean>(MOCK_KEYS.session, false)) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'You need to sign in to continue.' } },
        { status: 401 },
      );
    }

    await pause();
    return HttpResponse.json({
      user: state.user,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  }),

  http.post(apiUrl('/auth/sign-in'), async ({ request }) => {
    await pause();
    const body = (await request.json()) as { email?: string; password?: string };
    const state = getState();

    if (!body.email || !body.password || !body.email.includes('@')) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION',
            message: 'Enter your email address and password.',
            field_errors: {
              email:
                !body.email || !body.email.includes('@') ? ['Enter a valid email address.'] : [],
              password: !body.password ? ['Enter your password.'] : [],
            },
          },
        },
        { status: 422 },
      );
    }

    state.signedIn = true;
    writeValue(MOCK_KEYS.session, true);

    return HttpResponse.json({
      user: state.user,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  }),

  http.post(apiUrl('/auth/sign-up'), async ({ request }) => {
    await pause();
    const body = (await request.json()) as { email?: string; password?: string; fullName?: string };
    const state = getState();

    if (!body.email || !body.password || !body.fullName) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION',
            message: 'Fill in every field to create your account.',
            field_errors: {
              email: !body.email ? ['Enter your email address.'] : [],
              password: !body.password ? ['Use at least 8 characters.'] : [],
              fullName: !body.fullName ? ['Tell us your name.'] : [],
            },
          },
        },
        { status: 422 },
      );
    }

    state.user = { ...state.user, email: body.email, fullName: body.fullName };
    state.profile = {
      ...state.profile,
      email: body.email,
      fullName: body.fullName,
    };
    state.signedIn = true;
    writeValue(MOCK_KEYS.session, true);

    return HttpResponse.json({ user: state.user, signedIn: true }, { status: 201 });
  }),

  http.post(apiUrl('/auth/sign-out'), async () => {
    await pause();
    getState().signedIn = false;
    removeValue(MOCK_KEYS.session);
    return new HttpResponse(null, { status: 204 });
  }),

  /**
   * Asks for a password reset link.
   *
   * The answer is the same whether or not the address has an account: the
   * endpoint must never confirm who has one.
   */
  http.post(apiUrl('/auth/password/forgot'), async ({ request }) => {
    await pause();

    const body = (await request.json()) as { email?: string };
    if (!body.email || !body.email.includes('@')) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION',
            message: 'Enter the email address on your account.',
            field_errors: { email: ['A valid email address is required.'] },
          },
        },
        { status: 422 },
      );
    }

    return HttpResponse.json({ accepted: true });
  }),

  /**
   * Sets a new password with a reset token.
   */
  http.post(apiUrl('/auth/password/reset'), async ({ request }) => {
    await pause();

    const body = (await request.json()) as { token?: string; password?: string };
    if (!body.token) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION',
            message: 'That reset link is not valid or has expired.',
            field_errors: { token: ['The link is not valid.'] },
          },
        },
        { status: 422 },
      );
    }

    return HttpResponse.json({ changed: true });
  }),

  /**
   * Asks the backend to send a verification link.
   *
   * The token comes back in the response because the prototype cannot
   * deliver email yet. In the backend it only ever travels in the message.
   */
  http.post(apiUrl('/auth/email/verification'), async () => {
    await pause();

    const state = getState();
    const token = deterministicUuid(`email-verification:${state.user.email}`);

    return HttpResponse.json({
      token,
      sentTo: state.user.email,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  }),

  /**
   * Confirms the address.
   *
   * Only the backend can set this. The client cannot ask for a verified
   * address, and no sensitive alert is sent to an unverified one.
   */
  http.post(apiUrl('/auth/email/verification/confirm'), async ({ request }) => {
    await pause();

    const state = getState();
    const body = (await request.json()) as { token?: string };
    const expected = deterministicUuid(`email-verification:${state.user.email}`);

    if (!body.token || body.token !== expected) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION',
            message: 'That verification link is not valid or has expired.',
          },
        },
        { status: 422 },
      );
    }

    state.user = {
      ...state.user,
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ user: state.user });
  }),
];

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

/**
 * Reads the uploaded file's metadata.
 *
 * The file is the raw request body: its name travels in
 * `Content-Disposition` and its type in `Content-Type`. The mock models the
 * *processing states* of an upload — it never parses the document itself.
 */
function readUpload(request: Request): {
  filename: string;
  mimeType: string;
  sizeBytes: number;
} {
  const disposition = request.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename="([^"]*)"/i.exec(disposition)?.[1];

  let filename = 'document.pdf';
  if (encoded) {
    try {
      filename = decodeURIComponent(encoded);
    } catch {
      filename = plain ?? filename;
    }
  } else if (plain) {
    filename = plain;
  }

  const mimeType = request.headers.get('content-type') || 'application/octet-stream';
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  const sizeBytes = Number.isFinite(declaredLength) ? declaredLength : 0;

  return { filename, mimeType, sizeBytes };
}

export const documentHandlers = [
  http.get(apiUrl('/documents'), async () => {
    const chaos = await applyChaos('/documents');
    if (chaos) return chaos;
    await pause();
    return HttpResponse.json({ documents: getState().documents });
  }),

  http.post(apiUrl('/documents'), async ({ request }) => {
    const chaos = await applyChaos('/documents');
    if (chaos) return chaos;
    await pause();

    const { filename, mimeType, sizeBytes } = readUpload(request);

    const document = {
      id: `b2000000-0000-4000-8000-${String(getState().documents.length + 1).padStart(12, '0')}`,
      filename,
      mimeType,
      sizeBytes,
      category: 'other' as const,
      status: 'processing' as const,
      proposedFacts: [],
      extraction: {
        proposedFactIds: [],
        unreadSections: [],
        method: 'none' as const,
        completedAt: null,
      },
      consentToUse: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      errorMessage: null,
      downloadUrl: null,
    };

    getState().documents.push(document);
    return HttpResponse.json(document, { status: 201 });
  }),

  http.get(apiUrl('/documents/:id'), async ({ params }) => {
    const chaos = await applyChaos('/documents');
    if (chaos) return chaos;
    await pause();

    const document = getState().documents.find((item) => item.id === params.id);
    if (!document) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That document no longer exists.' } },
        { status: 404 },
      );
    }
    return HttpResponse.json(document);
  }),

  http.get(apiUrl('/documents/:id/content'), async ({ params }) => {
    const chaos = await applyChaos('/documents');
    if (chaos) return chaos;
    await pause();

    const document = getState().documents.find((item) => item.id === params.id);
    if (!document) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That document no longer exists.' } },
        { status: 404 },
      );
    }
    return new HttpResponse(new Uint8Array(), {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': `attachment; filename="${document.filename.replaceAll('"', '')}"`,
      },
    });
  }),

  /**
   * The consent controls for one document.
   *
   * Excluding a document means Oppulse may read it locally, but must not
   * send it to a model provider.
   */
  http.patch(apiUrl('/documents/:id'), async ({ params, request }) => {
    const chaos = await applyChaos('/documents');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const document = state.documents.find((item) => item.id === params.id);

    if (!document) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That document no longer exists.' } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as { consentToUse?: boolean };

    if (body.consentToUse !== undefined) {
      document.consentToUse = body.consentToUse;
      document.updatedAt = new Date().toISOString();
    }

    return HttpResponse.json(document);
  }),

  http.delete(apiUrl('/documents/:id'), async ({ params }) => {
    const chaos = await applyChaos('/documents');
    if (chaos) return chaos;
    await pause();

    const state = getState();
    const index = state.documents.findIndex((item) => item.id === params.id);
    if (index < 0) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'That document no longer exists.' } },
        { status: 404 },
      );
    }

    const [removed] = state.documents.splice(index, 1);

    // Facts extracted from a deleted document stop being usable, unless the
    // student confirmed them separately.
    for (const fact of state.profile.facts) {
      if (fact.source?.documentId !== removed?.id) continue;
      if (fact.status === 'confirmed') {
        fact.source = null;
        fact.excluded = true;
        fact.updatedAt = new Date().toISOString();
        continue;
      }
      fact.status = 'rejected';
      fact.source = null;
      fact.updatedAt = new Date().toISOString();
    }

    const recomputed = recomputeAll(state.opportunities, state.matches, state.profile);
    state.opportunities = recomputed.opportunities;
    state.matches = recomputed.matches;

    return new HttpResponse(null, { status: 204 });
  }),
];
