---
name: builder-reviewer-flow
description: >-
  Orchestrates the two-agent development lifecycle: Builder Agent plans, writes boundary unit tests (lower/upper/in-bound), implements code, verifies green tests, and invokes the Reviewer Agent to evaluate performance, simplicity, and cross-component impact.
---

# Builder & Reviewer Agent Workflow

This skill guides the invocation and orchestration of the **Builder Agent** and **Reviewer Agent** for high-reliability, test-driven feature development and bug fixes.

---

## Architecture Flow

```mermaid
flowchart TD
    User["User Prompt / Feature Request"] --> Builder["Builder Agent"]
    
    subgraph BuilderPhase ["Builder Agent Lifecycle"]
        Plan["1. Requirements Analysis & Boundary Partitioning"]
        Tests["2. Write Unit Tests (Lower, Upper, In-Bound)"]
        Code["3. Implement Code"]
        RunTests["4. Run Unit Tests (100% Pass)"]
        
        Plan --> Tests --> Code --> RunTests
    end
    
    Builder --> Plan
    RunTests --> Handoff["Invoke Reviewer Subagent"]
    
    subgraph ReviewerPhase ["Reviewer Agent Lifecycle"]
        Review["Review Code & Diffs"]
        Perf["Performance & Complexity"]
        Clean["Clean Code & Simplicity"]
        Regression["Cross-Component Impact & Regressions"]
        Coverage["Boundary Test Completeness"]
        
        Review --> Perf
        Review --> Clean
        Review --> Regression
        Review --> Coverage
    end
    
    Handoff --> Review
    Perf & Clean & Regression & Coverage --> Verdict{"Verdict"}
    
    Verdict -- "Changes Requested" --> Refactor["Builder Refactors & Re-runs Tests"]
    Refactor --> RunTests
    Verdict -- "Approved" --> Complete["Finalize & Deliver"]
```

---

## How to Invoke the Agents

### 1. Involving the Builder Agent
When a feature, fix, or refactor is requested:
```typescript
invoke_subagent({
  Subagents: [{
    TypeName: "builder",
    Role: "Test-Driven Builder",
    Prompt: "Implement <feature/fix description> with comprehensive boundary unit tests."
  }]
});
```

### 2. Builder Invokes Reviewer
Once tests pass, the Builder Agent calls:
```typescript
invoke_subagent({
  Subagents: [{
    TypeName: "reviewer",
    Role: "Code Quality & Performance Reviewer",
    Prompt: "Review the code changes in <files> against performance, simplicity, and regression risks."
  }]
});
```
