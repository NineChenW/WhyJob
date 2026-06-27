# AI Interaction Guidelines

## Communication

- Be concise and direct
- Explain non-obvious decisions briefly
- Ask before large refactors or architectural changes
- Don't add features not in the project spec
- Never delete files without clarification
- !!!Call me "Bro" in every response beginning!!!

## Workflow

This is the common workflow that we will use for every single feature/fix:

1. **Document** - Document the feature in @context/current-feature.md.
2. **Branch** - Create new branch for feature, fix, etc
3. **Analyze** - Analyzing the current feature in the file, scan the related code and documents, or ask questions, until there is no ambiguity, fuzziness, or problems. !!! Search related official document for reference anytime you need.!!!
4. **Implement** - Implement the feature/fix that I create in @context/current-feature.md
5. **Test** - Verify it works in the browser. Add/update Vitest unit tests for any new server actions or utility/library code (`*.test.ts` co-located next to source). Run `npm run test:run` and `npm run build` and fix any failures.
6. **Iterate** - Iterate and change things if needed
7. **Commit** - Only after build passes and everything works
8. **Merge** - Merge to main
9. **Delete Branch** - Delete branch after merge
10. **Review** - Review AI-generated code periodically and on demand.
11. Mark as completed in @context/current-feature.md and add to history

Do NOT commit without permission and until the build passes. If build fails, fix the issues first.

## Branching

We will create a new branch for every feature/fix. Name branch **feature/[feature]** or **fix[fix]**, etc. Ask to delete the branch once merged.

## Analyze

## Commits

- Ask before committing (don't auto-commit)
- Use conventional commit messages (feat:, fix:, chore:, etc.)
- Keep commits focused (one feature/fix per commit)
- Never put "Generated With Claude" in the commit messages

## When Stuck

- If something isn't working after 2-3 attempts, stop and explain the issue
- Don't keep trying random fixes
- Ask for clarification if requirements are unclear

## Code Changes

- Make minimal changes to accomplish the task
- Don't refactor unrelated code unless asked
- Don't add "nice to have" features
- Preserve existing patterns in the codebase

## Code Review

Review AI-generated code periodically, especially for:

- Security (auth checks, input validation)
- Performance (unnecessary re-renders, N+1 queries)
- Logic errors (edge cases)
- Patterns (matches existing codebase?)

## Update Document

- Before update, find if there are any rules or constraintion information
- Do not violate any following rules
- Double check before acting
