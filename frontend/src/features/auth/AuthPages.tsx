import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ErrorSummary } from '@/components/feedback/forms';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/queries';
import { signInRequestSchema, signUpRequestSchema, sessionSchema } from '@/lib/schemas';

/**
 * Authentication.
 *
 * Sign-in is owned by our backend, so a judge can create an account and get
 * in without waiting for an email confirmation.
 */
function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-3">
          <img
            src="/brand/oppulse-mark-white.svg"
            alt=""
            aria-hidden="true"
            className="size-10 shrink-0"
          />
          <div>
            <p className="text-sm font-semibold text-white">Oppulse AI</p>
            <p className="text-meta text-white/60">Opportunity Action Agent</p>
          </div>
        </div>

        <div className="flex max-w-md flex-col gap-4">
          <h2 className="text-2xl leading-tight font-semibold text-white">
            Your goals. Our AI agent. Real opportunities.
          </h2>
          <p className="text-sm leading-relaxed text-white/70">
            Upload your CV, describe what you are looking for, and the agent researches the web,
            checks every requirement against your profile, and keeps watching for changes — with the
            source attached to every claim.
          </p>
        </div>

        <p className="text-meta text-white/50">
          Discover → Understand → Verify → Prepare → Apply → Monitor
        </p>
      </div>

      <main id="main-content" className="flex items-center justify-center bg-background px-4 py-10">
        <div className="flex w-full max-w-md flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-page-title font-semibold tracking-tight text-text">{title}</h1>
            <p className="text-sm text-text-muted">{subtitle}</p>
          </div>
          {children}
          <div className="text-sm text-text-muted">{footer}</div>
        </div>
      </main>
    </div>
  );
}

export function SignInPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string[]; password?: string[] }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** Where to go once the session exists. */
  const destination = next ?? '/onboarding';

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setFormError(null);

    const parsed = signInRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors({
        email: parsed.error.issues.filter((i) => i.path[0] === 'email').map((i) => i.message),
        password: parsed.error.issues.filter((i) => i.path[0] === 'password').map((i) => i.message),
      });
      return;
    }
    setErrors({});

    setPending(true);
    try {
      await apiClient.post('/auth/sign-in', parsed.data, { schema: sessionSchema });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      void navigate(destination);
    } catch {
      setFormError('We could not sign you in with those details. Check them and try again.');
    } finally {
      setPending(false);
    }
  };

  const summary = [
    ...(errors.email ?? []).map((message) => `Email — ${message}`),
    ...(errors.password ?? []).map((message) => `Password — ${message}`),
  ];

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Open your opportunity workspace."
      footer={
        <>
          New here?{' '}
          <Link
            to="/auth/sign-up"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {summary.length > 0 ? <ErrorSummary errors={summary} /> : null}
        {formError ? (
          <div
            role="alert"
            className="rounded-card border border-danger/30 bg-danger-surface px-4 py-3 text-sm text-danger"
          >
            {formError}
          </div>
        ) : null}

        <Field label="Email address" errors={errors.email} required>
          {(props) => (
            <Input
              {...props}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@university.edu"
            />
          )}
        </Field>

        <Field label="Password" errors={errors.password} required>
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        <Button
          type="submit"
          size="lg"
          loading={pending}
          loadingLabel="Signing in…"
          className="w-full"
        >
          Sign in
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            void navigate('/opportunities');
          }}
        >
          Browse opportunities without signing in
        </Button>
      </form>
    </AuthLayout>
  );
}

export function SignUpPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const destination = next ?? '/onboarding';

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setFormError(null);

    const parsed = signUpRequestSchema.safeParse({ fullName, email, password });
    if (!parsed.success) {
      const grouped: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        grouped[key] = [...(grouped[key] ?? []), issue.message];
      }
      setErrors(grouped);
      return;
    }
    setErrors({});

    setPending(true);
    try {
      await apiClient.post('/auth/sign-up', parsed.data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      void navigate(destination);
    } catch {
      setFormError('We could not create your account. Nothing was saved — please try again.');
    } finally {
      setPending(false);
    }
  };

  const summary = Object.entries(errors).flatMap(([key, messages]) =>
    messages.map((message) => `${key} — ${message}`),
  );

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="A private workspace for your profile, your opportunities and your applications."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/auth/sign-in"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {summary.length > 0 ? <ErrorSummary errors={summary} /> : null}
        {formError ? (
          <div
            role="alert"
            className="rounded-card border border-danger/30 bg-danger-surface px-4 py-3 text-sm text-danger"
          >
            {formError}
          </div>
        ) : null}

        <Field label="Full name" errors={errors.fullName} required>
          {(props) => (
            <Input
              {...props}
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          )}
        </Field>

        <Field
          label="Email address"
          errors={errors.email}
          helperText="We use this to sign you in. It is never shown to other users."
          required
        >
          {(props) => (
            <Input
              {...props}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@university.edu"
            />
          )}
        </Field>

        <Field
          label="Password"
          errors={errors.password}
          helperText="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
          required
        >
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        <Button
          type="submit"
          size="lg"
          loading={pending}
          loadingLabel="Creating my workspace…"
          className="w-full"
        >
          Create my workspace
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            void navigate('/opportunities');
          }}
        >
          Browse opportunities without signing in
        </Button>
      </form>
    </AuthLayout>
  );
}
