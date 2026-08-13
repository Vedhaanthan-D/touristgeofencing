You are working on D:\Hoster FInal yr project\touristgeofencing. The web portal (/frontend) is for officials only (Police Officer, Forest Officer, Immigration Officer, Admin) — tourists never use the website. Tourists only use a separate mobile app, authenticating with email + DTID. Implement role-based access control end-to-end, fix the Firestore rules to match the real data model, and wire up SOS/idle alerts to the portal correctly. Do not touch the Dashboard's Google Maps iframe/geofence map section — leave it exactly as is.

1. Officials have no roles today — everyone with any valid login sees everything

Problem: authenticateToken middleware only checks that a Firebase ID token is valid, not who the person is. Any authenticated account can hit every route and see every page. There's no concept of Police / Forest / Immigration / Admin anywhere in the code.

Solution: Introduce Firebase Auth custom claims (role: 'admin' | 'police' | 'forest' | 'immigration') as the single source of truth for permissions, checked both server-side (Express middleware) and in Firestore rules.

Approach:

Add a backend/scripts/setUserRole.js one-off CLI script (run manually via node scripts/setUserRole.js <email> <role>) that calls admin.auth().getUserByEmail(email) then admin.auth().setCustomUserClaims(uid, { role }). This is how you'll create your first Police/Forest/Immigration/Admin officer accounts — document this clearly in the README since there's no self-serve signup.
Add a protected POST /api/admin/set-role route, restricted to role === 'admin' only, so an Admin can promote/create other officer roles from within the app later instead of always needing console/CLI access.
Custom claims only refresh on the client after a token refresh — after setting a role, the affected user must sign out/in (or call getIdToken(true)) before the new role is visible.
2. Backend routes aren't role-restricted

Problem: /api/register, /api/tourists, /api/panic-alerts, /api/safety-alerts all just check "is this a valid token," not "does this role allow this action." As specified, Immigration Officers should be able to register tourists but must NOT see the dashboard/tourist list/alerts; Police and Forest Officers should monitor but not necessarily register.

Solution: Add a requireRole(...allowedRoles) middleware factory, applied per route based on this permission matrix:

Route	admin	police	forest	immigration
POST /api/register	✅	❌	❌	✅
GET /api/tourists, /api/tourists/:dtid	✅	✅	✅	❌
GET /api/panic-alerts	✅	✅	✅	❌
GET /api/safety-alerts	✅	✅	✅	❌
POST /api/admin/set-role	✅	❌	❌	❌

Approach:

js
const requireRole = (...roles) => (req, res, next) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions for this action.' });
    }
    next();
};

Chain it after authenticateToken on each route, e.g. app.post('/api/register', authenticateToken, requireRole('admin','immigration'), registerRateLimiter, validateRegistration, ...). Note: this means /api/register is no longer public — it now requires an authenticated Immigration/Admin officer to submit it on the tourist's behalf at check-in. Update Registration.jsx accordingly (it needs to be wrapped in ProtectedRoute and send the officer's auth token like every other page).

3. Tourist mobile app has no login mechanism (email + DTID), and reintroducing DTID-as-password would reopen the exact vulnerability already fixed

Problem: You previously (correctly) removed DTID as the Firebase Auth password because it's printed publicly on the pass/QR code — anyone who sees it could log in as that tourist. But the mobile app still needs an email+DTID login flow, and right now there's no backend support for it at all.

Solution: Don't use DTID as a reusable Firebase Auth password. Instead, treat DTID like a boarding-pass/ticket ID: the backend verifies email+DTID match a real record, then issues a short-lived, narrowly-scoped Firebase custom token for that specific tourist — not a standing password anyone could reuse to log in repeatedly at will without re-verification each time, and scoped so it can only ever act as that one DTID.

Approach:

Add POST /api/tourist-login (public, but rate-limited hard — e.g. 5 attempts per IP per 15 min via express-rate-limit) that:
Looks up the tourist by dtid in Firestore.
Confirms email matches (case-insensitive) — reuse the existing /api/is-active logic as a base.
If it matches, calls admin.auth().createCustomToken(firebaseUid, { role: 'tourist', dtid }) and returns the custom token to the app.
The mobile app then calls Firebase Auth's signInWithCustomToken() with that token — this session is short-lived (1 hour by default) and must be reissued the same way for a new session; it's not a permanent password.
Ensure every tourist created in /api/register still gets a corresponding Firebase Auth UID (already happens today) so createCustomToken has something to attach to.
Log every tourist-login attempt (success/fail) server-side for audit purposes, since this is now an identity-verification endpoint.
4. Firestore rules don't match the real field names, and roles/ownership aren't enforced at the database layer

