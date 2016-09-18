var assert = require('assert');
var q = require('q');
var _ = require('underscore');
var hx$ = require('../HaxyClosures.js');
assert.ok(1, 'test');
var fixtures = {
    rlist: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
};
var last = 0;
hx$.foreachReverse(fixtures.rlist, function(a)
{
    last = a;
});
var sum = 0;
hx$.foreach(fixtures.rlist, function(a)
{
    sum += a;
});
//assigned in reverse order
assert.ok(last === 1);
//assert sum was taken
assert.ok(sum === 55);

//assert CopyProps works
fixtures.Obj1 = {'a' : 20, 'b' : 10};
fixtures.Obj2 = {'a' : 0, 'b' : 0};
hx$.CopyProps(fixtures.Obj2, fixtures.Obj1);
assert.ok(fixtures.Obj2.a === 20 && fixtures.Obj2.b === 10);

fixtures.ObjId1 = {'a' : 20, 'b' : 10, 'id' : 0};
fixtures.ObjId2 = {'a' : 0, 'b' : 0, 'id' : 1};
hx$.CopyProps(fixtures.ObjId1, fixtures.ObjId2, function(key1, key2)
{
    return key1 !== 'id';
});
assert.ok(fixtures.ObjId1.id === 0 && fixtures.ObjId1.a == 0 && fixtures.ObjId1.b === 0);


//assert ApplyArgs works
//simple string cat and plus cases
var result = hx$.ApplyArgs(function(accumulator, arg) {return accumulator + "/" + arg;}, '', 'a', 'b', 'c');
assert.ok(result === "/a/b/c");

var result2 = hx$.ApplyArgs(function(accumulator, arg){return accumulator + arg;}, 0, 1, 2, 3);
assert.ok(result2 === 6);

var kvp = hx$.KeyValue('item' + 'id', 3)
assert.ok(kvp.itemid === 3);

//simple set exclusion and intersection assertions
fixtures.exset1 = ['a', 'b', 'c'];
fixtures.exset2 = ['c', 'd', 'e'];

var intersection = hx$.intersect(fixtures.exset1, fixtures.exset2);
var exclusion = hx$.exclude(fixtures.exset1, fixtures.exset2);
assert.ok(intersection[0] === "c");
assert.ok(exclusion[0] === "a" && exclusion[1] === "b");

fixtures.singleset1 = ['a', 'b', 'c'];
//positive, negative
var single = hx$.single(fixtures.singleset1, function(element)
{
    return element === 'a';
});

var single2 = hx$.single(fixtures.singleset1, function(element)
{
    return element === 'd';
});
assert.ok(single === 'a');
assert.ok(single2 === undefined);

//test select
fixtures.selectset = [3, 3, 3];
assert.ok(hx$.select(fixtures.selectset, function(element){return element * 2;})[0] === 6);

//add props tests

fixtures.AddPropsSetA = {};
fixtures.AddPropsSetB = {'a' : 2, 'b' : 3};
hx$.AddProps(fixtures.AddPropsSetA, fixtures.AddPropsSetB);
assert.ok(fixtures.AddPropsSetA.a === 2 && fixtures.AddPropsSetA.b === 3);








