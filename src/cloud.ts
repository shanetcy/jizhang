// 共同账本（生活费、存钱罐）：Firebase 登录 + Firestore 同步
import { initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from 'firebase/auth'
import {
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { firebaseConfig } from './firebase-config'
import { currentMonth } from './dates'

// 开发测试用：VITE_FIREBASE_EMULATOR=1 npm run dev 时连接本机的 Firebase 模拟器，不碰真实数据
const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1'
const config = useEmulator ? { apiKey: 'demo', authDomain: 'localhost', projectId: 'demo-jizhang' } : firebaseConfig

export const cloudEnabled = Boolean(config.apiKey)

let auth: Auth
let fs: Firestore
if (cloudEnabled) {
  const app = initializeApp(config)
  auth = getAuth(app)
  // 本地缓存：没网时照样能读能记，联网后自动同步
  fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  if (useEmulator) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
    connectFirestoreEmulator(fs, 'localhost', 8080)
  }
}
export { auth, fs }

// ---------- 数据类型 ----------

export interface Profile {
  emoji: string
  name: string
}

export interface Household {
  id: string
  members: string[] // 用户 uid，最多两个人
  profiles: Record<string, Profile>
  inviteCode: string
  startMonth: string // 创建账本的月份，存钱罐从这个月开始算
  createdAt: number
}

// 一笔生活费支出（金额单位：欧分）
export interface SharedExpense {
  id: string
  amount: number
  payer: string // 付钱的人的 uid
  date: string
  note: string
  catIcon: string
  catName: string
  createdBy: string
  createdAt: number
}

// 从存钱罐取出的一笔钱
export interface Withdrawal {
  id: string
  amount: number
  note: string
  date: string
  by: string
  createdAt: number
}

export const PROFILE_EMOJIS = ['🐰', '🐻', '🐱', '🐶', '🦊', '🐼', '🐨', '🐹', '🐥', '🐸', '🦄', '🐯', '🐧', '🐳', '🍓', '🍑', '🌷', '🌻', '⭐', '🌙']

// ---------- 写入 ----------
// 写入不等待服务器确认（离线时 Promise 要联网后才完成），界面立刻更新，出错时提示。

const report = (e: unknown) => {
  console.error(e)
  alert('同步失败：' + ((e as Error).message ?? e))
}

const newId = (col: string, hid: string) => doc(collection(fs, 'households', hid, col)).id

export function saveExpense(hid: string, e: Omit<SharedExpense, 'id'>, id = newId('expenses', hid)) {
  setDoc(doc(fs, 'households', hid, 'expenses', id), e).catch(report)
}

export function deleteExpense(hid: string, id: string) {
  deleteDoc(doc(fs, 'households', hid, 'expenses', id)).catch(report)
}

// 某个月的预算（欧分）；之后的月份没单独设置时沿用它
export function setBudget(hid: string, ym: string, amount: number) {
  setDoc(doc(fs, 'households', hid, 'budgets', ym), { amount }).catch(report)
}

export function addWithdrawal(hid: string, w: Omit<Withdrawal, 'id'>) {
  setDoc(doc(fs, 'households', hid, 'withdrawals', newId('withdrawals', hid)), w).catch(report)
}

export function deleteWithdrawal(hid: string, id: string) {
  deleteDoc(doc(fs, 'households', hid, 'withdrawals', id)).catch(report)
}

export function updateProfile(hid: string, uid: string, p: Profile) {
  updateDoc(doc(fs, 'households', hid), { [`profiles.${uid}`]: p }).catch(report)
}

// ---------- 账号与账本（这些需要联网，等待结果） ----------

const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉了容易看错的 0/O、1/I

function makeInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return [...bytes].map((b) => INVITE_CHARS[b % INVITE_CHARS.length]).join('')
}

export async function createHousehold(uid: string, profile: Profile) {
  const ref = doc(collection(fs, 'households'))
  const inviteCode = makeInviteCode()
  const batch = writeBatch(fs)
  batch.set(ref, {
    members: [uid],
    profiles: { [uid]: profile },
    inviteCode,
    startMonth: currentMonth(),
    createdAt: Date.now(),
  })
  batch.set(doc(fs, 'invites', inviteCode), { hid: ref.id })
  await batch.commit()
}

export async function joinHousehold(uid: string, code: string, profile: Profile) {
  const invite = await getDoc(doc(fs, 'invites', code.trim().toUpperCase()))
  if (!invite.exists()) throw new Error('找不到这个邀请码，请检查一下有没有输错')
  try {
    await updateDoc(doc(fs, 'households', invite.data().hid), {
      members: arrayUnion(uid),
      [`profiles.${uid}`]: profile,
    })
  } catch {
    throw new Error('加入失败：这个账本可能已经有两个人了')
  }
}

const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-email': '邮箱格式不对',
  'auth/missing-password': '请输入密码',
  'auth/weak-password': '密码至少要 6 位',
  'auth/email-already-in-use': '这个邮箱已经注册过了，请直接登录',
  'auth/invalid-credential': '邮箱或密码不对',
  'auth/user-not-found': '邮箱或密码不对',
  'auth/wrong-password': '邮箱或密码不对',
  'auth/too-many-requests': '尝试次数太多，请稍后再试',
  'auth/network-request-failed': '网络连接失败，登录需要联网',
}

async function withAuthErrors<T>(fn: () => Promise<T>) {
  try {
    return await fn()
  } catch (e) {
    throw new Error(AUTH_ERRORS[(e as { code?: string }).code ?? ''] ?? '出错了：' + (e as Error).message)
  }
}

export const signUp = (email: string, pw: string) => withAuthErrors(() => createUserWithEmailAndPassword(auth, email, pw))
export const signIn = (email: string, pw: string) => withAuthErrors(() => signInWithEmailAndPassword(auth, email, pw))
export const resetPassword = (email: string) => withAuthErrors(() => sendPasswordResetEmail(auth, email))
export const logOut = () => signOut(auth)
