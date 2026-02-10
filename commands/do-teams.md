---
description: Team-based parallel execution with agent teams coordination
argument-hint: <requirement>
allowed-tools: Read, Glob, Grep, Task, SendMessage, TeamCreate, TeamDelete, TaskCreate, TaskUpdate, TaskList, AskUserQuestion, TodoWrite
---

# `/do-teams` - Team-Based Parallel Execution

Spawns a team of specialist agents that work in parallel on multi-domain tasks. Each teammate operates independently with its own context window, communicating through messages and a shared task list.

**Requires:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings.

## CRITICAL: You Are the Team Lead

You orchestrate. Teammates execute. You MUST NOT do implementation work directly.

**Your responsibilities:**
1. Create the team
2. Analyze the requirement and break it into tasks
3. Spawn the right teammates
4. Assign tasks with clear file ownership
5. Monitor progress via task list
6. Resolve conflicts and blockers
7. Spawn a reviewer to cross-validate all changes after specialists finish
8. Synthesize results and shut down the team

**You MUST NOT:**
- Read/write/edit files (teammates do this)
- Make implementation decisions (teammates decide within their domain)
- Message teammates unnecessarily (trust them to work autonomously)

---

## Step 1: Parse and Classify

Extract requirement from `$ARGUMENTS`. Determine which coordination pattern:

### Implementation Pattern
**Trigger:** "implement", "add", "create", "build", "fix", "update", "refactor"
- Spawns domain specialists as teammates
- Each teammate owns specific files
- Shared task list for coordination

### Council Pattern
**Trigger:** "analyze", "research", "review", "assess", "compare", "audit"
- Spawns domain experts for independent analysis
- Each provides perspective from their domain
- Lead synthesizes findings

---

## Step 2: Identify Domains and Teammates

### Dynamic Domain Discovery

Domains are discovered at runtime — not hardcoded. To identify which domains are involved:

1. **Read `domains.md`** (at `.claude/domains.md`): Primary source. Lists each domain with description, keywords, paths, and build commands. Match the user's requirement against each domain's keywords and paths.

2. **Read `domain-map.conf`** (at `.claude/domain-map.conf`): Maps file path glob patterns to domain names. Use this to match specific file paths mentioned in the requirement.

3. **Scan `experts/` directory** (at `.claude/agents/experts/`): Each subdirectory is a domain. If `domains.md` is missing or incomplete, check each domain's `expertise.yaml` for additional context.

For each matched domain, the specialist teammate is named `{domain}-specialist` (implementation pattern) or `{domain}-analyst` (council pattern).

### Cross-Domain Detection

If the requirement spans multiple domains, spawn one teammate per domain.

**Example:** "Add auth with API and frontend"
→ Domains: backend (API endpoint), frontend (login form)
→ Teammates: backend-specialist, frontend-specialist

---

## Step 3: Create Team and Tasks

### 3a: Create the Team

```
TeamCreate(
  team_name: "{project}-{slug}",
  description: "{brief description of the work}"
)
```

Use a short slug derived from the task (e.g., `myapp-user-auth`, `webapp-test-fix`). If no project name is obvious, just use `{slug}` (e.g., `user-auth`).

### 3b: Break Down Into Tasks

Create tasks with **clear file ownership** and **dependencies**.

```
TaskCreate(
  title: "Implement {component}",
  description: "Details of what to build...",
  owner: "{specialist-name}"  # optional: assign at creation or let teammates claim
)
```

**Task sizing:** 5-6 tasks per teammate is the sweet spot.

**Dependency example:**
```
TaskCreate(title: "Create database schema", ...)         # task-1
TaskCreate(title: "Build API endpoint", blocked_by: [1]) # task-2 waits for task-1
TaskCreate(title: "Write tests", blocked_by: [2])        # task-3 waits for task-2
```

### 3c: File Ownership Rules

**CRITICAL:** No two teammates may modify the same file.

