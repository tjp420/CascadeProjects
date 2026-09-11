#!/usr/bin/env node
"use strict";

const {
  runLabeledEvaluation,
} = require("../../../src/lib/reality-judge");

const metrics = runLabeledEvaluation();
process.stdout.write(`${metrics.report}\n`);
process.exitCode = 0;
