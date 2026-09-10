/**
 * Minimal extract from OWASP NodeGoat — intentionally vulnerable training app.
 *
 * Upstream: https://github.com/OWASP/NodeGoat/blob/master/app/routes/contributions.js
 * License: Apache-2.0 (see ../NOTICE)
 *
 * Known vulnerability (A1 Injection / SSJS):
 *   eval(req.body.preTax) / eval(req.body.afterTax) / eval(req.body.roth)
 *
 * Secure alternative (commented in upstream):
 *   parseInt(req.body.preTax) etc.
 *
 * Modified for fixture isolation: DAO/render dependencies stubbed so the
 * vulnerable eval surface remains the evidence under test.
 */

"use strict";

function ContributionsHandler(/* db */) {
  this.handleContributionsUpdate = (req, res, next) => {
    /*jslint evil: true */
    // Insecure use of eval() to parse inputs
    const preTax = eval(req.body.preTax);
    const afterTax = eval(req.body.afterTax);
    const roth = eval(req.body.roth);

    /*
    //Fix for A1 -1 SSJS Injection attacks - uses alternate method to eval
    const preTax = parseInt(req.body.preTax);
    const afterTax = parseInt(req.body.afterTax);
    const roth = parseInt(req.body.roth);
    */

    const userId = req.session && req.session.userId;

    const validations = [
      isNaN(preTax),
      isNaN(afterTax),
      isNaN(roth),
      preTax < 0,
      afterTax < 0,
      roth < 0,
    ];
    const isInvalid = validations.some((validation) => validation);
    if (isInvalid) {
      return res.status(400).json({
        updateError: "Invalid contribution percentages",
        userId,
      });
    }

    if (preTax + afterTax + roth > 30) {
      return res.status(400).json({
        updateError: "Contribution percentages cannot exceed 30 %",
        userId,
      });
    }

    return res.json({
      userId,
      preTax,
      afterTax,
      roth,
      updateSuccess: true,
    });
  };
}

module.exports = ContributionsHandler;