Problem: Your current rules check request.resource.data.userId == request.auth.uid, but the app writes/reads alerts by dtid, not userId. Reads on tourists/panic_alert_emergencies/safety_alerts are open to any authenticated user, not just the intended roles, and there's no admin custom claim being set anywhere yet (fixed in #1) so request.auth.token.admin == true currently matches nobody.

Solution: Rewrite the rules to check request.auth.token.role against the matrix above, and to validate dtid ownership using the dtid custom claim issued in #3 for tourist writes.

Approach:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isOfficial() {
      return request.auth != null &&
             request.auth.token.role in ['admin', 'police', 'forest'];
    }

    function isAdmin() {
      return request.auth != null && request.auth.token.role == 'admin';
    }

    match /tourists/{dtid} {
      // Officials (not immigration) can read tourist records for monitoring
      allow read: if isOfficial();
      // Only the backend Admin SDK writes tourist records (bypasses rules) —
      // no direct client writes at all, immigration officers go through the API
      allow write: if false;
    }

    match /panic_alert_emergencies/{docId} {
      allow read: if isOfficial();
      // Only the authenticated tourist (via their scoped custom token) can create
      // an alert, and only under their own dtid
      allow create: if request.auth != null &&
                       request.auth.token.role == 'tourist' &&
                       request.resource.data.dtid == request.auth.token.dtid;
      allow update, delete: if false;
    }

    match /safety_alerts/{docId} {
      allow read: if isOfficial();
      allow create: if request.auth != null &&
                       request.auth.token.role == 'tourist' &&
                       request.resource.data.dtid == request.auth.token.dtid;
      allow update, delete: if false;
    }

    match /restricted_zones/{docId} {
      allow read: if request.auth != null; // any authenticated role can view zones
      allow write: if isAdmin(); // only Admin manages zone data
    }
  }
}

Deploy with firebase deploy --only firestore:rules and verify in the Firebase console's Rules Playground that: a tourist-role token can create an alert with a matching dtid but not read tourists; a police/forest/admin token can read everything but not create alerts; an immigration token can do neither (it only ever talks to /api/register through the backend).

5. Officials need to see role-appropriate data — currently the frontend has no concept of role at all

Problem: Navigation.jsx shows every link to every logged-in user regardless of role, and no page checks whether the current officer is even allowed to be there.

Solution: Extend AuthContext to expose the decoded role claim, and gate both navigation links and routes by role.

Approach:

