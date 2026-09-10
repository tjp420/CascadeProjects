/**
 * Minimal extract from OWASP NodeGoat — NoSQL / server-side JS injection.
 *
 * Upstream: https://github.com/OWASP/NodeGoat/blob/master/app/data/allocations-dao.js
 * License: Apache-2.0 (see ../../known-vulnerable-nodegoat/NOTICE)
 *
 * Known vulnerability (A1 Injection):
 *   Unsanitized `threshold` query parameter interpolated into MongoDB `$where`.
 *
 * Secure alternative (commented in upstream):
 *   parseInt(threshold) + $gt operator (no $where).
 */
"use strict";

function AllocationsDAO(/* db */) {
  this.getByUserIdAndThreshold = (userId, threshold, callback) => {
    const parsedUserId = parseInt(userId, 10);

    const searchCriteria = () => {
      if (threshold) {
        /*
        // Fix for A1 - 2 NoSQL Injection
        const parsedThreshold = parseInt(threshold, 10);
        if (parsedThreshold >= 0 && parsedThreshold <= 99) {
          return { userId: parsedUserId, stocks: { $gt: parsedThreshold } };
        }
        throw `The user supplied threshold: ${parsedThreshold} was not valid.`;
        */
        // DELIBERATE VULNERABILITY — threshold interpolated into $where
        return {
          $where: `this.userId == ${parsedUserId} && this.stocks > '${threshold}'`,
        };
      }
      return { userId: parsedUserId };
    };

    return callback(null, searchCriteria());
  };
}

module.exports = { AllocationsDAO };
