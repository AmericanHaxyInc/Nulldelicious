/**
 * Created by David on 1/19/2015.
 */
var assert = require('assert');
var config = require('../config/Ndconfig.js');
var hx$ = require('haxyclosures');
//high level tests for our cached config object

//trivial assertions around data format
hx$.log('trivial assertions about config structure, number of sections');
assert(config.master === 'master.cfg');
assert(config.Sections.length === 5);

//attempt to load the base config with mongo specifications
var value;
//config is always nested in a callback
config.Value(function(data){
    value = data;
    //make sure we have a valid mongo uri
    hx$.log('making sure mongodb Uri is supplied');
    assert(value.mongo.mongodbUri !== undefined);
    //make sure we have a valid web port
    hx$.log('making sure we have a valid web port');
    assert(value.web.port !== undefined);
    hx$.log('making sure application uri is set');
    assert(value.application !== undefined);
}, '../../');

