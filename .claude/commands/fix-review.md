You must fix all findings from the latest code review. Follow this process strictly:

1. ANALYZE: Read the latest review in `/home/lucas/Documents/Projects/remy-recipes/remy-s-master/.claude/reviews/`. For each finding, identify the ROOT CAUSE, not just the symptom. Think about what other files depend on or call the affected code. Write your analysis as a checklist.

2. FIX: Implement ALL fixes together. For each fix, trace the impact through the entire codebase — if you change an API endpoint, update every component that calls it. If you add a required parameter, update every caller. Never fix one file in isolation.

3. VERIFY: After fixing, run ./review.sh on the files you changed. For example: ./review.sh src/app/api/upload/route.ts src/components/common/ImageUpload.tsx

4. ITERATE: If the review finds new findings, go back to step 1. Repeat until the review exits with code 0 (no critical or high findings).

5. REPORT: When done, show me a summary of what you fixed and confirm the review passes clean.

RULES:

- NEVER say "done" until you have run the review and it passes
- NEVER fix a symptom without checking what else depends on that code
- If you change a function signature, grep the entire codebase for callers
- If you add auth to an endpoint, check every component that calls it
- If you change a type, check every file that imports it
- Run the review after EVERY round of fixes, not just at the end
