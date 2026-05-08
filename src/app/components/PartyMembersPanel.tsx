"use client";

import { useState, useEffect } from "react";
import {
  PartyMember,
  DEFAULT_PARTY_MEMBER,
  PARTY_MEMBERS_STORAGE_KEY,
} from "../types";

// ─── Helper ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return `member-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadMembers(): PartyMember[] {
  try {
    const raw = localStorage.getItem(PARTY_MEMBERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PartyMember[];
  } catch {
    // ignore
  }
  return [];
}

// ─── NumberInput ──────────────────────────────────────────────────────────────

function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}
      </label>
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={(e) => {
          const v = parseInt(e.target.value, 10) || 0;
          onChange(max !== undefined ? Math.min(max, Math.max(min, v)) : Math.max(min, v));
        }}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
    </div>
  );
}

// ─── MemberAccordion ──────────────────────────────────────────────────────────

function MemberAccordion({
  member,
  onChange,
  onRemove,
}: {
  member: PartyMember;
  onChange: (updated: PartyMember) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);

  const displayName = member.name.trim() || "Unnamed member";

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
          <span className="text-base">👤</span>
          {displayName}
          {(member.brokerLevel > 0 || member.stewardLevel > 0) && (
            <span className="flex gap-1.5">
              {member.brokerLevel > 0 && (
                <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  Broker-{member.brokerLevel}
                </span>
              )}
              {member.stewardLevel > 0 && (
                <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  Steward-{member.stewardLevel}
                </span>
              )}
            </span>
          )}
        </span>
        <span className="text-gray-400 dark:text-gray-500 text-xs ml-2 flex-shrink-0">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Accordion body */}
      {open && (
        <div className="p-4 bg-white dark:bg-gray-900 space-y-4 border-t border-gray-200 dark:border-gray-700">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Name
            </label>
            <input
              type="text"
              value={member.name}
              onChange={(e) => onChange({ ...member, name: e.target.value })}
              placeholder="Character name"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Skills */}
          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label="Broker Level"
              value={member.brokerLevel}
              onChange={(v) => onChange({ ...member, brokerLevel: v })}
              min={0}
              max={6}
            />
            <NumberInput
              label="Steward Level"
              value={member.stewardLevel}
              onChange={(v) => onChange({ ...member, stewardLevel: v })}
              min={0}
              max={6}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Notes
            </label>
            <textarea
              value={member.notes}
              onChange={(e) => onChange({ ...member, notes: e.target.value })}
              placeholder="UPP, skills, background…"
              rows={2}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
            />
          </div>

          {/* Remove */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onRemove}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-950 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Remove member
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PartyMembersPanel ────────────────────────────────────────────────────────

export default function PartyMembersPanel() {
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setMembers(loadMembers());
    setInitialized(true);
  }, []);

  // Persist whenever members change (skip before first load)
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(PARTY_MEMBERS_STORAGE_KEY, JSON.stringify(members));
  }, [members, initialized]);

  function addMember() {
    setMembers((prev) => [
      ...prev,
      { ...DEFAULT_PARTY_MEMBER, id: generateId() },
    ]);
  }

  function updateMember(updated: PartyMember) {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  function removeMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="bg-slate-700 px-6 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          👥 Party Members
        </h2>
        <span className="text-xs text-slate-300">
          {members.length} member{members.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-6 space-y-3">
        {members.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            No party members added yet. Add members to track their skills across sessions.
          </p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <MemberAccordion
                key={member.id}
                member={member}
                onChange={updateMember}
                onRemove={() => removeMember(member.id)}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addMember}
          className="mt-2 w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-amber-400 dark:hover:border-amber-600 hover:text-amber-600 dark:hover:text-amber-400 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          + Add party member
        </button>
      </div>
    </section>
  );
}
