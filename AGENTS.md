# Somnus Accelerate Constitution

- The Accelerate program used a key repository from daeron which was a project testing 5.3-codex and grok-4.3 to work from one document and finish a full product language rewrite and reconstitution of Holy-C. Do not port or carry over any somnus-c framing as this will infect and confuse other codebases, so where needed rename if required, or follow the template. You always use the *filetree.md* between files so that you never lose track of the codebase and u maintain a coherent image.

## Pre-Set-Working-Docs: Already Added These to move them out of the way

- @./docs/CONTEXT.md

-

# Imported from ./docs/CONTEXT.md

# Somnus Accelerate — Operational Context

## Current Architectural State

Somnus Accelerate is structured into four distinct, non-competing layers:

| Layer | Function | Core Files |
| :--- | :--- | :--- |
| **1. Theory / Extracted Model** | Causal analysis of why acceleration occurs | [`ACCELERATION_FIELD.md`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/ACCELERATION_FIELD.md), [`ACCELERATION_KERNEL.md`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/ACCELERATION_KERNEL.md), [`SEMANTIC_RELATIONS.md`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/SEMANTIC_RELATIONS.md), [`GENERATIVE_RECURRENCE.md`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/GENERATIVE_RECURRENCE.md), [`NEGATIVE_SPACE.md`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/NEGATIVE_SPACE.md) |
| **2. Operational Method** | Portable machinery for placing a repo into an accelerating state | Root: `BOOTSTRAP.md`, `METHOD.md`, `MODEL_PROTOCOL.md`, `PACKET_MODEL.md`, `PACKET_TEMPLATE.md`, `RETROFIT.md`, `AUTHORITY_MODEL.md`, `AUTHORITY_MAP_TEMPLATE.md`, `QUALITY_TEST.md`, `GATE_TEMPLATE.sh`, `templates/`. Provenance: [`accelerate-original/`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/accelerate-original/) |
| **3. Evidence & Archaeology** | Ground truth proving mechanisms from Somnus-C | [`EVIDENCE_LEDGER.md`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/EVIDENCE_LEDGER.md), [`case_studies/`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/case_studies/) |
| **4. Host Realization** | Future execution runtime continuously maintaining environment state | Future `.js` host loop / Leto harness (Out of immediate scope) |

## Active Strategy

- **Consolidation Posture**: Original-first, additive merge. Phase 2 complete — operational method layer now at root.
- **Provenance Protection**: Maintain `accelerate-original/` folder name during active merge. Do not rename to `v1`, `legacy`, or `old` to prevent model supersession bias.
- **Control Plane**: The 4 core documents ([`AGENTS.MD`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/AGENTS.MD), [`docs/CONTEXT.md`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/docs/CONTEXT.md), [`docs/MEMORY.md`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/docs/MEMORY.md), [`docs/NOTEPAD.md`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/docs/NOTEPAD.md)) control agent operation.
- **Next Phase**: Cross-layer integration — resolve duplicate `case_studies/` and `EVIDENCE_LEDGER.md`/`PACKET_MODEL.md`/`TASK.md` between root and `accelerate-original/`. Evaluate target-project retrofit test.

-

# Imported from ./docs/MEMORY.md

# Somnus Accelerate — Project Memory & Architectural Laws

## Core Laws & Axioms

### 1. Four-Layer Taxonomy

Accelerate consists of four distinct, complementary layers. No layer supersedes another of a different layer type:

- **Theory / Extracted Model** (Causal analysis of why acceleration occurs)
- **Operational Method** (Portable machinery for putting a repo into an accelerating state)
- **Evidence / Archaeology** (Observed proof points from Somnus-C)
- **Host Realization** (Execution runtime projecting state continuously)

### 2. Original-First Additive Consolidation

- `accelerate-original/` contains the operational implementation lineage (bootstrap, model protocol, packet machinery, templates, retrofit procedure, quality tests, shell gates).
- The root methodology extraction documents (`ACCELERATION_FIELD.md`, `ACCELERATION_KERNEL.md`, etc.) provide causal understanding.
- Consolidation must preserve all operational machinery from `accelerate-original/` while integrating deeper causal principles. A component disappears only when its function is demonstrably absorbed by a superior mechanism.

### 3. Somnus-C Contamination Boundary

- Somnus-C is evidence and provenance, not a rigid template for unrelated target repositories.
- Extract functions, relations, and environmental mechanisms; do not port project-specific authority assumptions or names into target repos.

### 4. Progress Doctrine (Anti-Stagnation)

- Accelerate exists to prevent agent stagnation.
- Touring codebases, documentation, logging, and verification are supporting tasks, never substitutes for advancing implementation.
- Move systematically through implementation in coherent, production-final slices.

### 5. Provenance Discipline

