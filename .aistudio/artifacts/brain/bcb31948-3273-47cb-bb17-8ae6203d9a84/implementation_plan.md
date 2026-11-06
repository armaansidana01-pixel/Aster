# Pixel-Accurate Bluebook Practice Test Mirror & Warm Beige Editorial Theme

This plan details the pixel-accurate recreation of every UI element, draggable tool, LaTeX/SVG reference diagram, and special interaction shown in the Bluebook practice test screen recording and reference screenshot, paired with a cohesive **Warm Beige** main theme across **Aster — SAT Studio**.

---

## 1. Overview & Visual Theme Architecture

### 1.1 Main Warm Beige Complimentary Theme ("Warm Parchment & Academic Navy")
- **Default Theme Activation**: Warm Beige (`light` mode) becomes the default primary theme across the entire workspace and testing environment, while preserving the dark mode option in Settings.
- **Color Palette & Surface Tokens**:
  - **Primary Canvas (`--bg-canvas`)**: Warm Parchment Beige (`#F5EFE6`)
  - **Elevated Card / Question Surface (`--bg-surface`)**: Warm Ivory (`#FCF9F4`)
  - **Chrome Header & Footer Bar (`--bg-chrome`)**: Soft Sand / Warm Bluebook Tint (`#EAE2D3`)
  - **Practice Banner Bar (`--bg-banner`)**: Deep Academic Navy (`#1B3152`) with crisp white tracking-wide uppercase typography (`THIS IS A PRACTICE TEST`)
  - **Primary Ink (`--text-primary`)**: Deep Espresso Charcoal (`#1E1B18`)
  - **Muted Ink (`--text-secondary`)**: Warm Umber Gray (`#5A5247`)
  - **Borders & Outlines (`--border-warm`)**: Tactile Stone (`#D6CBB9`) and active focus outlines (`#1E3A68`)
- **Buttons, Outlines, Shadows & Hover States**:
  - Primary action pills (`Back`, `Next`, `Start`, `Go to Review Page`) feature `1.5px` crisp borders, tactile drop shadows (`0 2px 0 rgba(27,49,82,0.18), 0 4px 12px rgba(27,49,82,0.08)`), subtle `-translate-y-[1px]` hover lift, and active press states.
  - Secondary/outline pills (`Hide`/`Show`, `Show Keypad`, `Undo`, `Continue Practice Test`) feature crisp dark outlines (`1.5px solid #2C2620`) with warm sand hover fills.
- **Typography**:
  - **Display & UI Headings**: `Plus Jakarta Sans` (bold, tight tracking, crisp hierarchy).
  - **Passages, Math Stems & Reference Formulas**: `Source Serif 4` paired with LaTeX/KaTeX-styled italic mathematical variables ($\ell, w, r, h, b, a, c, x, s$) and upright numerals.
  - **Timers, Coordinates & Counters**: `JetBrains Mono` with `tabular-nums`.

---

## 2. Pixel-by-Pixel Bluebook Screen Recording Specification

### 2.1 Top Exam Chrome & Practice Banner (00:00 – 00:58)
1. **Left Zone**:
   - Bold section/module title: `Section 2, Module 2: Math` (or `Section 1, Module 1: Reading and Writing`).
   - `Directions` button directly underneath with an animated chevron (`Directions ⌄`) that opens the Directions modal popover.
2. **Center Timer Zone (00:00 – 00:55)**:
   - Large tabular countdown display (`44:10`).
   - Pill-shaped `Hide` button (`rounded-full border border-stone-800 px-3.5 py-0.5 text-xs font-semibold`) directly below the time.
   - **Special Interaction (00:54)**: Clicking `Hide` replaces the numeric digits with a compact clock icon (`🕒`) above the pill button, which changes its label to `Show`. Clicking `Show` restores the live countdown digits.
3. **Right Toolbar Zone (00:00 – 00:56)**:
   - Vertical icon-above-label toolbar buttons:
     - **`Calculator`**: Calculator icon above `Calculator` label (toggles the draggable Graphing/Scientific Calculator).
     - **`Reference`**: $X^2$ icon above `Reference` label (toggles the draggable/fullscreen LaTeX & SVG Reference Sheet).
     - **`More`**: Vertical 3-dot icon (`⋮`) above `More` label.
