import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { discordSignInUrl } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type Mode = 'sign-in' | 'create';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Server error codes, in the words a player would use. Anything unlisted falls back to its code. */
const errorMessages: Record<string, string> = {
  invalid_credentials: 'That username and password do not match an account.',
  username_taken: 'That username is already taken.',
  'username required': 'Enter a username.',
  password_or_campaign_required: 'Enter your password.',
  campaign_required_for_passwordless: 'Enter a password to create an account.',
  too_many_auth_attempts: 'Too many attempts. Wait a few minutes and try again.',
  network_error: 'Could not reach the server. Check your connection and try again.',
};

const copy: Record<Mode, { title: string; description: string; submit: string; switchTo: Mode; switchLabel: string }> = {
  'sign-in': {
    title: 'Sign in',
    description: 'Your characters follow your account to any device you sign in on.',
    submit: 'Sign in',
    switchTo: 'create',
    switchLabel: 'Create an account',
  },
  create: {
    title: 'Create an account',
    description: 'Characters you have already built stay on this device until you choose to upload them.',
    submit: 'Create account',
    switchTo: 'sign-in',
    switchLabel: 'I already have an account',
  },
};

export function AuthDialog({ open, onOpenChange }: Readonly<AuthDialogProps>) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { error, pending, register, signIn, clearError } = useAuthStore();

  const text = copy[mode];
  const canSubmit = username.trim().length > 0 && password.length > 0 && !pending;
  const message = error ? (errorMessages[error] ?? `Sign-in failed (${error}).`) : null;

  const switchMode = () => {
    clearError();
    setMode(text.switchTo);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    const credentials = { username: username.trim(), password };
    const succeeded = mode === 'sign-in' ? await signIn(credentials) : await register(credentials);
    if (succeeded) {
      setPassword('');
      onOpenChange(false);
    }
  };

  // Discord sign-in is a full-page navigation: the callback establishes the session server-side
  // and redirects back here, so there is no popup to message back to.
  const handleDiscord = () => {
    window.location.href = discordSignInUrl(window.location.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>{text.description}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="auth-username">Username</Label>
            <Input
              id="auth-username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {message ? <p className="text-sm text-destructive">{message}</p> : null}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {text.submit}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={handleDiscord}>
              Continue with Discord
            </Button>
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={switchMode}>
              {text.switchLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
