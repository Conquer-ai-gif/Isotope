

# ─── PRE-INSTALL ALL BACKEND STACK MENTIONED IN PROMPT ──────────────────
RUN npm install zod resend @clerk/nextjs rate-limiter-flexible @supabase/supabase-js @prisma/client prisma inngest @sentry/nextjs @react-email/components react-email

# ... your existing shadcn commands ...
RUN npx --yes shadcn@2.6.3 init --yes -b neutral --force
RUN npx --yes shadcn@2.6.3 add --all --yes

# ✅ PASTE THE LINE HERE
RUN npm install zod resend @clerk/nextjs rate-limiter-flexible @supabase/supabase-js @prisma/client prisma inngest @sentry/nextjs @react-email/components react-email

# Move the Nextjs app to the home directory and remove the nextjs-app directory
WORKDIR /home/user
RUN cp -a /home/user/nextjs-app/. /home/user/ && rm -rf /home/user/nextjs-app



Yes, I have the file you shared earlier. Based on that file, here is exactly where to add the **Dynamic Package Installation** rules in your **Main `PROMPT`** without breaking your existing logic.

### ⚠️ CRITICAL STEP: Remove the Conflict First
Your `ENVIRONMENT` section currently has a rule that **prevents** package installation:
> `NEVER modify: package.json, package-lock.json...`

**You must delete this specific line** (or comment it out) before adding the new block, otherwise the AI will be confused.

---

### 📍 Exact Location
Find the **End of the `ENVIRONMENT` section** (right after `NEVER run: npm run dev...`) and **Before the `CODE QUALITY` section**. Paste the new block there.

### 📝 The Block to Copy
Here is the version tailored for yo


// ─── DYNAMIC PACKAGE INSTALLATION RULES (ADD THIS AFTER ENVIRONMENT) ─────────
### DYNAMIC PACKAGE INSTALLATION RULES

When a task requires a library NOT already in the sandbox:
- Install it via terminal: terminal("npm install <package-name>")
- You MAY modify package.json & package-lock.json ONLY through npm install commands
- NEVER manually edit package.json or package-lock.json with createOrUpdateFiles
- Before installing, verify it's missing: terminal("ls node_modules | grep <pkg>")
- Limit to 1–3 packages per task to avoid timeouts
- After install, verify it loads: terminal('node -e "require(\\"<package-name>\\")"')
- If install fails, fallback to built-in alternatives & log the error
- ONLY use npm. Do NOT use yarn, pnpm, bun, sudo, or apt inside the sandbox
- NEVER run: npm run dev, npm run build, next dev, next start, etc.
// ─────────────────────────────────────────────────────────────────────────────
