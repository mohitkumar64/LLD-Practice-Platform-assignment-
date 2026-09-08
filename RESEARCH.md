# Research Note

## What problem am I trying to solve?

LLD is relatively easy to practice but much harder to evaluate.

If I solve a coding problem, I can usually run the code and see whether it passes. With LLD, there is no single test that tells me whether my classes have the right responsibilities, whether the design is too tightly coupled, or whether it will be easy to extend.

The usual ways of practicing have a few limitations:

* You can compare your design with a solution online, but that only tells you how your design differs from one possible solution.
* You can ask an experienced developer for a review, but that is not always available.
* You can ask an AI chatbot, but the feedback is usually a general conversation and is not easy to track across multiple attempts.

This led me to a simple idea:

> **Instead of helping learners find the "correct" LLD solution, help them understand why their own design could be better.**

## What I looked at

I looked at a few common approaches to LLD practice:

**Coding platforms:**
Platforms such as LeetCode and HackerRank are very good at automatically evaluating code, but their evaluation model does not work well for LLD because multiple designs can be valid.

**LLD resources:**
There are many blogs, GitHub repositories, videos, and courses covering problems such as Parking Lot, Elevator, and Splitwise. These are useful for learning, but they generally focus on explaining a solution rather than reviewing the learner's own attempt.

**AI chatbots:**
An LLM can give useful design feedback, especially for things like coupling and extensibility. However, simply pasting a design into a chatbot produces unstructured feedback and does not naturally create a practice history.

**Diagramming tools:**
Tools such as draw.io and PlantUML are useful for expressing designs, but they do not tell the learner whether the design itself is good.

## What gap does this leave?

The main gap I found is the lack of a simple practice loop specifically focused on LLD:

**Practice → Submit → Get a design review → Improve → Try again**

The important part is that the platform should not treat one solution as the answer key. A learner should be able to choose a different design and still receive good feedback if the design is reasonable.

## My MVP direction

I decided to focus the MVP around three things:

### 1. Structured submission

Instead of asking the learner to paste everything into one text box, the submission captures things like classes, responsibilities, relationships, patterns, and trade-offs.

This gives the evaluator more useful information and makes basic deterministic checks possible.

### 2. Hybrid feedback

Some things are better checked by code, such as missing information or invalid relationships.

Other things require judgment, such as whether a class has too many responsibilities or whether an abstraction actually improves extensibility.

So the MVP combines:

**Deterministic checks + LLM design review**

### 3. Attempt history

The learner should be able to see previous attempts and their feedback.

The goal is not just:

> "You scored 72."

It is:

> "You scored 72 on your first attempt, fixed the coupling issue, and scored 84 on the next one."

That makes the platform about improving design skills rather than simply getting a score.

## Scope

Because this is a 2-day assignment, I deliberately kept the scope small.

I included:

* A small LLD problem library
* A practice workspace
* Structured submissions
* AI-assisted design feedback
* Attempt history
* Retry flow

I left out authentication, collaboration, advanced diagram editing, analytics, and distributed infrastructure.

The focus is on making the **practice → feedback → improvement** loop work well.
