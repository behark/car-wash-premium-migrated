# Security Issues Found in api-guard.ts

## 🔴 CRITICAL ISSUES

### 1. **CSRF Token Validation is Broken** (Line 286-289)
**Current Code:**
```typescript
function validateCsrfToken(token: string?, userId?: string): boolean {
  return token.length === 64;
}
```

**Problems:**
- ❌ Accepts ANY 64-character string as valid
- ❌ No actual validation against secret or session
- ❌ `userId` parameter removed but function signature still wrong
- ❌ `token?.length` will crash if token is undefined

**Security Risk:** CSRF protection is completely bypassed!

**Fix:**
```typescript
function validateCsrfToken(token: string | undefined, userId?: string): boolean {
  if (!token || token.length !== 64) return false;

  // TODO: Implement proper HMAC validation
  // Should validate against stored session token
  return /^[a-f0-9]{64}$/.test(token);
}
```

---

### 2. **Console.error in Production** (Line 25, 312)
**Current:**
```typescript
console.error('Failed to parse API_KEYS:', e);  // Line 25
console.error('Failed to send security log:', err); // Line 312
```

**Problems:**
- ❌ Console statements expose errors in production
- ❌ Should use logger instead

**Fix:**
```typescript
import { logger } from '../logger';
logger.error('Failed to parse API_KEYS', { error: e });
logger.error('Failed to send security log', { error: err });
```

---

### 3. **Memory Leak in setInterval** (Line 335-342)
**Current:**
```typescript
setInterval(() => {
  // cleanup code
}, 60 * 1000);
```

**Problems:**
- ❌ setInterval runs in serverless environment
- ❌ Creates new interval on every import
- ❌ Never cleared = memory leak
- ❌ Serverless functions don't keep state between invocations

**Security Risk:** Memory exhaustion in long-running processes

**Fix:**
Either remove entirely for serverless, or use Redis for distributed rate limiting.

---

## 🟡 MEDIUM ISSUES

### 4. **Weak CSRF Token Generation** (Line 274-281)
**Current:**
```typescript
const data = `${userId || 'anonymous'}-${Date.now()}-${Math.random()}`;
```

**Problems:**
- ⚠️ Uses Math.random() instead of crypto.randomBytes()
- ⚠️ Predictable timestamp component
- ⚠️ No session binding

**Better:**
```typescript
export function generateCsrfToken(userId?: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'default-secret';
  const random = crypto.randomBytes(32).toString('hex');
  const data = `${userId || 'anonymous'}-${Date.now()}-${random}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}
```

---

### 5. **In-Memory Rate Limiting** (Line 30)
**Current:**
```typescript
const requestTracking = new Map<string, { count: number; resetTime: number }>();
```

**Problems:**
- ⚠️ In serverless, each function instance has own memory
- ⚠️ Rate limits don't work across instances
- ⚠️ Attacker can bypass by hitting different instances

**Recommendation:**
Use Redis or Netlify Rate Limiting API for distributed rate limiting.

---

### 6. **Default Secret Fallback** (Line 275)
**Current:**
```typescript
const secret = process.env.NEXTAUTH_SECRET || 'default-secret';
```

**Problems:**
- ⚠️ Falls back to weak default in production
- ⚠️ Should throw error if NEXTAUTH_SECRET missing

**Fix:**
```typescript
const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  throw new Error('NEXTAUTH_SECRET environment variable is required');
}
```

---

## 🟢 CODE QUALITY ISSUES

### 7. **TypeScript 'any' Types** (Lines 21, 118, 126, 129, 136, 143, 172, 197, 319)
**Count:** 9 instances of `any`

**Examples:**
```typescript
Object.entries(keys).forEach(([key, value]: [string, any]) => {  // Line 21
let session: any = null;  // Line 118
if (options.requireAdmin && (session.user as any)?.role !== 'admin') { // Line 126
```

**Fix:** Define proper interfaces:
```typescript
interface SessionUser {
  id: string;
  email: string;
  role: string;
}

interface Session {
  user: SessionUser;
}
```

---

### 8. **Unused Function Parameters** (Line 286)
**Current:**
```typescript
function validateCsrfToken(token: string?, userId?: string): boolean {
  return token.length === 64;  // userId never used!
}
```

**Already partially fixed by sed, but:**
- Function signature is broken (token: string?)
- Should be: `token: string | undefined`

---

### 9. **Console.log in Production** (Line 303, 328)
**Current:**
```typescript
console.log('[SECURITY]', logEntry);  // Line 303
console.log('[API]', logEntry);       // Line 328
```

**Fix:** Use logger or remove (already handled by next.config.js removeConsole)

---

### 10. **Missing Error Handling for fetch** (Line 308-312)
**Current:**
```typescript
fetch(process.env.MONITORING_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(logEntry),
}).catch(err => console.error('Failed to send security log:', err));
```

**Issues:**
- Network errors only logged, not tracked
- No retry mechanism
- Should use logger

---

## 📊 SUMMARY

| Severity | Issue | Line | Impact |
|----------|-------|------|--------|
| 🔴 Critical | CSRF validation broken | 286-289 | Complete bypass |
| 🔴 Critical | Memory leak in setInterval | 335-342 | Resource exhaustion |
| 🔴 Critical | Weak CSRF token | 274-281 | Predictable tokens |
| 🟡 Medium | In-memory rate limiting | 30 | Bypass possible |
| 🟡 Medium | Default secret fallback | 275 | Weak security |
| 🟡 Medium | Console in production | 25, 303, 312, 328 | Info disclosure |
| 🟢 Low | TypeScript any types | Multiple | Type safety |
| 🟢 Low | Unused parameters | 286 | Code quality |

---

## ✅ RECOMMENDED FIXES (Priority Order)

### Immediate (Before Production):
1. Fix CSRF validation logic
2. Remove setInterval (incompatible with serverless)
3. Replace console.error with logger
4. Enforce NEXTAUTH_SECRET requirement

### Short-term:
5. Implement Redis-based rate limiting
6. Replace all `any` types with proper interfaces
7. Add proper error handling for fetch
8. Improve CSRF token generation

### Long-term:
9. Consider using Netlify Edge Functions for rate limiting
10. Add security monitoring dashboard
11. Implement request signature verification
12. Add IP allowlist/denylist support

---

## 🚨 SECURITY RECOMMENDATIONS

### For Serverless/Netlify:
- Use Netlify Rate Limiting API instead of in-memory
- Use Redis for distributed state (rate limits, CSRF tokens)
- Remove setInterval entirely
- Consider Netlify Edge Functions for security layer

### General:
- Never use 'default-secret' - throw error instead
- Use crypto.randomBytes() not Math.random()
- Implement proper CSRF token storage and validation
- Add request signing for critical operations

---

**Would you like me to fix these issues after deployment succeeds?**