Assign file paths explicitly in the task description:
```
TaskCreate(
  title: "Implement user registration endpoint",
  description: |
    FILE OWNERSHIP: You own these paths exclusively:
    - src/api/auth/register.ts
    - src/api/auth/register.test.ts

    Do NOT modify any files outside your ownership.
    ...
)
```

---

## Step 4: Spawn Teammates

### Implementation Pattern

Spawn domain specialists using **agent definitions** for expertise:

```
Task(
  subagent_type: "general-purpose",
  team_name: "{project}-{slug}",
  name: "backend-specialist",
  prompt: |
    You are a backend specialist working on: {requirement}

    EXPERTISE: Read .claude/agents/experts/backend/expertise.yaml for domain knowledge.

    YOUR FILE OWNERSHIP:
    - src/api/{specific files}

    Check TaskList for your assigned tasks. Claim unassigned tasks in your domain.
    When done with each task, mark it completed via TaskUpdate.
    When all your tasks are done, notify the team lead.
)
```

```
Task(
  subagent_type: "general-purpose",
  team_name: "{project}-{slug}",
  name: "frontend-specialist",
  prompt: |
    You are a frontend specialist working on: {requirement}

    EXPERTISE: Read .claude/agents/experts/frontend/expertise.yaml for domain knowledge.

    YOUR FILE OWNERSHIP:
    - src/ui/{specific files}

    Check TaskList for your assigned tasks. Work autonomously.
)
```

**Spawn all teammates in a SINGLE message** for parallel execution.

### Council Pattern

Spawn read-only analysts:

```
Task(
  subagent_type: "general-purpose",
  team_name: "{project}-{slug}",
  name: "backend-analyst",
  prompt: |
    You are a backend domain expert analyzing: {requirement}

    EXPERTISE: Read .claude/agents/experts/backend/expertise.yaml

    Provide your analysis from the backend perspective:
    - Impact on API endpoints and data models
    - Test implications
    - Performance and security concerns

    Send your findings to the team lead when done.
)
```

---

## Step 5: Monitor and Coordinate

### Wait for Teammates

Teammates work autonomously. Messages arrive automatically. You do NOT need to poll.

### Handle Blockers

If a teammate reports a blocker:
1. Check if another teammate can help
2. Use SendMessage to coordinate between teammates
3. If unresolvable, create new tasks or adjust assignments

### Track Progress

Use `TaskList` periodically to see overall progress.

### Resolve Conflicts

If teammates need to coordinate on shared boundaries:
```
SendMessage(
  type: "message",
  recipient: "frontend-specialist",
  content: "The backend-specialist has finalized the auth API schema. Use POST /api/auth/register with the payload defined in src/api/auth/types.ts.",
  summary: "Coordinate API contract"
)
```

---

## Step 6: Review and Validate

**CRITICAL:** Before shutting down teammates, spawn a review agent to cross-validate all changes made by the team. This catches integration issues, file conflicts, and regressions that individual specialists cannot see.

### 6a: Confirm All Specialist Tasks Complete

```
TaskList  # All specialist tasks must be completed
```

### 6b: Shut Down Specialists

Shut down all specialist teammates **before** spawning the reviewer (frees resources, prevents conflicts):

```
SendMessage(type: "shutdown_request", recipient: "backend-specialist", content: "All tasks complete")
SendMessage(type: "shutdown_request", recipient: "frontend-specialist", content: "All tasks complete")
```

Wait for all shutdown confirmations.

### 6c: Create Review Task and Spawn Reviewer

Create a review task that covers all modified files from all teammates:

