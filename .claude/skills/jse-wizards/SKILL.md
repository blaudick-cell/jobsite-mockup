---
name: jse-wizards
description: Multi-step Admin creation wizards. WizardShell component, validation pattern, scroll-to-top, code-field auto-fill, neutral placeholders, atomic submit + navigate.
---

# JSE Wizards

Four admin creation flows share one shell: `AdminNewProject`, `AdminNewHauler`, `AdminNewDriver`, `AdminNewTruck`. All live in Block 4 of `index.html`.

## `WizardShell` component

The shared chrome:

```jsx
<WizardShell
  steps={['Basics', 'Haulers', 'Trucks', 'Review']}
  currentStep={step}
  onCancel={() => navigate('/admin')}
  onBack={() => setStep(s => s - 1)}
  onNext={() => setStep(s => s + 1)}
  onSubmit={submit}
  nextDisabled={!isStepValid(step)}
  submitDisabled={!isStepValid(4)}
  submitLabel="Create project"
  crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Projects', to: '/admin' }, { label: 'New project' }]}
  eyebrow="New project"
  title="Create a new project"
>
  {step === 1 && <BasicsStep ... />}
  {step === 2 && <HaulersStep ... />}
  ...
</WizardShell>
```

**Behavior:**
- Renders the step indicator only when `steps.length > 1` (so single-step "wizards" like AdminNewDriver still use the shell for visual consistency without a useless dot row).
- Hides the Back button on step 1.
- Swaps Next → Submit on the last step OR whenever the wizard has only one step.
- `useEffect(() => window.scrollTo(0, 0), [currentStep])` — every transition lands at the top.
- Cancel always renders ghost-style on the left; Back + Next/Submit cluster right with `gap: S[3]`.

## Validation pattern

Each wizard defines `stepValid(n)` derivations from local state:

```js
const basicsValid = !!basics.name.trim() && codeValid && !!basics.gc.trim() && !!basics.address.trim() && !!basics.startDate && basics.materials.length > 0;
const haulersValid = haulerIds.length > 0;
const trucksValid = trucks.every(t => t.haulerId && haulerIds.includes(t.haulerId));
```

Disable Next via `nextDisabled={(step === 1 && !basicsValid) || (step === 2 && !haulersValid) || (step === 3 && !trucksValid)}`. Also guard the Submit on the final step.

## Code-field auto-fill (project wizard)

Project ID auto-derives from the project name as the user types — initials, uppercased, slice to 4 chars. Sticky once the user touches the Code field; resumes deriving if they clear it back to empty:

```js
const [codeTouched, setCodeTouched] = useState(false);
const effectiveCode = codeTouched ? basics.code.toUpperCase() : deriveCode(basics.name);

// onChange:
const v = e.target.value;
setCodeTouched(v.length > 0);  // unsticks when emptied
setBasics(b => ({ ...b, code: v }));
```

Plus a duplicate-id check: `const codeDuplicate = db.projects.some(p => p.id === effectiveCode);` with an inline warning.

## Neutral placeholders

NEVER use seed data values as placeholders (a user might think a project named "5800 Federal" already exists). Use generic examples:

- name: `"e.g., West Side Phase 2"`
- code: `"e.g., WSP"`
- gc: `"e.g., Acme Contractors"`
- address: `"e.g., 1234 Main St, Denver CO"`
- hauler name: `"e.g., Jane Smith"`
- email: `"e.g., jane@haulco.com"`
- phone: `"e.g., (303) 555-0150"`

## Multi-select assignments

For project → haulers and project → trucks, render toggleable cards with checkbox-like affordance. Track `selectedIds` array in local state. On step 3 (trucks), each selected truck gets a per-row select to assign it to one of the selected haulers (constrains the dropdown to `haulerIds`).

## Atomic submit + navigate

The Create handler does ONE `setDb` that touches every related collection, then navigates:

```js
const submit = () => {
  const id = effectiveCode; // for projects; for others, random suffix
  setDb(prev => appendActivity({
    ...prev,
    projects: [...prev.projects, { id, ...basics }],
    haulers: prev.haulers.map(h => haulerIds.includes(h.id) ? { ...h, projectIds: [...h.projectIds, id] } : h),
    trucks: prev.trucks.map(t => {
      const sel = trucks.find(s => s.truckId === t.id);
      return sel ? { ...t, projectId: id, haulerId: sel.haulerId } : t;
    }),
  }, { type: 'project.created', actorRole: 'admin', actorId: null, summary: `Admin created project ${basics.name}`, refId: id }));
  navigate('/admin/p/' + id);
};
```

Always compose the [[jse-activity-feed]] `appendActivity` call inside the same setDb so the event fires atomically with the mutation.

## The four wizards

| Wizard | Steps | Route | Notes |
|---|---|---|---|
| `AdminNewProject` | 4 — Basics / Haulers / Trucks / Review | `/admin/new` | Code field auto-fill + dup check |
| `AdminNewHauler` | 3 — Details / Project assignments / Review | `/admin/haulers/new` | Email regex `/.+@.+\..+/` |
| `AdminNewDriver` | 1 — Details only | `/admin/drivers/new` | Optional default-truck select from unassigned |
| `AdminNewTruck` | 3 — Details / Assignments / Review | `/admin/trucks/new` | Both project + hauler optional ("Leave unassigned" toggle) |

## Cross-refs

[[jse-design-system]] · [[jse-routing]] · [[jse-data-model]] · [[jse-activity-feed]] · [[jse-ship-a-feature]]
