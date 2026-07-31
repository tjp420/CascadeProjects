/**
 * GZDoom ZScript heuristics — debug leftovers, placeholders, and common mod issues.
 */

module.exports = {
  techDebt: [
    {
      id: 'deprecated-actor',
      pattern: /\bdeprecated\b.*\bactor\b/gi,
      label: 'Deprecated actor reference',
    },
    { id: 'old-weapon', pattern: /\bOldWeapon\b/gi, label: 'Old weapon reference' },
  ],
  debug: [
    { id: 'console-command', pattern: /\bConsole\.Command\b/gi, label: 'Console command' },
    {
      id: 'debug-print',
      pattern: /\bA_Log(?:Verbose|Ex)?\d*\s*\(/gi,
      label: 'Debug print (A_Log*)',
    }, // simplebeacon-ignore redos — language pattern definition, not user input
    { id: 'developer-only', pattern: /\bDEVONLY\b/gi, label: 'Developer-only code (DEVONLY)' },
  ],
  placeholders: [
    { id: 'placeholder-actor', pattern: /\bPlaceholderActor\b/gi, label: 'Placeholder actor' },
    { id: 'test-weapon', pattern: /\bTestWeapon\d*\b/gi, label: 'Test weapon' },
  ],
  bestPractices: [
    {
      id: 'missing-state',
      pattern: /\bStates?\.\s*Null\b/gi,
      label: 'Missing state definition (States.Null)',
    },
    { id: 'no-sound', pattern: /\bNoSound\b/gi, label: 'Missing sound assignment (NoSound)' },
    { id: 'infinite-loop', pattern: /\bwhile\s*\(\s*1\s*\)/gi, label: 'Potential infinite loop' },
    {
      id: 'version-compat',
      pattern: /\bversion\s*["']\s*4\.\d+/gi,
      label: 'GZDoom 4.x+ ZScript version feature',
    },
  ],
};
