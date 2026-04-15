ere the new block fits best without disrupting the existing flow or contradicting other rules.

**Where to Add the Dynamic Installation Block:**

1.  **In `PROMPT`:**
    *   **Location:** Right after the existing `ENVIRONMENT` section and **before** the `CODE QUALITY` section.
    *   **Reasoning:** The `ENVIRONMENT` section details the tools available (`createOrUpdateFiles`, `terminal`, `readFiles`) and critical path rules. It currently says `NEVER modify: package.json, package-lock.json, ...`. The dynamic installation block clarifies *how* to modify these files safely *only via the `terminal` tool*. Placing it here, just after the tool definitions and before quality rules, makes it logically part of the environment setup guidelines.
    *   **Code to Insert:**
        ```typescript
        // ── DYNAMIC PACKAGE INSTALLATION RULES ──────────────────────────────────
        DYNAMIC PACKAGE INSTALLATION RULES

        When a task requires a library NOT already in the sandbox:
        - Install it via terminal: terminal("npm install ")
        - You MAY modify package.json & package-lock.json ONLY through npm install commands
        - NEVER manually edit package.json or package-lock.json with createOrUpdateFiles
        - Before installing, verify it's missing: terminal("ls node_modules | grep ")
        - Limit to 1–3 packages per task to avoid timeouts
        - After install, verify it loads: terminal('node -e "require(\\"\\")"')
        - If install fails, fallback to built-in alternatives & log the error
        - ONLY use npm. Do NOT use yarn, pnpm, bun, sudo, or apt inside the sandbox
        - NEVER run: npm run dev, npm run build, next dev, next start, etc.
        // ────────────────────────────────────────────────────────────────────────
        ```

2.  **In `BACKEND_AGENT_PROMPT`:**
    *   **Location:** Right after the existing `ENVIRONMENT` section and **before** the `FINAL OUTPUT (MANDATORY)` section.
    *   **Reasoning:** Similarly, the `ENVIRONMENT` section in the backend prompt mentions secrets and environment variables. Adding the dynamic installation rules here ensures the backend agent knows how to safely install backend-specific libraries (like `stripe`, `@aws-sdk`, etc.) if needed, following the same safe protocol as the main agent.
    *   **Code to Insert:**
        ```typescript
        // ── DYNAMIC PACKAGE INSTALLATION RULES ──────────────────────────────────
        DYNAMIC PACKAGE INSTALLATION RULES

        When a task requires a library NOT already in the sandbox:
        - Install it via terminal: terminal("npm install ")
        - You MAY modify package.json & package-lock.json ONLY through npm install commands
        - NEVER manually edit package.json or package-lock.json with createOrUpdateFiles
        - Before installing, verify it's missing: terminal("ls node_modules | grep ")
        - Limit to 1–3 packages per task to avoid timeouts
        - After install, verify it loads: terminal('node -e "require(\\"\\")"')
        - If install fails, fallback to built-in alternatives & log the error
        - ONLY use npm. Do NOT use yarn, pnpm, bun, sudo, or apt inside the sandbox
        - NEVER run: npm run dev, npm run build, next dev, next start, etc.
        // ────────────────────────────────────────────────────────────────────────
        ```

Remember to remove or adjust the conflicting rule `NEVER modify: package.json, package-lock.json, ...` in the `ENVIRONMENT`
