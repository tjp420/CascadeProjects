/**
 * MCP problem-solver handlers — solve_problem and diagnose_error.
 * "Yes you can" master engineer tools — free tier, no LLM, deterministic.
 */

const { solveProblem, diagnoseError } = require('../../lib/problem-solver');

function createProblemSolverHandlers({
    withGuard,
    resolveProjectRoot,
    formatToolResult
}) {
    return {
        solve_problem: withGuard((args) => {
            const problem = args.problem;
            if (!problem || typeof problem !== 'string') {
                return formatToolResult({
                    error: 'Provide a problem statement (natural language description of what is wrong)'
                });
            }

            const root = resolveProjectRoot(args.projectRoot);
            const result = solveProblem(problem, { projectRoot: root });

            return formatToolResult(result);
        }),

        diagnose_error: withGuard((args) => {
            const errorText = args.errorText || args.error || args.message;
            if (!errorText || typeof errorText !== 'string') {
                return formatToolResult({
                    error: 'Provide errorText (the error message or stack trace to diagnose)'
                });
            }

            const result = diagnoseError(errorText);

            return formatToolResult(result);
        })
    };
}

module.exports = { createProblemSolverHandlers };
