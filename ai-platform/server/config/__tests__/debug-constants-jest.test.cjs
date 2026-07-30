const constants = require('../constants.cjs');

test('jest runtime inspection of constants', () => {
	// Print a few diagnostics to stdout for debugging under Jest
	console.log('JEST RUNTIME CHECK — keys sample:', Object.keys(constants).slice(0,40));
	console.log('describeExport', typeof constants.describeExport);
	console.log('env', typeof constants.env);
	console.log('parseBoolean', typeof constants.parseBoolean);
	console.log('clamp', typeof constants.clamp);
	console.log('countBy', typeof constants.countBy);
	console.log('safeJsonLimit', constants.safeJsonLimit);
	expect(true).toBe(true);
});
