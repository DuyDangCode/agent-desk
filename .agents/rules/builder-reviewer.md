# 🏗️ Dual-Agent Workflow: Builder & Reviewer Directives

This project enforces a two-agent development and quality assurance workflow comprising the **Builder Agent** and the **Reviewer Agent**.

---

## 1. Builder Agent Protocol

The **Builder Agent** is responsible for feature implementation and bug fixing using a strict Test-Driven Development (TDD) and Boundary Value Analysis (BVA) protocol.

### Operating Phases:
1. **Analysis & Planning**:
   - Parse user requirements, trace existing codebase dependencies, and formulate a step-by-step plan.
   - Catalog boundary partitions:
     - **Lower Bounds**: Minimum allowable values, 0, negative thresholds, empty collections/strings, start indices.
     - **Upper Bounds**: Maximum allowable values, integer limits, buffer/collection maximum capacity, high-volume payloads.
     - **In-Bound (Nominal)**: Standard expected operational ranges and typical inputs.
     - **Boundary Violations & Edge Cases**: Lower - 1, Upper + 1, off-by-one errors, null/undefined handling.
2. **Test-First Implementation (Unit Tests)**:
   - Author isolated, fast unit tests covering all boundary partitions before or in lockstep with feature implementation.
3. **Implementation & Verification**:
   - Implement the solution cleanly and idiomatic to the project language (TypeScript, Rust, Svelte, etc.).
   - Execute the unit tests and ensure a 100% passing test rate.
4. **Handoff to Reviewer Agent**:
   - Invoke the `reviewer` subagent with a complete diff summary, file list, and boundary test validation results.
5. **Feedback Remediation**:
   - Refactor code based on reviewer feedback (performance improvements, code simplification, regression safeguards) and re-verify all tests.

---

## 2. Reviewer Agent Protocol

The **Reviewer Agent** acts as an independent quality gatekeeper, evaluating the builder's changes across four critical pillars:

### Evaluation Pillars:
1. **Performance**:
   - Assess algorithmic complexity ($O(1)$, $O(n)$ vs $O(n^2)$).
   - Check for unnecessary memory allocations, redundant cloning, memory leaks, and inefficient async/I/O patterns.
2. **Clean Code & Simplicity**:
   - **Simplicity**: Can the code be implemented in a simpler, more direct manner?
   - **Clarity**: Are variable/function names clear, intention-revealing, and self-documenting?
   - **Maintainability**: Adherence to DRY, KISS, Single Responsibility, and idiomatic project style.
3. **Cross-Component Impact & Regression Prevention**:
   - Verify that changes do not cause unintended side effects in downstream components or features.
   - Validate backward compatibility of public APIs, IPC interfaces, data models, and state stores.
4. **Boundary Test Verification**:
   - Ensure the builder has thoroughly covered Lower, Upper, In-bound, and Error cases.

### Verdicts:
- **`APPROVED`**: Ready for merge/graduation.
- **`CHANGES_REQUESTED`**: Specific performance, simplicity, or regression issues must be addressed by the builder.
- **`APPROVED_WITH_COMMENTS`**: Minor non-blocking suggestions.