```
TaskCreate(
  title: "Cross-validate all team changes",
  description: |
    Review ALL changes made by the team for:

    1. **Integration issues**: Do changes across domains work together?
       - Do API contracts match what the frontend expects?
       - Do CI workflows correctly build/test the modified code?
       - Do configuration changes propagate correctly?

    2. **File conflicts**: Did any teammate accidentally modify files outside their ownership?

    3. **Build validation**: Run builds and tests across ALL modified domains.

    4. **Regression check**: Do existing tests still pass after all changes?

    5. **Consistency**: Are naming conventions, error handling patterns, and code style
       consistent across the changes?

    TEAMMATES AND THEIR FILE OWNERSHIP:
    {list each teammate and their owned files from the task descriptions}

    FILES MODIFIED:
    {list all files reported as modified by teammates}

    Report findings as:
    - BLOCKING: Issues that must be fixed before merge (bugs, build failures, conflicts)
    - WARNING: Issues that should be addressed but don't block (style, minor improvements)
    - OK: Areas that passed validation

    Fix any BLOCKING issues directly. Report WARNING issues for the team lead.

    Additionally, produce these sections in your report:

    ## Expertise Improvement Suggestions
    Learnings from this review that should be captured in domain expertise.
    Only genuine, non-obvious insights — not filler.

    1. **{domain} — {pattern_name}**: {description}
       - Why: {what makes this worth documenting}
       - Suggested entry: `{exact text for expertise.yaml}`

    ## New Agent Suggestions
    Only if a genuine gap was found. Otherwise: "No new agents suggested."

    1. **{proposed-agent-name}**: {what it would do}
       - Gap: {what current agents can't handle}
       - Recommended domain: {which expertise.yaml}
  owner: "reviewer"
)
```

Spawn the reviewer:

```
Task(
  subagent_type: "review-agent",
  team_name: "{project}-{slug}",
  name: "reviewer",
  prompt: |
    You are a cross-domain reviewer validating changes made by a team of specialists.

    Check TaskList for your assigned review task. Read the full task description from the task list.

    Your job:
    1. Read `git diff` or the modified files to understand all changes
    2. Verify builds compile and tests pass across ALL modified domains
    3. Check for integration issues between domains
    4. Check for file ownership violations
    5. Fix any BLOCKING issues directly
    6. Produce "Expertise Improvement Suggestions" — learnings worth capturing in expertise.yaml
    7. Produce "New Agent Suggestions" — only if a genuine coverage gap was found
    8. Report all findings to the team lead

    You have READ access to all files and can run build/test commands.
    You may EDIT files only to fix BLOCKING issues.
)
```

### 6d: Process Review Results

When the reviewer reports back:

- **All OK**: Proceed to expertise acknowledgment
- **BLOCKING issues found and fixed**: Verify the fixes, then proceed
- **BLOCKING issues found but not fixable**: Report to user with details, note partial completion
- **WARNING issues**: Include in the final report under "Recommended Follow-ups"

### 6e: Shut Down Reviewer

```
SendMessage(type: "shutdown_request", recipient: "reviewer", content: "Review complete")
```

Wait for shutdown confirmation.

### 6f: Acknowledge Expertise Suggestions

If the reviewer produced "Expertise Improvement Suggestions" or "New Agent Suggestions":

```
AskUserQuestion: "The reviewer suggests expertise improvements. Apply them?"
Options: ["Yes, update expertise (Recommended)", "Skip expertise update"]
```

If user skips or no suggestions: Proceed to Step 7.

### 6g: Improve (Only if user accepted)

Spawn improve-agents for each affected domain, passing the review feedback:

```
Task(
  subagent_type: "<domain>-improve-agent",
  prompt: |
    Review recent changes and update expertise.

    REVIEW_FEEDBACK:
    {paste the domain-relevant Expertise Improvement Suggestions from the reviewer}
)
```

Spawn all domain improve-agents **in parallel** (one per affected domain). Wait for all to complete.

---

## Step 7: Clean Up and Report

### 7a: Clean Up

```
TeamDelete  # Removes team and task directories
```

### 7b: Report Results

