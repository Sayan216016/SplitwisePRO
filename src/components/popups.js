import { openModal, closeModal } from "./modal.js";
import { escapeHtml, isEmail, memberList, personName, plural } from "../utils/helpers.js";
import { computeSplit, toPaise, formatINR, sum } from "../utils/money.js";
import { avatar } from "./layout.js";
import { iconCircle } from "./ui.js";

const SPLIT_TYPES = { equal: "Equally", exact: "Exact ₹", percent: "Percent", shares: "Shares" };

// Every modal action: disable the button, show the error inline, close the modal on success.
async function runAction(btn, errorEl, fn) {
  btn.disabled = true;
  errorEl.textContent = "";
  try {
    await fn();
    closeModal();
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

function bindSubmit(root, fn) {
  const form = root.querySelector("form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runAction(form.querySelector('[type="submit"]'), root.querySelector("[data-error]"), () => fn(new FormData(form)));
  });
}

const errorLine = `<p class="form__error" data-error role="alert"></p>`;

const actions = (label, extra = "") =>
  `${errorLine}<div class="form__actions">${extra}<button class="btn btn--primary" type="submit">${label}</button></div>`;

const deleteBtn = `<button class="btn btn--danger" type="button" data-delete>Delete</button>`;

const confirmPanel = (title, message, confirmLabel) => `<div class="delete-confirm" data-confirm-panel>
    <h2 class="modal__title">${escapeHtml(title)}</h2>
    <p class="muted">${escapeHtml(message)}</p>
    ${errorLine}
    <div class="form__actions">
      <button class="btn btn--outline" type="button" data-cancel>Cancel</button>
      <button class="btn btn--danger" type="button" data-confirm>${escapeHtml(confirmLabel)}</button>
    </div>
  </div>`;

// Wires a rendered confirmPanel; `onCancel` defaults to closing the modal.
function bindConfirm(panel, onConfirm, onCancel = () => closeModal()) {
  panel.querySelector("[data-cancel]").addEventListener("click", onCancel);
  const btn = panel.querySelector("[data-confirm]");
  btn.addEventListener("click", () => runAction(btn, panel.querySelector("[data-error]"), onConfirm));
}

function bindDelete(root, onDelete, what) {
  root.querySelector("[data-delete]")?.addEventListener("click", () => {
    const form = root.querySelector("form");
    if (!form || root.querySelector("[data-confirm-panel]")) return;
    form.hidden = true;
    root.insertAdjacentHTML("beforeend", confirmPanel(`Delete this ${what}?`, "This can't be undone.", "Delete"));
    const panel = root.querySelector("[data-confirm-panel]");
    bindConfirm(panel, onDelete, () => {
      panel.remove();
      form.hidden = false;
    });
  });
}

export function openConfirmModal({ title, message, confirmLabel = "Delete", onConfirm }) {
  const root = openModal(confirmPanel(title, message, confirmLabel));
  root.querySelector("[data-cancel]").focus();
  bindConfirm(root, onConfirm);
}

const amountField = (paise) => `<label class="field"><span class="field__label">Amount (₹)</span>
  <input class="input" name="amount" type="number" min="0.01" step="0.01" required inputmode="decimal" value="${paise ? paise / 100 : ""}"></label>`;

const memberOptions = (members, user, group, selected) => members.map((m) =>
  `<option value="${m.uid}" ${m.uid === selected ? "selected" : ""}>${escapeHtml(personName(m.uid, user, group))}</option>`).join("");

// View-only for anyone but the author: disable every control and say who can edit.
function lockForm(root, authorName) {
  root.querySelector(".modal__title").textContent = root.querySelector(".modal__title").textContent.replace(/^Edit /, "View ");
  root.querySelectorAll("input, select, button:not([data-close])").forEach((el) => (el.disabled = true));
  root.querySelector(".form__actions").hidden = true;
  root.querySelector(".modal__title").insertAdjacentHTML("afterend",
    `<p class="field__hint">Added by <strong>${escapeHtml(authorName)}</strong> — only they can edit or delete it.</p>`);
}

// ─── Create group / add members ───

export function openGroupModal({ group, selfEmail, findUser, contacts = [], onSave }) {
  const picked = [];
  const root = openModal(`<form class="form" novalidate>
    <h2 class="modal__title">${group ? "Add members" : "Create a group"}</h2>
    ${group ? "" : `<label class="field"><span class="field__label">Group name</span>
      <input class="input" name="name" required maxlength="60" placeholder="Goa trip"></label>`}
    <div class="field">
      <label class="field__label" for="member-email">Add people by email</label>
      <div class="input-row">
        <input class="input" id="member-email" name="email" type="text" inputmode="email" placeholder="Name or email" autocomplete="off"
          role="combobox" aria-autocomplete="list" aria-controls="member-suggest" aria-expanded="false">
        <button class="btn btn--outline" type="button" data-find>Add</button>
      </div>
      <ul class="suggest" id="member-suggest" role="listbox" aria-label="People you know" hidden></ul>
      <p class="field__hint" data-find-msg aria-live="polite"></p>
    </div>
    <ul class="chip-list" data-picked></ul>
    ${actions(group ? "Add to group" : "Create group")}
  </form>`);
  const $ = (s) => root.querySelector(s);
  const emailInput = $('[name="email"]');
  const msg = $("[data-find-msg]");

  const taken = () => new Set([
    selfEmail,
    ...(group ? memberList(group).map((m) => m.email) : []),
    ...(group?.pendingEmails || []),
    ...picked.map((p) => p.email),
  ]);

  const draw = () => {
    $("[data-picked]").innerHTML = picked.map((p, i) => `<li class="chip">
      ${escapeHtml(p.name || p.email)}${p.uid ? "" : ` <em>· invite pending</em>`}
      <button type="button" data-remove="${i}" aria-label="Remove ${escapeHtml(p.email)}">✕</button></li>`).join("");
  };

  // Contacts are already in memory (from the groups listener), so filtering per keystroke costs no reads.
  const list = $("#member-suggest");
  let matches = [];
  let active = -1;
  const suggest = () => {
    const q = emailInput.value.trim().toLowerCase();
    const t = taken();
    matches = !q ? [] : contacts.filter((c) => !t.has(c.email)
      && ((c.name || "").toLowerCase().includes(q) || c.email.includes(q))).slice(0, 5);
    active = Math.min(active, matches.length - 1);
    list.innerHTML = matches.map((c, i) => `<li class="suggest__item" role="option" id="suggest-${i}" data-pick="${i}" aria-selected="${i === active}">
      ${avatar(c, "avatar--sm")}<span><strong>${escapeHtml(c.name || c.email)}</strong><small>${escapeHtml(c.email)}</small></span></li>`).join("");
    list.hidden = !matches.length;
    emailInput.setAttribute("aria-expanded", String(!!matches.length));
    if (active >= 0) emailInput.setAttribute("aria-activedescendant", `suggest-${active}`);
    else emailInput.removeAttribute("aria-activedescendant");
  };
  const pick = (i) => {
    emailInput.value = matches[i].email;
    active = -1;
    add();
  };

  async function add() {
    const email = emailInput.value.trim().toLowerCase();
    if (!isEmail(email)) return (msg.textContent = "Enter a valid email");
    if (taken().has(email)) return (msg.textContent = "Already in this group");
    const known = contacts.find((c) => c.email === email);
    msg.textContent = known ? "" : "Searching…";
    try {
      const u = known ? { uid: known.uid, displayName: known.name, photoURL: known.photoURL } : await findUser(email);
      picked.push(u ? { uid: u.uid, email, name: u.displayName, photoURL: u.photoURL } : { email });
      msg.textContent = u ? `Added ${u.displayName}` : "Not signed up yet — they'll join automatically when they sign in with this email.";
      emailInput.value = "";
      draw();
      suggest();
    } catch (err) {
      msg.textContent = err.message;
    }
  }

  $("[data-find]").addEventListener("click", add);
  emailInput.addEventListener("input", () => {
    active = -1;
    suggest();
  });
  emailInput.addEventListener("blur", () => (list.hidden = true));
  emailInput.addEventListener("focus", suggest);
  // mousedown keeps focus in the input, so blur doesn't hide the list before the click lands.
  list.addEventListener("mousedown", (e) => e.preventDefault());
  list.addEventListener("click", (e) => {
    const i = e.target.closest("[data-pick]")?.dataset.pick;
    if (i != null) pick(Number(i));
  });
  emailInput.addEventListener("keydown", (e) => {
    const open = !list.hidden;
    if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
      suggest();
    } else if (open && e.key === "Escape") {
      e.stopPropagation();
      list.hidden = true;
      emailInput.setAttribute("aria-expanded", "false");
    } else if (e.key === "Enter") {
      e.preventDefault();
      open && active >= 0 ? pick(active) : add();
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
    <span>${escapeHtml(personName(m.uid, user, current))}</span>
    <span class="member-input__field"><input class="input" type="number" min="0" step="any" name="${name}" data-uid="${m.uid}" value="${value ?? ""}" inputmode="decimal"><em>${suffix}</em></span>
  </label>`;

  const root = openModal(`<form class="form" novalidate>
    <h2 class="modal__title">${expense ? "Edit expense" : "Add expense"}</h2>
    <div class="field"><span class="field__label">Group</span>
      ${choices.length > 1
        ? `<div class="tabs" role="group" aria-label="Group">${choices.map((g) =>
          `<button type="button" class="tab" data-group-id="${escapeHtml(g.id)}" aria-pressed="${g === current}">${escapeHtml(g.name)}</button>`).join("")}</div>
          <p class="field__hint" data-group-hint ${current ? "hidden" : ""}>Pick a group to choose who paid and who's in.</p>`
        : `<div class="group-fixed">${iconCircle(current.name, "G")}<strong>${escapeHtml(current.name)}</strong></div>`}
    </div>
    <label class="field"><span class="field__label">Description</span>
      <input class="input" name="description" required maxlength="80" value="${escapeHtml(e.description || "")}" placeholder="Dinner"></label>
    ${amountField(e.amount)}
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
        ${memberOptions(members, user, current, multiPay ? null : payers[0] || user.uid)}
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
          <span>${escapeHtml(personName(m.uid, user, current))}</span></label>`;
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
      hint.textContent = splitType === "equal" ? `${formatINR(Math.floor(sum(split) / n))} per person` : `Split across ${plural(n, "person", "people")}`;
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
  const options = (sel) => memberOptions(members, user, group, sel);

  const root = openModal(`<form class="form" novalidate>
    <h2 class="modal__title">${payment ? "Edit payment" : "Record a payment"}</h2>
    <div class="form__pair">
      <label class="field"><span class="field__label">Who paid</span><select class="input" name="from">${options(from)}</select></label>
      <label class="field"><span class="field__label">Paid to</span><select class="input" name="to">${options(to)}</select></label>
    </div>
    ${amountField(amount)}
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
