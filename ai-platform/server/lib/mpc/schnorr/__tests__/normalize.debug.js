const { normalizeToBigInt } = require('../field.cjs');
const inputs = ['0x3039','0X3039','0x64','0X64','64','100','0x3','0X3','0x1','0X1','0X5','-0x1','-5','abc','0xG'];
for (const s of inputs) {
  try {
    const v = normalizeToBigInt(s);
    console.log(s, '=>', v.toString());
  } catch (e) {
    console.log(s, 'ERROR ->', e.message);
  }
}
