// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

/**
 * Studio Session Dialog
 * Read-only session/seat info + sign out. There is no manual "activate a
 * seat" action anymore — the seat is validated as part of login itself.
 */

import { X, ShieldCheck, LogOut } from "lucide-react";
import { Button } from "./ui/Button";
import { useSessionStore } from "../store/sessionStore";

interface SessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SessionDialog({ isOpen, onClose }: SessionDialogProps) {
  const { user, studioSeat, sessionExpiresAt, logout } = useSessionStore();

  if (!isOpen) return null;

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Session</h2>
              <p className="text-xs text-slate-500">Signed in to this Studio installation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {user && (
            <div>
              <p className="text-sm font-medium text-slate-800">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          )}

          {studioSeat && (
            <div className="p-4 bg-slate-50 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Studio seat</span>
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full capitalize">
                  {studioSeat.module}
                </span>
              </div>
              {studioSeat.expiresAt && (
                <p className="text-xs text-slate-500">
                  Renews {new Date(studioSeat.expiresAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              )}
              {studioSeat.features.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {studioSeat.features.map((feature) => (
                    <span
                      key={feature}
                      className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {sessionExpiresAt && (
            <p className="text-xs text-slate-400">
              Session active until{" "}
              {new Date(sessionExpiresAt).toLocaleString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200 bg-slate-50">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={handleLogout} className="text-red-600 border-red-200 hover:bg-red-50">
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SessionDialog;
