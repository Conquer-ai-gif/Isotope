TWO DIFFERENT PROMRT COMPARE IT THE MERGE
PASTE IT INSIDE THE TASK GRAPH PLAN PROMPT
AFTER INTUPT CONTEXT AND BEFORE OUTPUT FORMAT

// ─── VISUAL / ANIMATION REQUESTS (LOVABLE/V0 STYLE) ─────────────────────────
## VISUAL / ANIMATION REQUESTS (LOVABLE/V0 STYLE)

If the user asks for ANY of these keywords:
"animation", "showcase", "landing page demo", "Apple-style flow", "n8n diagram", 
"event-driven UI", "live preview", "interactive demo", "cursor typing",
"particle flow", "connection lines", "status transitions", "hero section",
"animated cards", "scroll animations", "hover effects"

→ Treat this as a UI task with the following STRICT rules:

### OUTPUT CONSTRAINTS
- Return a SINGLE task (max 2 if truly complex) with type: "ui"
- The task "description" MUST clearly explain the visual outcome for user approval
  Example: "Create EventShowcase.tsx: animated flow from prompt input → GitHub → Vercel → Sandbox with glowing SVG particle trails"
- The "files" array MUST contain exactly one path: "src/components/landing/event-showcase.tsx"
- Set "priority": 11+ (UI tasks run after backend/db)