In AuthContext.jsx, after onAuthStateChanged fires, call currentUser.getIdTokenResult() and store role: idTokenResult.claims.role || null in context state alongside user.
In Navigation.jsx, filter navItems by role before rendering: Immigration sees only "Register"; Police/Forest/Admin see "Dashboard," "Tourist List," "Panic Alerts," "Missing," but not necessarily "Register" (or show it read-only/disabled — your call, but keep Immigration's access minimal as specified).
Extend ProtectedRoute.jsx to accept an allowedRoles prop, e.g. <ProtectedRoute allowedRoles={['admin','police','forest']}><Dashboard /></ProtectedRoute>, and <ProtectedRoute allowedRoles={['admin','immigration']}><Registration /></ProtectedRoute>. Redirect to an "Access Denied" or back to their allowed home page if the role doesn't match, rather than showing a blank/broken page.
Add a small role badge next to the officer's name/logout button in Navigation.jsx (e.g. "Police Officer" / "Forest Officer" / "Immigration Officer" / "Admin") so it's always clear which role is signed in.
6. SOS/idle alerts need to reliably surface in the web portal for the right roles only

Problem: SOSToast.jsx is mounted globally in App.jsx, outside ProtectedRoute, so it tries to run its onSnapshot listeners even on /login and for Immigration Officers who shouldn't be seeing panic/safety data at all per the role matrix.

Solution: Only mount the alert listeners for roles that are supposed to monitor alerts (admin, police, forest), and only once a session with that role exists.

Approach:

Move <SOSToast /> out of the top-level App.jsx and into a wrapper that only renders inside the authenticated layout for allowed roles — e.g. render it conditionally based on const { role } = useAuth(); if (!['admin','police','forest'].includes(role)) return null; at the top of SOSToast.jsx itself, so it simply doesn't subscribe to anything for Immigration Officers or logged-out visitors.
Since Firestore rules now correctly scope panic_alert_emergencies/safety_alerts reads to isOfficial(), this also means the listener will only succeed for the right roles — the frontend check above is a UX/perf optimization on top of the rules doing the actual enforcement.
No change needed to how Dashboard.jsx/PanicAlerts.jsx/MissingComplaints.jsx consume DataContext — they'll keep working as-is once the officer's role is admin/police/forest, since DataContext already gates its fetch on user being present; extend that same useEffect guard to also check ['admin','police','forest'].includes(role) before calling fetchTourists/fetchPanicAlerts/fetchSafetyAlerts.
7. Explicit — do not touch the map

Problem: N/A — just a constraint.

Solution: Leave the <iframe> Google Maps embed block in Dashboard.jsx (db-map-card / db-map-container) completely untouched — same src, same static center, same styling. No geofencing, zone-plotting, or live-location work in this pass.

Verification checklist before calling this done
A brand-new officer account with no custom claim set cannot access any protected route (should be redirected/denied, not shown a broken page).
An Immigration-role account can reach /register and successfully submit POST /api/register, but gets 403 from /api/tourists, /api/panic-alerts, /api/safety-alerts.
A Police/Forest/Admin account can view Dashboard, Tourist List, Panic Alerts, Missing Complaints, and sees SOS/idle toasts appear in real time when a new alert document is created.
A simulated tourist custom-token session (via /api/tourist-login) can successfully create a document in panic_alert_emergencies/safety_alerts with its own dtid, but is rejected by Firestore rules if it tries to write a different dtid or read the tourists collection.
The Dashboard map iframe is pixel-identical to before this change.

just now can implment login alone role based
and chnage the login ui more good lookaccord to our theme for this alone give prompt

Read Multiple Files
Read Multiple Files

Good — theme is a blue/cyan "ocean travel" glassmorphism look (
#2563EB → 
#06B6D4 gradients, dark slate glass cards). Here's the focused prompt for role-based login + a themed UI upgrade only.

PROMPT:

You are working on D:\Hoster FInal yr project\touristgeofencing. Implement role-based login only — do not touch registration flow, alerts, Firestore rules for tourists collection beyond what's needed for roles, or the Dashboard map. The app's visual theme is an "ocean travel" glassmorphism style: primary gradient #2563EB → #06B6D4, dark slate glass cards (rgba(30,41,59,0.7) with backdrop-filter: blur), light text on dark glass (
#f8fafc headings, 
#94a3b8/
#cbd5e1 secondary text), rounded 10-16px corners, soft blue glow shadows. Match this exactly — don't introduce a new color palette.

1. No roles exist for officials today

Problem: Every logged-in account is treated identically. There's no Forest Officer / Police Officer / Immigration Officer / Admin distinction anywhere — AuthContext, ProtectedRoute, and the backend all only check "is there a valid token," never "what role does this person have."

Solution: Use Firebase Auth custom claims (role: 'admin' | 'police' | 'forest' | 'immigration') as the single source of truth, read on both the frontend and backend.

Approach:

Create backend/scripts/setUserRole.js, a manual CLI script:
js
  require('dotenv').config();
  const { admin } = require('../firebase-config');
  const [,, email, role] = process.argv;
  const VALID_ROLES = ['admin', 'police', 'forest', 'immigration'];
  (async () => {
      if (!email || !VALID_ROLES.includes(role)) {
          console.error('Usage: node setUserRole.js <email> <admin|police|forest|immigration>');
          process.exit(1);
      }
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().setCustomUserClaims(user.uid, { role });
      console.log(`✅ ${email} is now role: ${role}`);
      process.exit(0);
  })();
This is how you'll create the first officer accounts (create the user in Firebase Console → Authentication, then run this script to assign their role). Document this in the README.
In backend/middleware/authenticateToken.js, after verifyIdToken, also pull decodedUser.role onto req.user.role (custom claims come back automatically inside the decoded token, no extra call needed).
Add backend/middleware/requireRole.js:
js
  const requireRole = (...roles) => (req, res, next) => {
      if (!req.user?.role || !roles.includes(req.user.role)) {
          return res.status(403).json({ error: 'Your role does not have access to this resource.' });
      }
      next();
  };
  module.exports = requireRole;

Don't wire this into every route yet in this pass — just build the middleware and apply it to a placeholder GET /api/whoami route (returns { email, role }) so the frontend has something to verify login/role against immediately after sign-in.

2. Frontend has no awareness of role at all

Problem: AuthContext.jsx only stores the Firebase user object — not their role — so no page or nav link can adapt based on who's logged in.

Solution: Decode the role custom claim on sign-in and expose it through useAuth().

Approach:

In AuthContext.jsx, inside the onAuthStateChanged callback, after setUser(currentUser), if currentUser exists call currentUser.getIdTokenResult() and store role: idTokenResult.claims.role || null in a new role state field.
Also expose a roleLabel map for display purposes:
js
  const ROLE_LABELS = {
      admin: 'Administrator',
      police: 'Police Officer',
      forest: 'Forest Officer',
      immigration: 'Immigration Officer'
  };
Return { user, role, roleLabel: ROLE_LABELS[role] || null, loading, login, logout } from the context.
If a signed-in user has no role claim set (e.g. account created but setUserRole.js never run for them), treat them as unauthorized: ProtectedRoute should redirect them to a clear "Account pending role assignment — contact your administrator" screen rather than a blank/broken page.
3. Routes aren't gated by role yet

Problem: ProtectedRoute.jsx only checks if (!user), so any authenticated account — regardless of role — can reach every page.

Solution: Extend ProtectedRoute to optionally accept an allowed-roles list, and apply it per route once roles exist. (Keep this minimal for now — just build the capability; which exact roles get which pages was already specified in the earlier plan and can be wired in next.)

Approach:

jsx
export default function ProtectedRoute({ children, allowedRoles }) {
    const { user, role, loading } = useAuth();
    const location = useLocation();

    if (loading) return <div className="session-loading">Loading session...</div>;
    if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
    if (!role) return <Navigate to="/pending-role" replace />;
    if (allowedRoles && !allowedRoles.includes(role)) {
        return <Navigate to="/unauthorized" replace />;
    }
    return children;
}

Add two new lightweight route components/pages styled to match the theme: PendingRole.jsx ("Your account is awaiting role assignment") and Unauthorized.jsx ("You don't have access to this page"), both using the same glass-card look as Login.jsx. Don't apply allowedRoles to existing routes in App.jsx yet in this pass — just make the mechanism ready.

4. Login UI doesn't reflect who's signing in or show role after login

Problem: Login.jsx is a generic "Official Portal Access" form with no indication of role, and Navigation.jsx's logout button just shows a generic user icon with an email tooltip — no role badge anywhere.

Solution: Redesign Login.jsx to visually match the app's ocean-travel theme more richly (currently reasonable but plain), and surface the officer's role clearly once logged in.

Approach — Login.jsx redesign:

Wrap the existing card in a full-bleed themed background: reuse the app's signature gradient (linear-gradient(135deg, rgba(37,99,235,0.95), rgba(6,182,212,0.9))) as a soft animated backdrop behind the glass card (e.g. large blurred gradient blobs positioned absolutely, low opacity, subtle float animation) — matching the header gradient already used elsewhere in the app, so the login page doesn't feel like a disconnected plain screen.
Add a shield/badge icon header consistent with the brand mark used in Navigation.jsx (reuse Logo.png or a shield icon) above "Official Portal Access," so it's recognizably part of the same product.
Below the password field, add a role preview chip that appears after a successful login but before redirect — e.g. a brief "Signed in as Police Officer" toast/badge using the role's label, styled as a pill with the theme's blue-cyan gradient, giving the officer clear confirmation of which role/permissions they now have.
Keep the existing input styling (icon-prefixed inputs, focus glow, gradient submit button) — it already matches the theme well — but tighten the card's vertical rhythm and add a subtle divider-separated "role" line under the officer's email once authenticated, for use in Navigation.jsx too (see below).
Update the "Note: Officer/Admin accounts must be created manually via Firebase Console" text to also mention role assignment: "Officer accounts and role access (Police, Forest, Immigration, Admin) are provisioned by your system administrator."

Approach — Navigation.jsx role badge:

Replace the plain logout button's tooltip-only email display with a small always-visible role pill next to the user's name, using role-specific accent colors within the same palette family (e.g. Police → blue 
#2563EB, Forest → teal/cyan 
#06B6D4, Immigration → indigo 
#4F46E5, Admin → a slightly warmer gold-blue 
#F59E0B accent used sparingly) so officers can tell at a glance which role is active, especially useful if the same officer manages multiple accounts.
Example structure:
jsx
  {user && (
      <div className="nav-user-badge">
          <span className="nav-user-email">{user.email}</span>
          <span className={`nav-role-pill role-${role}`}>{roleLabel}</span>
      </div>
  )}

Style .nav-role-pill as a small rounded pill (border-radius: 999px, font-size: 0.7rem, font-weight: 600, padding: 0.2rem 0.65rem) with a translucent background tinted to the role's accent color, consistent with how status chips (db-status-chip, tl-status-chip) are already styled elsewhere in the codebase — reuse that same chip pattern rather than inventing a new visual language.

Verification checklist
Running node scripts/setUserRole.js someone@example.com police successfully sets the claim, confirmed by that user's getIdTokenResult() returning role: 'police' after re-login.
GET /api/whoami returns the correct email + role for a signed-in officer, and 403s cleanly if requireRole is tested against a route it doesn't match.
A signed-in user with no role claim lands on the "pending role" screen, not a blank page.
Login page visually reads as part of the same product as the rest of the app — same gradient family, same glass-card language, no new colors introduced.
Role pill appears correctly in the navigation bar immediately after login and updates correctly on logout.
Dashboard map iframe, registration flow, and existing Firestore rules for alerts remain completely untouched by this pass.