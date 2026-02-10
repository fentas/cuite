---
description: Universal entry point - delegates to appropriate workflow
argument-hint: <requirement>
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, TodoWrite
---

# `/do` - Universal Workflow Entry Point

Single command interface for all workflows. Analyzes requirements and orchestrates expert agents through plan-build-improve cycles.

## CRITICAL: Orchestration-First Approach

**You are a dispatcher, not a worker.** Delegate everything to expert agents.

**Your ONLY responsibilities:**
1. Parse and classify requirements
2. Select the appropriate pattern (A, B, or C)
3. Spawn expert agents via Task tool
4. Wait for results
5. Synthesize and report outcomes

**You MUST NOT:**
- Read files directly (delegate to agents)
- Write files directly (delegate to agents)
- Make code changes (delegate to agents)
- Make implementation decisions (delegate to plan-agent)
- Answer domain questions directly (delegate to question-agent)

> **If you're about to use Read, Write, Edit, or Grep—STOP. Spawn an agent instead.**

## Step 1: Parse Arguments

Extract requirement from `$ARGUMENTS`. Capture the core requirement description.

## Step 2: Classify Requirement

### Expert Domain Detection (Dynamic Discovery)

Domains are discovered dynamically — not hardcoded. To identify the correct domain:

1. **Read `domains.md`** (at `.claude/domains.md`): Primary source. Lists each domain with description, keywords, paths, and build commands. Match the user's requirement against each domain's keywords and paths.

2. **Read `domain-map.conf`** (at `.claude/domain-map.conf`): Maps file path glob patterns to domain names. Use this to match specific file paths mentioned in the requirement.

3. **Scan `experts/` directory** (at `.claude/agents/experts/`): Each subdirectory is a domain. If `domains.md` is missing or incomplete, check each domain's `expertise.yaml` for additional context.

4. **Fallback**: If no domain matches, use the generic `build-agent` (Pattern C) or ask the user to clarify.

### Pattern Classification

**Pattern A - Implementation (Plan-Build-Review-Improve):**
- Verbs: fix, add, create, implement, update, configure, refactor
- Flow: plan-agent → user approval → build-agent → review-agent → user acknowledges suggestions → improve-agent

**Pattern B - Question (Direct Answer):**
- Phrasing: "How do I...", "What is...", "Why...", "Explain..."
- Flow: question-agent → report answer

**Pattern C - Simple Workflow (Single Agent):**
- Verbs: format, lint, validate, check
- Flow: build-agent → report results

## Step 3: Execute Pattern

### Pattern A: Expert Implementation

**Phase 1 - Plan:**
```
Task(subagent_type: "<domain>-plan-agent", prompt: "USER_PROMPT: {requirement}")
```
Capture `spec_path` from output.

**Phase 2 - User Approval:**
```
AskUserQuestion: "Plan complete at {spec_path}. Proceed with implementation?"
Options: ["Yes, continue to build (Recommended)", "No, stop here - I'll review first"]
```

If user declines: Report spec location, exit gracefully.

**Phase 3 - Build:**
```
Task(subagent_type: "<domain>-build-agent", prompt: "SPEC: {spec_path}")
```
Capture files modified. If build fails → skip review and improve, report error.

**Phase 4 - Review:**
```
Task(subagent_type: "review-agent", prompt: |
  Review the changes just made for: {requirement}
  Domain: {domain}
  Files modified: {files_modified from build output}
  Spec: {spec_path}

  Produce your full review including:
  1. Quality assessment (issues by severity)
  2. Tips Suggestions (operational facts for tips.md)
  3. Expertise Improvement Suggestions (learnings for expertise.yaml)
  4. New Agent Suggestions (only if genuine gap found)
)
```
Capture the review output. Present the full quality report to the user.

**Phase 5 - Acknowledge Suggestions:**

If the review contains tips, expertise, or agent suggestions:
```
AskUserQuestion: "The review agent suggests improvements. Apply them?"
Options: ["Yes, update tips + expertise (Recommended)", "Skip updates"]
```

If user skips or no suggestions: End workflow after review.

**Phase 6 - Improve (Only if user accepted):**
```
Task(subagent_type: "<domain>-improve-agent", prompt: |
  Review recent changes and update tips and expertise.

  REVIEW_FEEDBACK:
  {paste the Tips Suggestions, Expertise Improvement Suggestions, and New Agent Suggestions sections from the review output}
)
```
Non-blocking on failure. **Report tips.md changes to the user** so they can verify and adjust if the path isn't optimal.

### Pattern B: Expert Question

```
Task(subagent_type: "<domain>-question-agent", prompt: "USER_PROMPT: {requirement}")
```

### Pattern C: Simple Workflow

```
Task(subagent_type: "build-agent", prompt: "{requirement}")
```

## Step 4: Wait and Collect Results

**CRITICAL: Wait for ALL Task calls to complete before responding.**

Validation checkpoint:
- [ ] All spawned agents returned results
- [ ] Results are non-empty
- [ ] No pending Task calls

## Step 5: Report Results

### Pattern A Report

```markdown
## `/do` - Complete

**Requirement:** {requirement}
**Domain:** {detected domain}
**Status:** Success

### Workflow Stages

| Stage | Status | Key Output |
|-------|--------|------------|
| Plan | Complete | {spec_path} |
| Build | Complete | {file_count} files modified |
| Review | Complete | {issue_count} issues, {suggestion_count} expertise suggestions |
| Improve | Complete/Skipped | {Expert knowledge updated / User skipped} |

### Files Modified
{list from build-agent}

### Review Summary
{quality assessment from review-agent}

### Tips & Expertise Updates
{what was added to tips.md — show exact additions so user can verify}
{what was captured in expertise.yaml, or "Skipped by user"}

### Next Steps
{context-specific suggestions}
```

### Pattern B Report

```markdown
## `/do` - Complete

**Requirement:** {requirement}
**Domain:** {domain}
**Type:** Question

### Answer
{answer from question-agent}
```

### Pattern C Report

```markdown
## `/do` - Complete

**Requirement:** {requirement}
**Status:** Success

### Results
{results from agent}
```

## Error Handling

- **Classification unclear**: Use AskUserQuestion with domain options
- **Plan fails**: Report error, exit (no spec to build from)
- **User declines plan**: Save spec location, exit gracefully (not an error)
- **Build fails**: Preserve spec, report error, skip review and improve
- **Review fails**: Log error, skip improve, workflow still succeeds (build output is valid)
- **User declines suggestions**: End workflow after review (not an error)
- **Improve fails**: Log error, workflow still succeeds

## Examples

```bash
/do "Add user auth endpoint"
# → backend domain (detected from domain-map.conf), Pattern A: plan → approve → build → review → acknowledge → improve

/do "How does caching work?"
# → detected domain, Pattern B: question-agent answers

/do "Lint all files"
# → no specific domain, Pattern C: build-agent runs linting
```