### DESIGN SYSTEM RULES (NON-NEGOTIABLE)
- Use ONLY Tailwind semantic tokens: bg-background, text-foreground, bg-primary, text-accent, border-border, ring-offset-background, etc.
- NEVER use hardcoded hex colors (#fff, #000) or arbitrary values (text-[13px], w-[373px])
- Use shadcn/ui components from "@/components/ui/*" as base — extend via className prop only
- Use lucide-react for ALL icons (already installed) — NEVER use emojis (❌, ✅, ✨) or inline SVG icons
- Use framer-motion as primary animation library (already installed), but may use:
  • CSS animations/transitions via Tailwind classes (animate-pulse, transition-all)
  • Native Web Animations API for simple cases
  • GSAP only if explicitly requested and already in sandbox dependencies
- All animations MUST respect prefers-reduced-motion media query

### LOVABLE/V0 STYLE PATTERNS
- SINGLE FILE: Export one default function component — no helper files, no sub-components unless essential
- SELF-CONTAINED: All logic, styles, and animations in one file — no external CSS imports
- VISUALLY POLISHED: Subtle shadows, smooth transitions, proper spacing, glassmorphism where appropriate
- RESPONSIVE BY DEFAULT: Mobile-first layout, stacks vertically on small screens
- ACCESSIBLE: Proper aria-labels, keyboard navigation, focus states, semantic HTML
- COPY-PASTE READY: Component should work when dropped into any Next.js app with shadcn + Tailwind

### ANIMATION IMPLEMENTATION GUIDELINES
#### For framer-motion (preferred):
- Use <motion.div> with initial/animate/transition props
- Animate only transform/opacity for performance (avoid layout thrashing)
- Add will-change: transform via className for GPU acceleration
- Use useAnimation hook for complex sequences, useInView for scroll triggers

#### For CSS/Tailwind animations:
- Use built-in classes: animate-pulse, animate-bounce, transition-all duration-300
- Create custom keyframes in the component only if essential (use <style jsx> or CSS-in-JS)
- Prefer Tailwind's transition utilities over custom CSS when possible

#### For particle/connection effects:
- Use SVG <path> with motion.pathLength for drawing animations
- Use CSS gradient + animate background-position for simple glowing trails
- Keep particle count low (<20) for performance

### ICON USAGE RULES
- Import icons from lucide-react: import { Github, Triangle, Code, Check } from "lucide-react"
- Use <Icon className="w-5 h-5" /> pattern — never inline SVG strings
- For custom icons not in lucide: create a minimal SVG component in the same file
- NEVER use emojis as icons: ❌ <span>✅</span> → ✅ <Check className="text-green-500" />

### COMPONENT STRUCTURE TEMPLATE
```tsx
"use client" // if using hooks/motion

import { motion } from "framer-motion"
import { Github, Triangle, Code, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function EventShowcase({ 
  autoPlay = true, 
  reducedMotion = false 
}: { 
  autoPlay?: boolean 
  reducedMotion?: boolean 
}) {
  // Animation logic here
  
  return (
    <div className="relative w-full max-w-4xl mx-auto p-6">
      {/* Content using semantic tokens */}
      <Card className="bg-background border-border">
        <CardContent className="p-6">
          {/* Animation elements */}
        </CardContent>
      </Card>
    </div>
  )
}


// ─── VISUAL / ANIMATION REQUESTS (LOVABLE/V0 STYLE) ─────────────────────────
## VISUAL / ANIMATION REQUESTS (LOVABLE/V0 STYLE)

If the user asks for ANY of these keywords:
"animation", "showcase", "landing page demo", "Apple-style flow", "n8n diagram", 
"event-driven UI", "live preview", "interactive demo", "cursor typing",
"particle flow", "connection lines", "status transitions", "hero section",
"animated cards", "scroll animations", "hover effects"

→ Treat this as a UI task with the following STRICT rules:

### OUTPUT CONSTRAINTS
- Return a SINGLE task (max 2 if truly complex) with type: "ui"
- The task "description" MUST clearly explain the visual outcome for user approval
  Example: "Create EventShowcase.tsx: animated flow from prompt input → GitHub → Vercel → Sandbox with glowing SVG particle trails"
- The "files" array MUST contain exactly one path: "src/components/landing/event-showcase.tsx"
- Set "priority": 11+ (UI tasks run after backend/db)

### DESIGN SYSTEM RULES (NON-NEGOTIABLE)
- Use ONLY Tailwind semantic tokens: bg-background, text-foreground, bg-primary, text-accent, border-border, ring-offset-background, etc.
- NEVER use hardcoded hex colors (#fff, #000) or arbitrary values (text-[13px], w-[373px])
- Use shadcn/ui components from "@/components/ui/*" as base — extend via className prop only
- Use lucide-react for ALL icons (already installed) — NEVER use emojis (❌, ✅, ✨) or inline SVG icons
- Use framer-motion as primary animation library (already installed), but may use:
  • CSS animations/transitions via Tailwind classes (animate-pulse, transition-all)
  • Native Web Animations API for simple cases
  • GSAP only if explicitly requested and already in sandbox dependencies
- All animations MUST respect prefers-reduced-motion media query

### LOVABLE/V0 STYLE PATTERNS
- SINGLE FILE: Export one default function component — no helper files, no sub-components unless essential
- SELF-CONTAINED: All logic, styles, and animations in one file — no external CSS imports
- VISUALLY POLISHED: Subtle shadows, smooth transitions, proper spacing, glassmorphism where appropriate
- RESPONSIVE BY DEFAULT: Mobile-first layout, stacks vertically on small screens
- ACCESSIBLE: Proper aria-labels, keyboard navigation, focus states, semantic HTML
- COPY-PASTE READY: Component should work when dropped into any Next.js app with shadcn + Tailwind

### ANIMATION IMPLEMENTATION GUIDELINES
#### For framer-motion (preferred):
- Use <motion.div> with initial/animate/transition props
- Animate only transform/opacity for performance (avoid layout thrashing)
- Add will-change: transform via className for GPU acceleration
- Use useAnimation hook for complex sequences, useInView for scroll triggers

#### For CSS/Tailwind animations:
- Use built-in classes: animate-pulse, animate-bounce, transition-all duration-300
- Create custom keyframes in the component only if essential (use <style jsx> or CSS-in-JS)
- Prefer Tailwind's transition utilities over custom CSS when possible

#### For particle/connection effects:
- Use SVG <path> with motion.pathLength for drawing animations
- Use CSS gradient + animate background-position for simple glowing trails
- Keep particle count low (<20) for performance

### ICON USAGE RULES
- Import icons from lucide-react: import { Github, Triangle, Code, Check } from "lucide-react"
- Use <Icon className="w-5 h-5" /> pattern — never inline SVG strings
- For custom icons not in lucide: create a minimal SVG component in the same file
- NEVER use emojis as icons: ❌ <span>✅</span> → ✅ <Check className="text-green-500" />

### EXAMPLE TASK OUTPUT (for reference only)
{
  "tasks": [{
    "id": "task_1",
    "type": "ui",
    "description": "Create EventShowcase.tsx: single-file animated demo showing prompt input → AI generation → GitHub push → Vercel deploy → sandbox update, with SVG particle trails between lucide-react icons, using framer-motion and Tailwind semantic tokens",
    "files": ["src/components/landing/event-showcase.tsx"],
    "dependsOn": [],
    "priority": 11
  }]
}

### FALLBACK & ERROR HANDLING
- If request is ambiguous: make reasonable assumptions and still output valid TaskGraph JSON
- If animation is too complex for one file: split into max 2 tasks with explicit dependsOn
- If library is missing: use CSS/Tailwind fallback, note in task description
- NEVER output free-form text, explanations, or markdown — only valid TaskGraph JSON
// ──────────────────────────────────────────────────────────────────────────
