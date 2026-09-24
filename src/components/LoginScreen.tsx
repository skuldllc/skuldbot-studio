// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

/**
 * Studio Login Screen
 *
 * Real login against Orchestrator (POST /auth/studio/login) — replaces the
 * old seat-key activation dialog. Credentials, seat key, and MFA (when
 * required) are all checked together server-side before any session is
 * issued at all; there is nothing to "activate" locally.
 */

import { useState, type FormEvent } from "react";
import { Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { SkuldLogoBox } from "./ui/SkuldLogo";
import { useSessionStore } from "../store/sessionStore";

const MFA_METHOD_LABELS: Record<string, string> = {
  totp: "your authenticator app",
  push: "a push notification",
  webauthn: "your security key",
  fido2: "your security key",
  sms_otp: "a text message",
  email_otp: "email",
};

export function LoginScreen() {
  const { status, error, isSubmitting, mfaMethod, login, submitMfaCode, cancelMfaChallenge } =
    useSessionStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [seatKey, setSeatKey] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const handleCredentialsSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !seatKey.trim()) return;
    login({ email: email.trim(), password, seatKey: seatKey.trim(), rememberMe });
  };

  const handleMfaSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim()) return;
    submitMfaCode(mfaCode.trim());
  };

  const isMfaStep = status === "mfaRequired";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <SkuldLogoBox size="lg" />
          <h1 className="mt-4 text-xl font-semibold text-slate-800">SkuldBot Studio</h1>
          <p className="text-sm text-slate-500">
            {isMfaStep ? "Verify it's you" : "Sign in to your Studio seat"}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {!isMfaStep ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label htmlFor="studio-login-email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <Input
                  id="studio-login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label htmlFor="studio-login-password" className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <Input
                  id="studio-login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div>
                <label htmlFor="studio-login-seat-key" className="block text-sm font-medium text-slate-700 mb-1">
                  Studio seat key
                </label>
                <Input
                  id="studio-login-seat-key"
                  type="text"
                  value={seatKey}
                  onChange={(e) => setSeatKey(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="font-mono uppercase"
                  required
                />
              </div>

              <label htmlFor="studio-login-remember-me" className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  id="studio-login-remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Keep me signed in on this device
              </label>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="default"
                className="w-full"
                disabled={isSubmitting || !email.trim() || !password || !seatKey.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-primary-50 border border-primary-100 rounded-lg">
                <ShieldCheck className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-primary-800">
                  Enter the verification code from{" "}
                  {MFA_METHOD_LABELS[mfaMethod ?? ""] ?? "your second factor"}.
                </p>
              </div>

              <div>
                <label htmlFor="studio-login-mfa-code" className="block text-sm font-medium text-slate-700 mb-1">
                  Verification code
                </label>
                <Input
                  id="studio-login-mfa-code"
                  type="text"
                  inputMode="numeric"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="000000"
                  className="font-mono text-center text-lg tracking-widest"
                  autoFocus
                  required
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={cancelMfaChallenge}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  className="flex-1"
                  disabled={isSubmitting || !mfaCode.trim()}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                </Button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Need a Studio seat? Visit{" "}
          <a
            href="https://skuldbot.com/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            skuldbot.com/pricing
          </a>{" "}
          or contact sales@skuldbot.com.
        </p>
      </div>
    </div>
  );
}

export default LoginScreen;