4. **Full-Width Practice Banner**:
   - Directly beneath the top header bar, a full-width navy banner strip with rounded bottom corners (`rounded-b-2xl`) displays `THIS IS A PRACTICE TEST` in centered bold uppercase white text.

### 2.2 Adaptive Split-Pane vs. Centered Single-Column Layout
- **Split-Pane Layout (00:00 – 00:14)**:
  - Used automatically whenever a question has a reading passage/stimulus **or** is a **Student-Produced Response (SPR)** question.
  - Divided by a vertical border with a draggable resize handle in the center.
- **Centered Single-Column Layout (00:15 – 00:56)**:
  - Used automatically for Multiple-Choice Math questions that have no separate reading passage (matching Questions 2, 3, and 4 in the screen recording).
  - Renders the question header bar, stem/table, and answer choices in a clean centered column (`max-w-3xl mx-auto`).

### 2.3 Student-Produced Response (SPR) Directions, Live Preview & Draggable Keypad (00:00 – 00:13)
1. **Left Pane — Exact Official SPR Directions & Examples Table**:
   - Heading: **Student-produced response directions**
   - All 6 official bullet points with exact bolding (**more than one correct answer**, **positive**, **negative**, **fraction**, **decimal**, **mixed number**, **symbols**).
   - **Examples** table with columns `Answer`, `Acceptable ways to enter answer`, and `Unacceptable: will NOT receive credit`, showing pill badges for `3.5` (`3.5`, `3.50`, `7/2` vs. `31/2`, `3 1/2`) and `2/3` (`2/3`, `.6666`, `.6667`, `0.666`, `0.667` vs. `0.66`, `.66`, `0.67`, `.67`).
2. **Right Pane — SPR Input, Character Validation & Live Answer Preview**:
   - Enforces Bluebook character limits: **up to 5 characters** for a positive answer and **up to 6 characters** (including `-`) for a negative answer; permits only digits `0–9`, `.`, `/`, and a leading `-`.
   - **`Answer Preview:`** directly below the input box, rendering fractions (e.g., `7/2` $\rightarrow \frac{7}{2}$) and negative signs (`-21` $\rightarrow -21$) in real time as the student types.
   - **`[123] Show Keypad` / `Hide Keypad` Button**: Toggles the floating on-screen numeric keypad.
3. **Draggable On-Screen Keypad Modal (00:06 – 00:12)**:
   - Floating window with a dark draggable title bar (`Keypad` on the left, `×` close button on the right).
   - 4-row grid matching the video layout:
     - Row 1: `1`, `2`, `3`, `⌫` (backspace)
     - Row 2: `4`, `5`, `6`, `Clear`
     - Row 3: `7`, `8`, `9`, `/`
     - Row 4: `-`, `0`, `.` (with blank 4th cell)
   - Clicking buttons updates the SPR answer immediately while respecting the 5/6 character rule.

### 2.4 Question Header Strip, `[ABC]` Eliminator, Undo & Flagging Interactions (00:15 – 00:36)
1. **Question Header Strip**:
   - Left: Solid dark square with bold white question number (`1`, `2`, `3`...) + `Mark for Review` toggle button with bookmark icon.
   - Right (on MCQ questions): `[ABC]` strikethrough toggle button.
     - Hovering `[ABC]` displays a dark tooltip above it with a downward pointer arrow: `"Cross out answer choices you think are wrong."` (00:25, 00:27).
   - Bottom edge of the question header strip features the signature Bluebook dashed border line.
