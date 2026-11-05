import { openModal, closeModal } from "./modal.js";
import { escapeHtml, isEmail, memberList } from "../utils/helpers.js";
import { computeSplit, toPaise, formatINR, sum } from "../utils/money.js";

const SPLIT_TYPES = { equal: "Equally", exact: "Exact ₹", percent: "Percent", shares: "Shares" };

function bindSubmit(root, fn) {
  const form = root.querySelector("form");
  const error = root.querySelector("[data-error]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    error.textContent = "";
    try {
      await fn(new FormData(form));
      closeModal();
    } catch (err) {
      error.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

const actions = (label, extra = "") =>
  `<p class="form__error" data-error role="alert"></p>
   <div class="form__actions">${extra}<button class="btn btn--primary" type="submit">${label}</button></div>`;

const deleteBtn = `<button class="btn btn--danger" type="button" data-delete>Delete</button>`;

function bindDelete(root, onDelete, what) {
  root.querySelector("[data-delete]")?.addEventListener("click", () => {
    const form = root.querySelector("form");
    if (!form || root.querySelector("[data-delete-confirm]")) return;
    form.hidden = true;
    root.insertAdjacentHTML("beforeend", `<div class="delete-confirm" data-delete-confirm>
      <h2 class="modal__title">Delete this ${what}?</h2>
      <p class="muted">This can't be undone.</p>
      <p class="form__error" data-error role="alert"></p>
      <div class="form__actions">
        <button class="btn btn--outline" type="button" data-cancel>Cancel</button>
        <button class="btn btn--danger" type="button" data-confirm>Delete</button>
      </div>
    </div>`);
    const panel = root.querySelector("[data-delete-confirm]");
    panel.querySelector("[data-cancel]").addEventListener("click", () => {
      panel.remove();
      form.hidden = false;
    });
    panel.querySelector("[data-confirm]").addEventListener("click", async () => {
      const err = panel.querySelector("[data-error]");
      const btn = panel.querySelector("[data-confirm]");
      btn.disabled = true;
      err.textContent = "";
      try {
        await onDelete();
        closeModal();
      } catch (e) {
        err.textContent = e.message;
        btn.disabled = false;
      }
    });
  });
}

// View-only for anyone but the author: disable every control and say who can edit.
function lockForm(root, authorName) {
  root.querySelector(".modal__title").textContent = root.querySelector(".modal__title").textContent.replace(/^Edit /, "View ");
  root.querySelectorAll("input, select, button:not([data-close])").forEach((el) => (el.disabled = true));
  root.querySelector(".form__actions").hidden = true;
  root.querySelector(".modal__title").insertAdjacentHTML("afterend",
    `<p class="field__hint">Added by <strong>${escapeHtml(authorName)}</strong> — only they can edit or delete it.</p>`);
}

// ─── Create group / add members ───

export function openGroupModal({ group, selfEmail, findUser, onSave }) {
  const picked = [];
  const root = openModal(`<form class="form" novalidate>
    <h2 class="modal__title">${group ? "Add members" : "Create a group"}</h2>
    ${group ? "" : `<label class="field"><span class="field__label">Group name</span>
      <input class="input" name="name" required maxlength="60" placeholder="Goa trip"></label>`}
    <div class="field">
      <label class="field__label" for="member-email">Add people by email</label>
      <div class="input-row">
        <input class="input" id="member-email" name="email" type="email" placeholder="friend@gmail.com" autocomplete="off">
        <button class="btn btn--outline" type="button" data-find>Add</button>
      </div>
      <p class="field__hint" data-find-msg aria-live="polite"></p>
    </div>
    <ul class="chip-list" data-picked></ul>
    ${actions(group ? "Add to group" : "Create group")}
  </form>`);
  const $ = (s) => root.querySelector(s);
  const emailInput = $('[name="email"]');
  const msg = $("[data-find-msg]");

  const draw = () => {
    $("[data-picked]").innerHTML = picked.map((p, i) => `<li class="chip">
      ${escapeHtml(p.name || p.email)}${p.uid ? "" : ` <em>· invite pending</em>`}
      <button type="button" data-remove="${i}" aria-label="Remove ${escapeHtml(p.email)}">✕</button></li>`).join("");
  };

  async function add() {
    const email = emailInput.value.trim().toLowerCase();
    if (!isEmail(email)) return (msg.textContent = "Enter a valid email");
    const taken = new Set([
      selfEmail,
      ...(group ? memberList(group).map((m) => m.email) : []),
      ...(group?.pendingEmails || []),
      ...picked.map((p) => p.email),
    ]);
    if (taken.has(email)) return (msg.textContent = "Already in this group");
    msg.textContent = "Searching…";
    try {
      const u = await findUser(email);
      picked.push(u ? { uid: u.uid, email, name: u.displayName, photoURL: u.photoURL } : { email });
      msg.textContent = u ? `Added ${u.displayName}` : "Not signed up yet — they'll join automatically when they sign in with this email.";
      emailInput.value = "";
      draw();
    } catch (err) {
      msg.textContent = err.message;
    }
  }

  $("[data-find]").addEventListener("click", add);
  emailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  });
  $("[data-picked]").addEventListener("click", (e) => {
    const i = e.target.closest("[data-remove]")?.dataset.remove;
    if (i != null) {
      picked.splice(Number(i), 1);
      draw();
    }
  });
  bindSubmit(root, (fd) => onSave({
    name: fd.get("name") || "",
    members: picked.filter((p) => p.uid),
    pendingEmails: picked.filter((p) => !p.uid).map((p) => p.email),
  }));
}

// ─── Add / edit expense ───

// Pass `groups` to let the user choose (dashboard / friend page); pass only `group` to lock it.
export function openExpenseModal({ group, groups, user, expense, onSave, onDelete, readOnlyBy }) {
  const choices = groups || [group];
  let current = group || (choices.length === 1 ? choices[0] : null);
  let members = current ? memberList(current) : [];
  const e = expense || {};
  const payers = Object.keys(e.paidBy || {});
  const multiPay = payers.length > 1;
  let splitType = e.splitType || "equal";

  const memberRow = (m, name, value, suffix) => `<label class="member-input">
    <span>${escapeHtml(m.uid === user.uid ? "You" : m.name)}</span>
    <span class="member-input__field"><input class="input" type="number" min="0" step="any" name="${name}" data-uid="${m.uid}" value="${value ?? ""}" inputmode="decimal"><em>${suffix}</em></span>
  </label>`;

  const root = openModal(`<form class="form" novalidate>
    <h2 class="modal__title">${expense ? "Edit expense" : "Add expense"}</h2>
    <div class="field"><span class="field__label">Group</span>
      ${choices.length > 1
        ? `<div class="tabs" role="group" aria-label="Group">${choices.map((g) =>
          `<button type="button" class="tab" data-group-id="${escapeHtml(g.id)}" aria-pressed="${g === current}">${escapeHtml(g.name)}</button>`).join("")}</div>
          <p class="field__hint" data-group-hint ${current ? "hidden" : ""}>Pick a group to choose who paid and who's in.</p>`
        : `<div class="group-fixed"><span class="icon-circle" aria-hidden="true">${escapeHtml(current.name[0]?.toUpperCase() || "G")}</span><strong>${escapeHtml(current.name)}</strong></div>`}
    </div>
    <label class="field"><span class="field__label">Description</span>
      <input class="input" name="description" required maxlength="80" value="${escapeHtml(e.description || "")}" placeholder="Dinner"></label>
    <label class="field"><span class="field__label">Amount (₹)</span>
      <input class="input" name="amount" type="number" min="0.01" step="0.01" required inputmode="decimal" value="${e.amount ? e.amount / 100 : ""}"></label>
    <div class="field" data-payer-field data-needs-group></div>
    <div class="field" data-needs-group>
      <span class="field__label">Split</span>
      <div class="tabs" role="group" aria-label="Split type">
        ${Object.entries(SPLIT_TYPES).map(([t, label]) => `<button type="button" class="tab" data-split-type="${t}">${label}</button>`).join("")}
      </div>
      <div class="member-inputs" data-split></div>
      <p class="field__hint" data-split-hint aria-live="polite"></p>
    </div>
    ${actions("Save", expense ? deleteBtn : "")}
  </form>`);
  const $ = (s) => root.querySelector(s);

  function drawPayers() {
    $("[data-payer-field]").innerHTML = `<label class="field__label" for="payer">Paid by</label>
      <select class="input" id="payer" name="payer">
        ${members.map((m) => `<option value="${m.uid}" ${(!multiPay && (payers[0] || user.uid) === m.uid) ? "selected" : ""}>${escapeHtml(m.uid === user.uid ? "You" : m.name)}</option>`).join("")}
        <option value="__multi" ${multiPay ? "selected" : ""}>Multiple people</option>
      </select>
      <div class="member-inputs" data-payers ${multiPay ? "" : "hidden"}>
        ${members.map((m) => memberRow(m, "pay", multiPay && e.paidBy[m.uid] ? e.paidBy[m.uid] / 100 : "", "₹")).join("")}
      </div>`;
    root.querySelectorAll("[data-needs-group]").forEach((el) => (el.hidden = !current));
  }

  function drawSplit(useSaved) {
    const saved = useSaved && e.splitInput ? e.splitInput : null;
    root.querySelectorAll("[data-split-type]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.splitType === splitType)));
    $("[data-split]").innerHTML = members.map((m) => {
      if (splitType === "equal") {
        const on = saved ? saved[m.uid] > 0 : true;
        return `<label class="member-input member-input--check"><input type="checkbox" name="split" data-uid="${m.uid}" ${on ? "checked" : ""}>
          <span>${escapeHtml(m.uid === user.uid ? "You" : m.name)}</span></label>`;
      }
      const def = splitType === "shares" ? 1 : "";
      return memberRow(m, "split", saved ? saved[m.uid] || "" : def, { exact: "₹", percent: "%", shares: "share(s)" }[splitType]);
    }).join("");
    updateHint();
  }

  const readInputs = (name) => Object.fromEntries([...root.querySelectorAll(`[name="${name}"]`)].map((el) =>
    [el.dataset.uid, el.type === "checkbox" ? (el.checked ? 1 : 0) : Number(el.value) || 0]));

  function build() {
    if (!current) throw new Error("Choose a group first");
    const amount = toPaise($('[name="amount"]').value);
    if (!(amount > 0)) throw new Error("Enter an amount above ₹0");
    const payer = $('[name="payer"]').value;
    const paidBy = payer === "__multi"
      ? Object.fromEntries(Object.entries(readInputs("pay")).map(([uid, v]) => [uid, toPaise(v)]).filter(([, p]) => p > 0))
      : { [payer]: amount };
    if (sum(paidBy) !== amount) throw new Error(`Payers must add up to ${formatINR(amount)}`);
    const splitInput = readInputs("split");
    return { amount, paidBy, splitType, splitInput, split: computeSplit(amount, splitType, splitInput) };
  }

  function updateHint() {
    const hint = $("[data-split-hint]");
    try {
      const { split } = build();
      const n = Object.keys(split).length;
      hint.textContent = splitType === "equal" ? `${formatINR(Math.floor(sum(split) / n))} per person` : `Split across ${n} ${n === 1 ? "person" : "people"}`;
      hint.classList.remove("is-error");
    } catch (err) {
      hint.textContent = $('[name="amount"]').value ? err.message : "";
      hint.classList.add("is-error");
    }
  }

  root.addEventListener("input", updateHint);
  root.addEventListener("change", (ev) => {
    if (ev.target.name !== "payer") return;
    $("[data-payers]").hidden = ev.target.value !== "__multi";
    updateHint();
  });
  root.addEventListener("click", (ev) => {
    const gid = ev.target.closest("[data-group-id]")?.dataset.groupId;
    if (gid) {
      current = choices.find((g) => g.id === gid);
      members = memberList(current);
      root.querySelectorAll("[data-group-id]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.groupId === gid)));
      $("[data-group-hint]").hidden = true;
      drawPayers();
      drawSplit(false);
      return;
    }
    const t = ev.target.closest("[data-split-type]")?.dataset.splitType;
    if (!t) return;
    splitType = t;
    drawSplit(t === e.splitType);
  });
  drawPayers();
  drawSplit(true);
  if (readOnlyBy) return lockForm(root, readOnlyBy);
  bindSubmit(root, (fd) => onSave({ type: "expense", description: String(fd.get("description")).trim(), ...build() }, current));
  bindDelete(root, onDelete, "expense");
}

// ─── Record payment (settle up) ───

export function openSettleModal({ group, user, payment, suggestion, onSave, onDelete, readOnlyBy }) {
  const members = memberList(group);
  const from = payment ? Object.keys(payment.paidBy)[0] : suggestion?.from ?? user.uid;
  const to = payment ? Object.keys(payment.split)[0] : suggestion?.to ?? members.find((m) => m.uid !== user.uid)?.uid;
  const amount = payment?.amount ?? suggestion?.amount;
  const options = (sel) => members.map((m) => `<option value="${m.uid}" ${m.uid === sel ? "selected" : ""}>${escapeHtml(m.uid === user.uid ? "You" : m.name)}</option>`).join("");

  const root = openModal(`<form class="form" novalidate>
    <h2 class="modal__title">${payment ? "Edit payment" : "Record a payment"}</h2>
    <div class="form__pair">
      <label class="field"><span class="field__label">Who paid</span><select class="input" name="from">${options(from)}</select></label>
      <label class="field"><span class="field__label">Paid to</span><select class="input" name="to">${options(to)}</select></label>
    </div>
    <label class="field"><span class="field__label">Amount (₹)</span>
      <input class="input" name="amount" type="number" min="0.01" step="0.01" required inputmode="decimal" value="${amount ? amount / 100 : ""}"></label>
    ${actions("Save payment", payment ? deleteBtn : "")}
  </form>`);
  if (readOnlyBy) return lockForm(root, readOnlyBy);

  bindSubmit(root, (fd) => {
    const amt = toPaise(fd.get("amount"));
    const [f, t] = [fd.get("from"), fd.get("to")];
    if (f === t) throw new Error("Pick two different people");
    return onSave({ type: "payment", description: "Payment", amount: amt, paidBy: { [f]: amt }, split: { [t]: amt }, splitType: "exact", splitInput: {} });
  });
  bindDelete(root, onDelete, "payment");
}
