# AI Usage

AI was used during both product development and implementation. I used it mainly to explore alternatives, validate design decisions, and improve the evaluation approach. I did not blindly accept its suggestions.

## 1. AI as a Design Reviewer

**Decision:** Use the LLM as a senior engineer reviewing the learner's design rather than comparing it with a "correct" solution.

**AI suggested:** Comparing submissions against a reference solution.

**Rejected because:** LLD can have multiple valid designs. A reference-based grader could encourage learners to copy patterns instead of understanding design trade-offs.

**Final approach:** The LLM evaluates responsibilities, coupling, cohesion, extensibility, and design decisions based on the learner's actual submission.

---

## 2. Structured AI Feedback

**Decision:** Require the LLM to return structured JSON instead of free-form feedback.

**AI suggested:** Returning normal conversational feedback and parsing it afterward.

**Rejected because:** Free-form output is difficult to validate and store reliably.

**Final approach:** The AI returns a defined evaluation structure containing scores, strengths, issues, and suggestions. The response is validated before being persisted.

---

## 3. Deterministic Rules + AI Reasoning

**Decision:** Split evaluation between deterministic rules and the LLM.

**AI suggested:** Letting the LLM evaluate everything.

**Rejected because:** Some checks are factual and should be consistent, such as missing classes, invalid relationships, or incomplete required fields.

**Final approach:**

* **Rules:** structural/completeness checks
* **LLM:** design judgment and reasoning

This makes feedback more consistent and explainable.

---

## 4. Rejected: Maximum AI Reasoning

**Decision:** Keep the evaluation request lightweight rather than using a large reasoning budget.

**AI suggested:** Using extended reasoning for deeper reviews.

**Rejected because:** Testing showed that longer reasoning significantly increased evaluation time without enough improvement for this MVP.

**Final approach:** Use a focused prompt with the relevant submission and deterministic evidence, prioritizing useful feedback and reasonable response time.

---

## 5. AI Evaluation as a Process

**Decision:** Treat evaluation as a process with explicit states instead of directly displaying the AI response.

**AI suggested:** Streaming the model's response directly into the UI.

**Rejected because:** Raw streaming would make validation, persistence, history, and failure handling difficult.

**Final approach:**

```text
SUBMITTED
    ↓
EVALUATING
    ↓
EVALUATED
    or
FAILED
```

The validated evaluation is stored so learners can review previous attempts and track improvement.

---

## Summary

AI helped shape the product, but the final decisions were based on the assignment's requirements and practical testing. The main principle was:

> **Use AI for judgment and exploration, but keep important product behaviour deterministic and under application control.**