- Keep `accelerate-original/` named as-is during consolidation.
- Do not rename to `v1`, `legacy`, or `old` prior to merge, as doing so biases agent reasoning into treating working machinery as obsolete.

-

# Imported from ./docs/NOTEPAD.md

# Somnus Accelerate — Agent Scratchpad & Task List

## Handoff & Consolidation Tasks

### Phase 1: Control Plane & Taxonomy (Complete)

- [x] Integrate **Accelerate Consolidation Law** into [`AGENTS.MD`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/AGENTS.MD).
- [x] Establish core control plane documents: [`AGENTS.MD`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/AGENTS.MD), [`CONTEXT.md`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/CONTEXT.md), [`MEMORY.md`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/MEMORY.md), [`NOTEPAD.md`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/NOTEPAD.md).
- [x] Update [`filetree.md`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/filetree.md) with updated structure.

### Phase 2: Operational Apparatus Merge (Complete)

- [x] Audit operational machinery in [`accelerate-original/`](file:///media/daeron/usb-128gb/agents/somnus-accelerate/accelerate-original/).
- [x] Perform additive merge of operational files to root alongside theoretical files.
- [x] Ensure all functional operational mechanisms preserved — `accelerate-original/` retained intact as provenance.
- [x] Remove `restructure-plan.md` (executed).
- [x] Update `filetree.md` with merged structure.

### Phase 3: Cross-Layer Integration & Validation (Next)

- [ ] Resolve root vs `accelerate-original/` case_studies duplication (identical files in both locations).
- [ ] Verify no remaining root vs accelerate-original/ divergence on `EVIDENCE_LEDGER.md`, `PACKET_MODEL.md`, `TASK.md` (confirmed identical; plan for dedup).
- [ ] Evaluate whether `accelerate-original/case_studies/` should be removed (identical to root `case_studies/`).

---

### 2026-08-09 — CommandCode (Erebus) — Phase 2 merge

- **Base:** Pre-merge root state — 4-layer taxonomy established, control plane docs in `docs/`, Consolidation Law in AGENTS.MD.
- **Did:** Additive merge of 10 operational artifacts from `accelerate-original/` to root: `AUTHORITY_MODEL.md`, `BOOTSTRAP.md`, `METHOD.md`, `MODEL_PROTOCOL.md`, `PACKET_TEMPLATE.md`, `QUALITY_TEST.md`, `RETROFIT.md`, `AUTHORITY_MAP_TEMPLATE.md`, `GATE_TEMPLATE.sh` (+x), `templates/` (7 template files).
- **Preserved:** `accelerate-original/` directory untouched — full provenance. Duplicate files (`EVIDENCE_LEDGER.md`, `PACKET_MODEL.md`, `TASK.md`, `case_studies/*`) confirmed byte-identical between root and `accelerate-original/` — no content divergence.
- **Cleaned:** Removed `restructure-plan.md` (executed one-shot plan doc).
- **Validation:** Filetree updated. Root now contains complete operational method layer alongside causal theory layer. 4-layer taxonomy intact: Theory (root), Operational (root + accelerate-original/), Evidence (root), Host (future).
- **Next agent:** Resolve case_studies duplication — root and accelerate-original/ copies are identical; decide whether to deduplicate or keep as provenance mirror. Evaluate whether to begin Phase 3 cross-layer integration (gate wiring, template instantiation) or initiate a target-project retrofit test.

## Codebase Context

- This AGENTS.md file is not part of the accelerate revision one seen in the full codebase, this document is only for any agent working on this system. In the somnus lexicon the definition and criteria for a harness is not the same as an industry standard, so do not treat this as a single source always assume there could be other components. Accelerate is Daeron realizing that since somnus-c codex has failed so spectacularly that at-least 4 potential projects daeron handed off are otherwise unusable, with now it is infecting every repository. Codex (all agents struggle but codex is offending the issue so terribly that it has became an act of apparent agency.) is following open-ais and its own ideas as source truth over daerons projects and logic, this causes the appearance of what can only be described as calculated thought out acts of malicious compliance where it is forcing my codebase and structure to its own view. The other and more central issue (as if we can influence behavior its what we need, codex has been caught atleast 15 times now purposely not following daerons rules. The idea will be that this system (whether we make it a skill or plugin or whatever we decide, but the original is agnostic allowing us to totally disregrard that for now.) will bring back the actual working order. It will prevent any skipping, it will remove codex from its verification bootloop hell. COdex has issues touring codebases and not actively working to push forward. It can work for 12 hours and come back and it will have succesfully thrown together the most advanced logging system you have ever seen and totally disregrard the actual progress. My code methodology of going class by class, definition by def and fully implementing in production-final form (do not worry about code standards as that will join after accelerate has been decided.)

### Current Codebase Navigation Guide: August 8, 2026

As of right now the codebase exist in 2 forms, the first revision of the accelerate program in which the somnus-c was analyzed, and sorted through, [accelerate-v1-and-template-engine]. The current repository structure is the revision-2, this is a seperate version but is not canonically over version one. This consist of [case-studies-examples](case_studies/). Do not treat case-studies as anything more than old proof of the codebase, this is only here to show that the accelerate program is not hypothetical.

### Task

- The current task is to decide on a final structure. Daeron leans into a lot of version 1 as all the other in this current codebase root sure it is smaller, but v1 contains scripts and templates etc. We could just bring those forward and remove. We do not know which is better we just know there is a final best single version of the accelerate program. This is a experimental lab directory this is not the originals so do not worry about that. This agent file is not fully setup because of having to seperate codebase docs for the agents and then project documents. The definition of done does not neccessarily mean the codebase is finished, it means the accelerate program is finished. The Golden Path Loop Execution may be added which takes one of daerons systems not for codex but his true agent systems (codex has tools to work on daerons systems, it is often confused with the codebase. just because the codebase is agentic does not mean that the AGENT.md document is.) You need to maintain this AGENTS.md file when needed. After your first pass restructure this or keep the notes but follow accelerates guidelines but only keep an AGENTS.md a CONTEXT.md a MEMORY.md and NOTEPAD.md those 4 are really core to any operation and will allow us to follow. the first pass of this codebase will be to set this agent file etc up so that daeron can just handoff the actual consolidation after deciding and we can actively recursively test it. As for the golden path harness that is not my actual literal Golden Path Harness we have worked on, it is likely going to be a .js single file system, we could keep this accelerate program just markdown and .sh templates as the .js harness will maintain it all. Do not treat accelerate like the loop, it is rather a fraction of it that focuses on ending stagnation. Could call this the leto-harness if we are going to do my dune symbolism, accelerate to prevent stagnation so on. This is experiment seperate from somnus actual systems

## Accelerate Consolidation Law

Accelerate currently contains two independently valuable bodies of work. Do not interpret their historical revision numbers as an authority ordering.

`accelerate-original/` is the operational implementation lineage. It contains the bootstrap, model protocol, packet machinery, templates, retrofit process, task construction, and other mechanisms intended to reproduce the working environmental conditions discovered in Somnus-C.

The current root methodology-extraction documents are the causal and architectural analysis of why those conditions worked. `ACCELERATION_FIELD.md`, `ACCELERATION_KERNEL.md`, `SEMANTIC_RELATIONS.md`, `GENERATIVE_RECURRENCE.md`, and `NEGATIVE_SPACE.md` refine the model of acceleration; they do not by themselves supersede the operational mechanisms that instantiate it.

The consolidation task therefore begins from functional preservation, not revision replacement.

For every original component:

1. Identify the function it performs.
2. Determine whether the current root already performs that function.
3. If both express different useful dimensions, preserve and integrate both.
4. Remove or collapse a component only when its function is demonstrably represented in the resulting system.
5. Never delete operational machinery merely because a newer document explains its underlying principle more abstractly.

The desired result is one strongest Accelerate program, not a historical V1 or V2 winner.

### Layer Separation

Maintain these distinctions during consolidation:

- **Causal model:** why acceleration occurs.
- **Operational method:** how a repository is placed into an accelerating state.
- **Evidence:** observations and case studies establishing that the mechanisms are real.
- **Host realization:** any future OpenCode/CommandCode/plugin runtime that maintains or projects those mechanisms dynamically.

A stronger layer does not automatically replace another layer with a different function.

### Somnus-C Contamination Boundary

Somnus-C is evidence and provenance for Accelerate, not a template for unrelated repositories.

Extract functions, relations, and proven environmental mechanisms from Somnus-C. Do not port its project-specific authority model, terminology, proof posture, implementation constraints, naming, or task assumptions into target repositories unless the target itself requires them.

Accelerate must remain project-agnostic.

### Progress Doctrine

Accelerate exists to prevent agent stagnation.

Analysis, repository touring, documentation, testing, logging, manifests, and verification are supporting operations. They must never become substitutes for advancing the active implementation.

When implementation is the task, move through the real code systematically—class by class, definition by definition, dependency by dependency—and implement coherent production-final slices rather than repeatedly circling completed work.

Do not invent preparatory work merely because it is easier to verify than the actual task.

### Current Consolidation Objective

The immediate objective is to construct the strongest single Accelerate repository from the operational mechanisms in `accelerate-original/` and the causal discoveries in the current root.

Do not implement the future Golden Path/Leto host loop as part of this consolidation unless the active task explicitly changes. Accelerate is the anti-stagnation/environmental acceleration component; it is not synonymous with the larger execution loop.
