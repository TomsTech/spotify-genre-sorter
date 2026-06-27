const { performance } = require('perf_hooks');

const keys1 = [];
const keys2 = [{ name: 'test-key', metadata: { foo: 'bar' } }];
const keys3 = [{ name: 'other-key', metadata: { foo: 'bar' } }];

const ITERATIONS = 10_000_000;

function benchFind() {
  const start = performance.now();
  let matches = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const list = i % 3 === 0 ? keys1 : i % 3 === 1 ? keys2 : keys3;
    const keyName = 'test-key';
    const keyMeta = list.find(k => k.name === keyName);
    if (keyMeta) matches++;
  }
  return performance.now() - start;
}

function benchIndex() {
  const start = performance.now();
  let matches = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const list = i % 3 === 0 ? keys1 : i % 3 === 1 ? keys2 : keys3;
    const keyName = 'test-key';
    const keyMeta = list[0]?.name === keyName ? list[0] : undefined;
    if (keyMeta) matches++;
  }
  return performance.now() - start;
}

console.log(`Benchmarking array.find vs index...`);
const t1 = benchFind();
const t2 = benchIndex();

console.log(`.find(): ${t1.toFixed(2)} ms`);
console.log(`index:   ${t2.toFixed(2)} ms`);
console.log(`Improvement: ${((t1 - t2) / t1 * 100).toFixed(2)}%`);
