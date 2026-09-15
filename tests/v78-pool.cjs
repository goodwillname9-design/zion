const assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm');
const context={exports:{},Promise,Map};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/task-pool.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
(async()=>{const pool=context.exports.createTaskPool(3);let active=0,max=0,runs=0;
const work=async()=>{runs++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,4));active--;};
const first=pool('same',work);assert.equal(first,pool('same',work));
await Promise.all([first,...Array.from({length:12},(_,i)=>pool(String(i),work))]);assert.equal(runs,13);assert.equal(max,3);
await assert.rejects(pool('failure',async()=>{throw Error('expected')}));await pool('after',work);
console.log('PASS concurrency capped at 3, duplicate requests shared, queue recovers after error');})().catch(e=>{console.error(e);process.exit(1)});
