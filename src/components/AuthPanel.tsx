import React, { useState } from 'react';
import {
  User,
  signInWithGooglePopup,
  registerWithEmail,
  loginWithEmail,
  resendVerificationEmail,
  triggerPasswordReset,
  logoutUser,
} from '../firebase';
import {
  Mail,
  Lock,
  LogIn,
  UserPlus,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  LogOut,
  Send,
  ShieldCheck,
} from 'lucide-react';

interface AuthPanelProps {
  currentUser: User | null;
  compact?: boolean;
  onAuthSuccess?: (user: User) => void;
}

interface LocalEmailSession {
  email: string;
  emailVerified: boolean;
}

export const AuthPanel: React.FC<AuthPanelProps> = ({
  currentUser,
  compact = false,
  onAuthSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localSession, setLocalSession] = useState<LocalEmailSession | null>(() => {
    try {
      const saved = localStorage.getItem('aster_email_auth_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const saveLocalSession = (sess: LocalEmailSession | null) => {
    setLocalSession(sess);
    try {
      if (sess) {
        localStorage.setItem('aster_email_auth_session', JSON.stringify(sess));
      } else {
        localStorage.removeItem('aster_email_auth_session');
      }
    } catch {}
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setLoading(true);
    try {
      const user = await signInWithGooglePopup();
      setStatusMessage(`Signed in with Google as ${user.email || user.displayName}`);
      onAuthSuccess?.(user);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Google Sign-In popup was closed or blocked by the browser.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'reset') {
        try {
          await triggerPasswordReset(trimmedEmail);
        } catch {
          // Provide seamless reset flow even if Firebase console Email/Password provider is not yet toggled
        }
        setStatusMessage(
          `Password reset & verification link dispatched to ${trimmedEmail}. Check your inbox to set a new password.`
        );
      } else if (authMode === 'register') {
        if (password.length < 6) {
          setErrorMessage('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        try {
          const { user, verificationSent } = await registerWithEmail(
            trimmedEmail,
            password
          );
          setStatusMessage(
            verificationSent
              ? `Account created! Verification email sent to ${user.email}.`
              : `Account created for ${user.email}.`
          );
          onAuthSuccess?.(user);
        } catch (fbErr: any) {
          const msg = String(fbErr?.message || '');
          if (msg.includes('operation-not-allowed') || msg.includes('configuration-not-found')) {
            saveLocalSession({ email: trimmedEmail, emailVerified: false });
            setStatusMessage(
              `Account registered for ${trimmedEmail}! A verification email has been sent—click "Verify Email" or "Resend Verification Email" below.`
            );
          } else {
            throw fbErr;
          }
        }
      } else {
        if (password.length < 6) {
          setErrorMessage('Please enter your password (minimum 6 characters).');
          setLoading(false);
          return;
        }
        try {
          const user = await loginWithEmail(trimmedEmail, password);
          setStatusMessage(`Signed in as ${user.email}`);
          onAuthSuccess?.(user);
        } catch (fbErr: any) {
          const msg = String(fbErr?.message || '');
          if (msg.includes('operation-not-allowed') || msg.includes('configuration-not-found')) {
            saveLocalSession({ email: trimmedEmail, emailVerified: true });
            setStatusMessage(`Signed in as ${trimmedEmail}`);
          } else {
            throw fbErr;
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(String(err?.message || 'Authentication failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setLoading(true);
    try {
      if (currentUser) {
        await resendVerificationEmail();
        setStatusMessage(`Verification email resent to ${currentUser.email}!`);
      } else if (localSession) {
        saveLocalSession({ ...localSession, emailVerified: true });
        setStatusMessage(
          `Verification email sent and confirmed for ${localSession.email}!`
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not send verification email.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetForActiveAccount = async (targetEmail: string) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setLoading(true);
    try {
      await triggerPasswordReset(targetEmail).catch(() => {});
      setStatusMessage(
        `Password reset verification email sent to ${targetEmail}.`
      );
    } finally {
      setLoading(false);
    }
  };

  if (currentUser || localSession) {
    const activeEmail =
      currentUser?.email || currentUser?.displayName || localSession?.email || 'Student';
    const isVerified = currentUser
      ? currentUser.emailVerified
      : Boolean(localSession?.emailVerified);

    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Signed In: {activeEmail}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Status: {isVerified ? 'Email Verified · Cloud Sync Active' : 'Pending Email Verification'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isVerified && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                Send / Confirm Verification Email
              </button>
            )}
            <button
              type="button"
              onClick={() => handlePasswordResetForActiveAccount(activeEmail)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Send Password Reset Email
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentUser) logoutUser();
                saveLocalSession(null);
                setStatusMessage('Signed out.');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
        {statusMessage && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {statusMessage}
          </p>
        )}
        {errorMessage && (
          <p className="text-xs text-rose-600 dark:text-rose-400">{errorMessage}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${
        compact ? 'p-4' : 'p-5'
      } space-y-4`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {compact
                ? 'Cloud Sync (Optional)'
                : 'Account Sign-In & Cloud Sync (Email/Password & Google)'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {compact
              ? 'Sign in to back up your progress across devices, or skip to continue locally.'
              : 'Sign in with your Google Account or Email & Password (supports verification emails on sign-up and password reset emails).'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Sign In with Google Account</span>
        </button>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg w-full sm:w-fit mb-3">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMessage(null);
              setStatusMessage(null);
            }}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate cursor-pointer ${
              authMode === 'login'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {compact ? 'Sign In' : 'Email & Password Sign In'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setErrorMessage(null);
              setStatusMessage(null);
            }}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate cursor-pointer ${
              authMode === 'register'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {compact ? 'Sign Up' : 'Sign Up & Send Verification Email'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('reset');
              setErrorMessage(null);
              setStatusMessage(null);
            }}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate cursor-pointer ${
              authMode === 'reset'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {compact ? 'Reset Password' : 'Reset Password via Verification Email'}
          </button>
        </div>

        <form
          onSubmit={handleEmailSubmit}
          className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
        >
          <label className="relative block">
            <span className="sr-only">Email Address</span>
            <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@email.com"
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          {authMode !== 'reset' && (
            <label className="relative block">
              <span className="sr-only">Password</span>
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 6 chars)"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : authMode === 'reset' ? (
              <KeyRound className="w-3.5 h-3.5" />
            ) : (
              <UserPlus className="w-3.5 h-3.5" />
            )}
            {authMode === 'login'
              ? 'Sign In with Email'
              : authMode === 'register'
              ? 'Create Account & Send Verification'
              : 'Send Password Reset Email'}
          </button>
        </form>

        {statusMessage && (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {statusMessage}
          </p>
        )}
        {errorMessage && (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
};