2. **MCQ Choice Cards & Special Eliminator / Undo Behavior (00:18 – 00:26)**:
   - Each choice card (`A`, `B`, `C`, `D`) has a circular letter badge and full-width rounded border.
   - **Selected State**: Thick blue/navy border + solid-filled circular letter badge with white letter.
   - **Eliminating a Choice (`⊘A` .. `⊘D`)**:
     - When `[ABC]` mode is active, each choice row displays a circular crossed-out letter button (`⊘A`, `⊘B`, `⊘C`, `⊘D`) to the right of the card.
     - **Special Interaction — Eliminating a Selected Choice Clears the Answer (00:21 – 00:22)**: If choice `C` is currently selected and the user clicks `⊘C`, choice `C` is immediately **deselected** (clearing the question's saved answer so the question reverts to `Unanswered` on the Question Selector), a thick horizontal line crosses through the entire choice card, the choice dims, and the right-side button becomes an underlined **`Undo`** button.
     - **Clicking `Undo` (00:22)**: Removes the strikethrough and restores the choice to normal unselected state.
     - **Toggling `[ABC]` Off (00:25)**: Hides the right-side `⊘` / `Undo` controls while preserving any active strikethroughs.
3. **Flagging / Mark for Review (00:28 – 00:30)**:
   - Clicking `Mark for Review` fills the bookmark icon in crimson red (`#C81E1E`) and updates the Question Selector tile with a red bookmark corner badge.

### 2.5 Question Selector Popup & Module Review Page (00:13 – 00:15, 00:29 – 00:32)
1. **Footer Trigger**: Centered dark button `Question X of Y ⌃` (`⌄` when open).
2. **Selector Popover Card**:
   - Floating card centered above the footer with a bottom-center pointer triangle.
   - Header: `Section 2, Module 2: Math Questions` (dynamic by section/module) + `×` close button.
   - Legend bar between two horizontal dividers:
     - `📍 Current` | `⬜ Unanswered` (dashed square) | `🔖 For Review` (red bookmark)
   - **10-Column Number Grid**:
     - **Unanswered**: Dashed border square with bold number.
     - **Answered**: Solid filled accent square with bold white number (reverts to dashed if answer is cleared via eliminator or backspace).
     - **Current Question**: Small pin/caret icon (`📍`) centered directly above the tile + underline under the number.
     - **Marked for Review**: Red bookmark ribbon badge in the top-right corner of the tile.
   - **`Go to Review Page` Button**: Centered outlined pill button at the bottom of the popover; opens the full-screen Module Review ("Check Your Work") view before final submission.

### 2.6 Draggable Graphing & Scientific Calculator Window (00:36 – 00:50)
- **Draggable Floating Window**:
  - Dark header bar with grab-to-drag positioning anywhere in the viewport.
  - **Mode Switcher Pill in Header (00:37, 00:48)**:
    - `[📈 Graphing | 🧮 Scientific]` toggle in the top-left of the calculator title bar.
    - **Graphing Mode**: Full Desmos Graphing Calculator with interactive coordinate plane, expression list (`1`, `2`, `3`...), and collapsible Desmos math keypad.
    - **Scientific Mode (00:48 – 00:49)**: Multi-row expression & result history display at the top, plus the complete scientific keypad (`main`, `abc`, `func`, `RAD`/`DEG` toggle, $a^2, a^b, |a|, \sqrt{}, \sqrt[n]{}, \pi, \sin, \cos, \tan, (, ), \text{ans}, \text{clear all}$, digits, and blue enter button).
  - **Expand / Collapse Width & Close Controls**: Header buttons to toggle between standard (`380px`) and wide (`600px`) calculator width, plus `×` to close.

### 2.7 Draggable & Fullscreen LaTeX + SVG Reference Sheet (Screenshot Mirror)
- **Draggable Modal with Fullscreen Toggle**:
  - Opens by default as a draggable floating window (like the Calculator) and includes an **Expand to Fullscreen / Restore Window** button in the header bar.
- **Exact SVG Geometric Diagrams + LaTeX Formulas**:
  - **Row 1**:
    1. Circle ($r$): $A = \pi r^2$, $C = 2\pi r$
    2. Rectangle ($\ell, w$): $A = \ell w$
    3. Triangle ($b, h$): $A = \frac{1}{2}bh$
    4. Right Triangle ($a, b, c$): $c^2 = a^2 + b^2$
    5. Special Right Triangles ($30^\circ\text{–}60^\circ\text{–}90^\circ$ with $x, x\sqrt{3}, 2x$ and $45^\circ\text{–}45^\circ\text{–}90^\circ$ with $s, s, s\sqrt{2}$)
    6. Rectangular Solid ($\ell, w, h$): $V = \ell wh$
    7. Cylinder ($r, h$): $V = \pi r^2 h$
  - **Row 2**:
    1. Sphere ($r$): $V = \frac{4}{3}\pi r^3$
    2. Cone ($r, h$): $V = \frac{1}{3}\pi r^2 h$
    3. Rectangular Pyramid ($\ell, w, h$): $V = \frac{1}{3}\ell wh$
  - **Bottom Reference Statements**:
    - *The number of degrees of arc in a circle is 360.*
    - *The number of radians of arc in a circle is $2\pi$.*
    - *The sum of the measures in degrees of the angles of a triangle is 180.*

### 2.8 `More` Menu Dropdown & `"Do You Want to Exit This Practice Test?"` Modal (00:55 – 00:58)
1. **`More` Dropdown (`⋮`)**:
   - Floating white card anchored to the top-right `More` button with 5 items:
     - `Help` (opens Bluebook Help modal)
     - `Shortcuts` (opens Keyboard Shortcuts modal)
     - `Assistive Technology` (opens Assistive Tech & Zoom/Timing info modal)
     - `Line Reader` (toggles the interactive Line Reader focus tool)
     - `Save and Exit` (triggers the exit confirmation modal)
2. **Exit Confirmation Modal (00:57 – 00:58)**:
   - Centered dialog over a darkened backdrop:
     - Header: **`Do You Want to Exit This Practice Test?`** + `×` button.
     - Body: *"If you exit now, we'll save your progress and you can resume this practice test within 90 days."*
     - Actions: Underlined **`Continue Practice Test`** button and warm gold/yellow **`Save and Exit`** pill button (`#FACC15` with dark border and bold text).

### 2.9 Bottom Footer Bar (`Back` & `Next` Rules)
- Left: Student name (`profile.name`).
- Center: `Question X of Y ⌃` selector button (hidden on the Module Review Page).
- Right:
  - On Question 1 (`currentIndex === 0`): Only the **`Next`** pill button is rendered (matching 00:00–00:13).
  - On Question 2+: Both **`Back`** and **`Next`** pill buttons are rendered side-by-side (matching 00:15–00:56).

---

## 3. System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Aster — SAT Studio (Warm Beige Theme)                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  BluebookTestingScreen.tsx                                                   │
│  ├── Top Chrome Header                                                       │
│  │   ├── Section & Module Title + Directions Popover                         │
│  │   ├── Countdown Timer + Hide/Show Clock Icon Toggle                       │
│  │   └── Toolbar: Calculator | Reference | More (⋮) -> Dropdown Menu         │
│  ├── Full-Width Practice Banner ("THIS IS A PRACTICE TEST")                  │
│  ├── Adaptive Question Workspace                                             │
│  │   ├── Split-Pane Mode (Passages & SPR Official Directions + Examples)     │
│  │   ├── Single-Column Mode (Passage-free Math MCQ Questions)                │
│  │   ├── SPR Input (5/6 char rule) + Live LaTeX Preview + Draggable Keypad   │
│  │   └── MCQ Cards + [ABC] Tooltip + Cross-Out Clears Selection + Undo       │
│  ├── Floating Draggable Windows                                              │
│  │   ├── Draggable Calculator (Graphing Desmos <-> Scientific Calculator)    │
│  │   └── Draggable / Fullscreen Reference Sheet (SVG Diagrams + LaTeX)       │
│  ├── Question Selector Popover (10-Col Grid, Pin, Dashed/Solid, Red Flag)    │
│  │   └── Module Review Page ("Check Your Work" Full-Screen Summary)          │
│  └── Exit Confirmation Modal ("Do You Want to Exit This Practice Test?")     │
└──────────────────────────────────────────────────────────────────────────────┘
```
