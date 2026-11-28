const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../js/data.js');require('../js/combat.js');require('../js/online.js');
test('old custom fighters keep their original look and receive neutral face options',()=>{
 const old={id:'custom-old',height:4,look:{hair:2,eyes:1,skin:3,outfit:2}};
 const f=D.normalize(old);assert.equal(f.height,7);assert.equal(f.look.hair,2);assert.equal(f.look.eyes,1);assert.equal(f.look.outfit,2);assert.equal(f.look.eyeSize,1);assert.equal(f.look.glasses,0);
});
test('new appearance options survive saving and online character validation without changing stats',()=>{
 const look=Object.fromEntries(Object.entries(D.looks).map(([k,v])=>[k,v.length-1]));
 const f=D.normalize({id:'custom-test',height:6,heightScale:10,look});const received=D.onlineFighter(JSON.parse(JSON.stringify(f)));
 assert.deepEqual(received.look,f.look);assert.equal(received.speed,f.speed);assert.equal(received.height,f.height);
 for(const key of Object.keys(D.looks))assert.equal(f.look[key],D.looks[key].length-1);
});

