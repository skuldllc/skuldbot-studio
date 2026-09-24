// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import { StudioAuthUser, StudioSeatSession, StudioLoginOutcome } from "../types/ai-planner";
import { useToastStore } from "./toastStore";

// ============================================================
// Studio Session Store
//
// A session only ever comes from POST /auth/studio/login (see
// src-tauri/src/main.rs, studio_login): real credentials plus a seat key,
// checked together server-side before any session is issued at all. There
// is no client-side "activate a seat" action anymore and no persisted-forever
// seat flag — restoreSession() re-validates with a live refresh call every
// time the app launches, and a rejected refresh clears the session instead
// of quietly keeping stale state around.
//
// Access/refresh tokens never reach this store or any other JS code: the
// Rust side writes them straight to the OS keyring and reads them back the
// same way. Only non-secret session info (user, studioSeat, sessionExpiresAt)
// is persisted here, and only for instant display on next launch while
// restoreSession() confirms it against the server in the background.
// ============================================================

export type StudioSessionStatus = "checking" | "unauthenticated" | "mfaRequired" | "authenticated";

interface PendingCredentials {
  email: string;
  password: string;
  seatKey: string;
  studioInstanceId?: string;
  rememberMe?: boolean;
}

interface LoginInput {
  email: string;
  password: string;
  seatKey: string;
  studioInstanceId?: string;
  rememberMe?: boolean;
}

interface SessionStoreState {
  status: StudioSessionStatus;
  user: StudioAuthUser | null;
  studioSeat: StudioSeatSession | null;
  sessionExpiresAt: string | null;
  mfaMethod: string | null;
  error: string | null;
  isSubmitting: boolean;

  // Held only in memory between the credentials step and the MFA step —
  // never persisted, never sent anywhere except back to the same login call.
  _pendingCredentials: PendingCredentials | null;

  restoreSession: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  submitMfaCode: (code: string) => Promise<void>;
  cancelMfaChallenge: () => void;
  logout: () => Promise<void>;
  hasFeature: (feature: string) => boolean;
  isAuthenticated: () => boolean;
}

function applyOutcome(
  set: (partial: Partial<SessionStoreState>) => void,
  outcome: StudioLoginOutcome,
  pendingCredentials: PendingCredentials | null,
) {
  if (outcome.status === "mfaRequired") {
    set({
      status: "mfaRequired",
      mfaMethod: outcome.mfaMethod,
      error: null,
      _pendingCredentials: pendingCredentials,
    });
    return;
  }

  set({
    status: "authenticated",
    user: outcome.user,
    studioSeat: outcome.studioSeat,
    sessionExpiresAt: outcome.sessionExpiresAt,
    mfaMethod: null,
    error: null,
    _pendingCredentials: null,
  });
}

export const useSessionStore = create<SessionStoreState>()(
  persist(
    (set, get) => ({
      status: "checking",
      user: null,
      studioSeat: null,
      sessionExpiresAt: null,
      mfaMethod: null,
      error: null,
      isSubmitting: false,
      _pendingCredentials: null,

      restoreSession: async () => {
        set({ status: "checking" });
        try {
          const sessionExpiresAt = await invoke<string | null>("studio_restore_session");
          if (!sessionExpiresAt) {
            set({
              status: "unauthenticated",
              user: null,
              studioSeat: null,
              sessionExpiresAt: null,
            });
            return;
          }
          // Refresh confirms the session is alive but doesn't carry user/
          // studioSeat (Orchestrator's refresh contract is tokens-only) — the
          // cached values from the last real login remain the display source
          // until the user logs in again.
          set({ status: "authenticated", sessionExpiresAt });
        } catch (error) {
          set({
            status: "unauthenticated",
            user: null,
            studioSeat: null,
            sessionExpiresAt: null,
          });
          console.error("Failed to restore Studio session:", error);
        }
      },

      login: async (input: LoginInput) => {
        const toast = useToastStore.getState();
        set({ isSubmitting: true, error: null });

        try {
          const outcome = await invoke<StudioLoginOutcome>("studio_login", {
            email: input.email,
            password: input.password,
            seatKey: input.seatKey,
            studioInstanceId: input.studioInstanceId,
            mfaCode: undefined,
            rememberMe: input.rememberMe,
          });

          applyOutcome(set, outcome, {
            email: input.email,
            password: input.password,
            seatKey: input.seatKey,
            studioInstanceId: input.studioInstanceId,
            rememberMe: input.rememberMe,
          });

          if (outcome.status === "success") {
            toast.success("Signed in", `Welcome back, ${outcome.user.firstName}`);
          }
        } catch (error) {
          const message = String(error);
          set({ error: message, status: "unauthenticated" });
          toast.error("Sign-in failed", message);
        } finally {
          set({ isSubmitting: false });
        }
      },

      submitMfaCode: async (code: string) => {
        const toast = useToastStore.getState();
        const pending = get()._pendingCredentials;
        if (!pending) {
          set({ error: "Session expired, please sign in again.", status: "unauthenticated" });
          return;
        }

        set({ isSubmitting: true, error: null });

        try {
          const outcome = await invoke<StudioLoginOutcome>("studio_login", {
            email: pending.email,
            password: pending.password,
            seatKey: pending.seatKey,
            studioInstanceId: pending.studioInstanceId,
            mfaCode: code,
            rememberMe: pending.rememberMe,
          });

          applyOutcome(set, outcome, pending);

          if (outcome.status === "success") {
            toast.success("Signed in", `Welcome back, ${outcome.user.firstName}`);
          }
        } catch (error) {
          const message = String(error);
          set({ error: message });
          toast.error("MFA verification failed", message);
        } finally {
          set({ isSubmitting: false });
        }
      },

      cancelMfaChallenge: () => {
        set({ status: "unauthenticated", mfaMethod: null, error: null, _pendingCredentials: null });
      },

      logout: async () => {
        try {
          await invoke("studio_logout");
        } catch (error) {
          console.error("Failed to revoke Studio session server-side:", error);
        } finally {
          set({
            status: "unauthenticated",
            user: null,
            studioSeat: null,
            sessionExpiresAt: null,
            mfaMethod: null,
            error: null,
            _pendingCredentials: null,
          });
        }
      },

      hasFeature: (feature: string) => {
        const { studioSeat } = get();
        return studioSeat?.features.includes(feature) ?? false;
      },

      isAuthenticated: () => get().status === "authenticated",
    }),
    {
      name: "skuldbot-studio-session",
      partialize: (state) => ({
        user: state.user,
        studioSeat: state.studioSeat,
        sessionExpiresAt: state.sessionExpiresAt,
      }),
    }
  )
);

// ============================================================
// Helper Hooks
// ============================================================

export const useCanUseAIPlanner = () => {
  const hasFeature = useSessionStore((state) => state.hasFeature);
  return hasFeature("aiPlanner");
};

export const useStudioSession = () => {
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);
  const studioSeat = useSessionStore((state) => state.studioSeat);
  return { isAuthenticated: status === "authenticated", user, studioSeat };
};