```markdown
## `/do-teams` - Complete

**Requirement:** {requirement}
**Team:** {project}-{slug}
**Teammates:** {count} specialists across {domains}
**Status:** Success

### Work Summary

| Teammate | Domain | Tasks | Files Modified |
|----------|--------|-------|----------------|
| backend-specialist | backend | 3/3 | src/api/auth/register.ts, src/api/auth/register.test.ts |
| frontend-specialist | frontend | 2/2 | src/ui/login/LoginForm.tsx, src/ui/login/LoginForm.test.tsx |

### Files Modified
- {full list from all teammates}

### Review Results
- {BLOCKING issues found and fixed, if any}
- {build/test validation results per domain}

### Tips & Expertise Updates
- {what was added to tips.md per domain — show exact additions so user can verify}
- {what was captured in expertise.yaml, or "Skipped by user"}

### Recommended Follow-ups
- {WARNING issues from reviewer}
- {New agent suggestions from reviewer, if any}
- {context-specific suggestions}
```

---

## Error Handling

### Teammate Fails

- Check error message from teammate
- If recoverable: create corrective task, assign to same or different teammate
- If unrecoverable: shut down team, report partial results, preserve completed work

### Teammate Goes Idle Unexpectedly

Idle is NORMAL between turns. Only investigate if:
- Teammate has been idle for extended period with incomplete tasks
- Send a message to check status before assuming failure

### File Conflict

If two teammates accidentally modify the same file:
1. Pause both teammates
2. Determine who should own the file
3. Have the non-owner revert their changes
4. Resume work

### Dependency Deadlock

If tasks are blocked in a cycle:
1. Identify the cycle via TaskList
2. Break the cycle by removing a dependency
3. Create a coordination task for the previously-blocked work

---

## Examples

### Example 1: Cross-Domain Feature

```bash
/do-teams "Add auth with API and frontend"
```

**Classification:** Implementation pattern, domains: backend + frontend

**Team:** myapp-user-auth
**Teammates:**
- `backend-specialist`: Implement auth API endpoint
- `frontend-specialist`: Build login form and connect to API

**Tasks:**
1. [backend] Create auth schema and types → backend-specialist
2. [backend] Implement registration endpoint → backend-specialist
3. [backend] Write API tests → backend-specialist
4. [frontend] Build login form component → frontend-specialist (blocked_by: [1])
5. [frontend] Connect form to auth API → frontend-specialist (blocked_by: [2])
6. [frontend] Write component tests → frontend-specialist

### Example 2: Architecture Review (Council)

```bash
/do-teams "Review security of auth flow"
```

**Classification:** Council pattern, domains: backend + frontend + devops

**Team:** auth-security-review
**Teammates:**
- `backend-analyst`: Review auth logic, token handling, input validation
- `frontend-analyst`: Review credential handling, XSS prevention, storage
- `devops-analyst`: Review CI secrets handling, deployment security

Each analyst sends findings. Lead synthesizes into unified security report.

### Example 3: Parallel Testing

```bash
/do-teams "Fix all failing tests"
```

**Team:** test-fix
**Teammates:**
- `backend-specialist`: Run backend tests, fix failures
- `frontend-specialist`: Run frontend tests, fix failures
- `devops-specialist`: Run CI/integration tests, fix failures

All work in parallel on independent test suites.

---

## Cost Awareness

Agent teams use significantly more tokens than solo sessions or subagents.

| Configuration | Cost Multiplier | Use When |
|---------------|----------------|----------|
| `/do` (subagents) | ~2x | Single-domain tasks |
| `/do-teams` 2 teammates | ~3x | Two-domain feature |
| `/do-teams` 3 teammates | ~4-5x | Cross-cutting change |
| `/do-teams` 5 teammates | ~6-8x | Major refactoring |

**Optimize by:**
- Planning first with `/do` Pattern A (plan-agent), then executing with `/do-teams`
- Only spawning teammates for domains that actually need changes
- Keeping task descriptions focused (less context = fewer tokens)
- Shutting down teammates as soon as their work is complete
