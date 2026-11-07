import {
  collection, collectionGroup, doc, getDocs, setDoc, updateDoc, query, where, orderBy, limit,
  onSnapshot, writeBatch, runTransaction, serverTimestamp, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "../config/firebase.js";
import { balanceDelta, pairDelta, validateExpense, formatINR } from "../utils/money.js";

const toList = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const groupRef = (gid) => doc(db, "groups", gid);
const memberInfo = (u) => ({ name: u.name, email: u.email, photoURL: u.photoURL || "" });

export const profileOf = (user) => ({
  uid: user.uid,
  email: user.email.toLowerCase(),
  name: user.displayName || user.email,
  photoURL: user.photoURL || "",
});

function activityDoc(gid, group, user, text) {
  return [doc(collection(groupRef(gid), "activity")), {
    groupId: gid,
    groupName: group.name,
    memberIds: group.memberIds,
    actorId: user.uid,
    actorName: user.displayName || user.email,
    text,
    createdAt: serverTimestamp(),
  }];
}

function applyDelta(balances, delta) {
  for (const [uid, v] of Object.entries(delta)) balances[uid] = (balances[uid] || 0) + v;
}

// ─── Users ───

export function ensureUserProfile(user) {
  const p = profileOf(user);
  return setDoc(doc(db, "users", user.uid), {
    uid: p.uid, email: p.email, displayName: p.name, photoURL: p.photoURL, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function findUserByEmail(email) {
  const snap = await getDocs(query(collection(db, "users"), where("email", "==", email.toLowerCase()), limit(1)));
  return snap.empty ? null : snap.docs[0].data();
}

export async function claimInvites(user) {
  const me = profileOf(user);
  const snap = await getDocs(query(collection(db, "groups"), where("pendingEmails", "array-contains", me.email)));
  await Promise.all(snap.docs.filter((d) => !d.data().deleted).map((d) => {
    const g = d.data();
    const batch = writeBatch(db);
    batch.update(d.ref, {
      memberIds: arrayUnion(me.uid),
      pendingEmails: arrayRemove(me.email),
      [`members.${me.uid}`]: memberInfo(me),
      updatedAt: serverTimestamp(),
    });
    batch.set(...activityDoc(d.id, { ...g, memberIds: [...g.memberIds, me.uid] }, user, "joined the group"));
    return batch.commit();
  }));
}

// ─── Groups ───

// cb(visible, all): `all` includes soft-deleted groups, used only to suggest contacts.
export function subscribeGroups(uid, cb, onError) {
  const q = query(collection(db, "groups"), where("memberIds", "array-contains", uid));
  return onSnapshot(q, (snap) => {
    const ms = (g) => g.updatedAt?.toMillis?.() ?? Date.now();
    const all = toList(snap).sort((a, b) => ms(b) - ms(a));
    cb(all.filter((g) => !g.deleted), all);
  }, onError);
}

export function subscribeGroup(gid, cb, onError) {
  return onSnapshot(groupRef(gid), (d) => cb(d.exists() && !d.data().deleted ? { id: d.id, ...d.data() } : null), onError);
}

export async function createGroup(user, { name, members, pendingEmails }) {
  name = name.trim();
  if (!name) throw new Error("Give the group a name");
  const all = [profileOf(user), ...members];
  const ref = doc(collection(db, "groups"));
  const group = {
    name,
    createdBy: user.uid,
    memberIds: all.map((m) => m.uid),
    members: Object.fromEntries(all.map((m) => [m.uid, memberInfo(m)])),
    pendingEmails,
    balances: {},
    pairs: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(ref, group);
  batch.set(...activityDoc(ref.id, group, user, "created the group"));
  await batch.commit();
  return ref.id;
}

export async function addMembers(gid, group, user, { members, pendingEmails }) {
  if (!members.length && !pendingEmails.length) throw new Error("Add at least one person");
  const update = { updatedAt: serverTimestamp() };
  if (members.length) update.memberIds = arrayUnion(...members.map((m) => m.uid));
  if (pendingEmails.length) update.pendingEmails = arrayUnion(...pendingEmails);
  for (const m of members) update[`members.${m.uid}`] = memberInfo(m);
  const names = [...members.map((m) => m.name), ...pendingEmails].join(", ");
  const batch = writeBatch(db);
  batch.update(groupRef(gid), update);
  batch.set(...activityDoc(gid, { ...group, memberIds: [...group.memberIds, ...members.map((m) => m.uid)] }, user, `added ${names}`));
  await batch.commit();
}

// Soft delete: hidden everywhere, but its members stay suggestable as contacts.
export function deleteGroup(gid) {
  return updateDoc(groupRef(gid), { deleted: true, updatedAt: serverTimestamp() });
}

export async function setSimplify(gid, group, user, simplify) {
  const batch = writeBatch(db);
  batch.update(groupRef(gid), { simplify, updatedAt: serverTimestamp() });
  batch.set(...activityDoc(gid, group, user, `turned ${simplify ? "on" : "off"} simplify debts`));
  await batch.commit();
}

// ─── Expenses (payments are expenses with type "payment") ───

export function subscribeExpenses(gid, cb, onError, max) {
  const parts = [orderBy("createdAt", "desc"), ...(max ? [limit(max)] : [])];
  const q = query(collection(groupRef(gid), "expenses"), ...parts);
  return onSnapshot(q, (snap) => cb(toList(snap)), onError);
}

export async function saveExpense(gid, user, data, expenseId) {
  validateExpense(data);
  if (data.type !== "payment" && !data.description?.trim()) throw new Error("Add a description");
  const eRef = expenseId ? doc(groupRef(gid), "expenses", expenseId) : doc(collection(groupRef(gid), "expenses"));
  await runTransaction(db, async (tx) => {
    const gSnap = await tx.get(groupRef(gid));
    const old = expenseId ? (await tx.get(eRef)).data() : null;
    const group = gSnap.data();
    const balances = { ...group.balances };
    if (old) applyDelta(balances, balanceDelta(old, -1));
    applyDelta(balances, balanceDelta(data));
    const update = { balances, updatedAt: serverTimestamp() };
    if (group.pairs) {
      update.pairs = { ...group.pairs };
      if (old) applyDelta(update.pairs, pairDelta(old, -1));
      applyDelta(update.pairs, pairDelta(data));
    }
    tx.update(groupRef(gid), update);
    tx.set(eRef, {
      ...data,
      createdBy: old?.createdBy ?? user.uid,
      createdAt: old?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const what = data.type === "payment" ? `a payment of ${formatINR(data.amount)}` : `“${data.description}” (${formatINR(data.amount)})`;
    tx.set(...activityDoc(gid, group, user, `${old ? "updated" : data.type === "payment" ? "recorded" : "added"} ${what}`));
  });
}

export async function deleteExpense(gid, user, expenseId) {
  const eRef = doc(groupRef(gid), "expenses", expenseId);
  await runTransaction(db, async (tx) => {
    const group = (await tx.get(groupRef(gid))).data();
    const old = (await tx.get(eRef)).data();
    if (!old) return;
    const balances = { ...group.balances };
    applyDelta(balances, balanceDelta(old, -1));
    const update = { balances, updatedAt: serverTimestamp() };
    if (group.pairs) applyDelta((update.pairs = { ...group.pairs }), pairDelta(old, -1));
    tx.update(groupRef(gid), update);
    tx.delete(eRef);
    tx.set(...activityDoc(gid, group, user, `deleted ${old.type === "payment" ? "a payment" : `“${old.description}”`} (${formatINR(old.amount)})`));
  });
}

// ─── Activity ───

export function subscribeActivity(uid, cb, onError) {
  const q = query(collectionGroup(db, "activity"), where("memberIds", "array-contains", uid), orderBy("createdAt", "desc"), limit(30));
  return onSnapshot(q, (snap) => cb(toList(snap)), onError);
}
