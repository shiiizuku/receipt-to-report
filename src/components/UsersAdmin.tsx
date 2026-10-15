"use client";

import { useState, useTransition } from "react";
import { createUserAction, resetPasswordAction, setUserActiveAction } from "@/app/actions/admin";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export interface UserView {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "collector";
  officerName: string | null;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginLabel: string;
  isYou: boolean;
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function suggestPassword(): string {
  const limit = 256 - (256 % ALPHABET.length);
  const out: string[] = [];
  while (out.length < 12) {
    const [b] = crypto.getRandomValues(new Uint8Array(1));
    if (b < limit) out.push(ALPHABET[b % ALPHABET.length]);
  }
  return out.join("");
}

function Secret({ username, password, onDone }: { username: string; password: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card" role="status" style={{ display: "flex", flexDirection: "column", gap: 10, borderColor: "var(--seal)" }}>
      <div>
        <p className="eyebrow">Temporary password for {username}</p>
        <h3>Give this to them now</h3>
      </div>
      <div className="secret">
        <code className="mono">{password}</code>
        <button
          className="btn out"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="note">It is shown only once and is not stored anywhere you can read it. They will choose their own password when they first sign in. If it is lost, reset it again.</p>
      <div className="actions">
        <button className="btn" type="button" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

export function UsersAdmin({ users, officers }: { users: UserView[]; officers: Array<{ id: number; name: string }> }) {
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ username: string; password: string } | null>(null);
  const [resetting, setResetting] = useState<UserView | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  // add form
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [role, setRole] = useState<"collector" | "admin">("collector");
  const [officer, setOfficer] = useState<string>(officers[0] ? String(officers[0].id) : "new");
  const [newOfficerName, setNewOfficerName] = useState("");
  const [newOfficerTitle, setNewOfficerTitle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // reset form
  const [resetPw, setResetPw] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  const onName = (v: string) => {
    setName(v);
    if (!usernameTouched) {
      const parts = v.trim().toLowerCase().replace(/[^a-z\s.-]/g, "").split(/\s+/).filter(Boolean);
      setUsername(parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : (parts[0] ?? ""));
    }
  };

  function resetAddForm() {
    setName("");
    setUsername("");
    setUsernameTouched(false);
    setRole("collector");
    setOfficer(officers[0] ? String(officers[0].id) : "new");
    setNewOfficerName("");
    setNewOfficerTitle("");
    setPassword("");
    setError(null);
  }

  function create() {
    setError(null);
    start(async () => {
      const res = await createUserAction({
        username,
        displayName: name,
        role,
        officerId: role === "collector" && officer !== "new" ? Number(officer) : null,
        newOfficer: role === "collector" && officer === "new" ? { name: newOfficerName, title: newOfficerTitle } : null,
        password: password || null,
      });
      if (!res.ok) return setError(res.error);
      setAdding(false);
      resetAddForm();
      setMessage({ kind: "ok", text: `Added ${res.username}. They must choose a new password at first sign-in.` });
      if (res.generatedPassword) setSecret({ username: res.username, password: res.generatedPassword });
    });
  }

  function doReset() {
    if (!resetting) return;
    setResetError(null);
    start(async () => {
      const res = await resetPasswordAction(resetting.id, resetPw || null);
      if (!res.ok) return setResetError(res.error);
      setResetting(null);
      setResetPw("");
      setMessage({ kind: "ok", text: `Password reset for ${res.username}. They are signed out and must choose a new one.` });
      if (res.generatedPassword) setSecret({ username: res.username, password: res.generatedPassword });
    });
  }

  function toggle(u: UserView) {
    setMessage(null);
    start(async () => {
      const res = await setUserActiveAction(u.id, !u.active);
      setMessage(res.ok ? { kind: "ok", text: `${u.displayName} is now ${u.active ? "disabled" : "enabled"}.` } : { kind: "bad", text: res.error });
    });
  }

  return (
    <div className="scr">
      <div className="head">
        <div>
          <p className="eyebrow">Administration</p>
          <div className="t">Users</div>
          <p className="sub">Everyone who can sign in. A collecting officer can only issue receipts, books and deposits for their own officer name.</p>
        </div>
        {!adding ? (
          <button className="btn" type="button" onClick={() => { setAdding(true); setSecret(null); setMessage(null); }} aria-expanded="false">
            Add user
          </button>
        ) : null}
      </div>

      <div role="status" aria-live="polite">
        {message ? <p className={`fld-msg ${message.kind}`}>{message.text}</p> : null}
      </div>

      {secret ? <Secret username={secret.username} password={secret.password} onDone={() => setSecret(null)} /> : null}

      {adding ? (
        <div className="drawer">
          <div>
            <p className="eyebrow">New account</p>
            <h3>Add a user</h3>
          </div>
          <div className="form" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            <div>
              <label htmlFor="u-name">Full name</label>
              <input id="u-name" value={name} onChange={(e) => onName(e.target.value)} autoFocus />
            </div>
            <div>
              <label htmlFor="u-user">Username</label>
              <input id="u-user" value={username} onChange={(e) => { setUsername(e.target.value.toLowerCase()); setUsernameTouched(true); }} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="u-role">Role</label>
              <div className="sel">
                <select id="u-role" value={role} onChange={(e) => setRole(e.target.value as "collector" | "admin")}>
                  <option value="collector">Collecting officer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>
            {role === "collector" ? (
              <div>
                <label htmlFor="u-off">Collecting officer</label>
                <div className="sel">
                  <select id="u-off" value={officer} onChange={(e) => setOfficer(e.target.value)}>
                    {officers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                    <option value="new">Add a new collecting officer…</option>
                  </select>
                </div>
              </div>
            ) : null}
            {role === "collector" && officer === "new" ? (
              <>
                <div>
                  <label htmlFor="u-onew">Officer name as printed</label>
                  <input id="u-onew" value={newOfficerName} onChange={(e) => setNewOfficerName(e.target.value)} placeholder="e.g. PEDRO A. SANTOS" />
                </div>
                <div>
                  <label htmlFor="u-otitle">Officer title</label>
                  <input id="u-otitle" value={newOfficerTitle} onChange={(e) => setNewOfficerTitle(e.target.value)} placeholder="e.g. Cashier I" />
                </div>
              </>
            ) : null}
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="u-pw">Temporary password</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input id="u-pw" className="mono" style={{ flex: "1 1 240px" }} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank and one is generated for you" autoComplete="off" aria-describedby="u-pw-help" />
                <button className="btn out" type="button" onClick={() => setPassword(suggestPassword())}>
                  Suggest one
                </button>
              </div>
              <span id="u-pw-help" className="help">
                At least {MIN_PASSWORD_LENGTH} characters. They choose their own at first sign-in.
              </span>
            </div>
          </div>
          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}
          <div className="actions">
            <button className="btn out" type="button" onClick={() => { setAdding(false); resetAddForm(); }}>
              Cancel
            </button>
            <button className="btn" type="button" disabled={pending || !name.trim() || !username.trim()} onClick={create}>
              {pending ? "Adding…" : "Add user"}
            </button>
          </div>
        </div>
      ) : null}

      {resetting ? (
        <div className="drawer" style={{ borderColor: "var(--seal)" }}>
          <div>
            <p className="eyebrow">{resetting.username}</p>
            <h3>Reset password for {resetting.displayName}</h3>
          </div>
          <p className="note">They will be signed out everywhere and must choose a new password the next time they sign in.</p>
          <div>
            <label htmlFor="r-pw">Temporary password</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input id="r-pw" className="mono" style={{ flex: "1 1 240px" }} value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="Leave blank and one is generated for you" autoComplete="off" autoFocus />
              <button className="btn out" type="button" onClick={() => setResetPw(suggestPassword())}>
                Suggest one
              </button>
            </div>
          </div>
          {resetError ? (
            <p className="alert" role="alert">
              {resetError}
            </p>
          ) : null}
          <div className="actions">
            <button className="btn out" type="button" onClick={() => { setResetting(null); setResetPw(""); setResetError(null); }}>
              Cancel
            </button>
            <button className="btn" type="button" disabled={pending} onClick={doReset}>
              {pending ? "Resetting…" : "Reset password"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="tbl scroll">
        <table style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Collecting officer</th>
              <th>Last sign-in</th>
              <th>Status</th>
              <th>
                <span style={{ position: "absolute", left: -9999 }}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? undefined : "voided"}>
                <td>
                  <b>{u.displayName}</b>
                  {u.isYou ? <span className="note"> (you)</span> : null}
                </td>
                <td className="num">{u.username}</td>
                <td>{u.role === "admin" ? "Administrator" : "Collecting officer"}</td>
                <td>{u.officerName ?? "—"}</td>
                <td>{u.lastLoginLabel}</td>
                <td>
                  {!u.active ? <span className="pill closed">Disabled</span> : u.mustChangePassword ? <span className="pill wait">Must set password</span> : <span className="pill done">Active</span>}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="link sm" type="button" onClick={() => { setResetting(u); setResetPw(""); setResetError(null); setSecret(null); setMessage(null); }}>
                    Reset password
                  </button>
                  {!u.isYou ? (
                    <>
                      {" · "}
                      <button className="link sm" type="button" disabled={pending} onClick={() => toggle(u)}>
                        {u.active ? "Disable" : "Enable"}
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
