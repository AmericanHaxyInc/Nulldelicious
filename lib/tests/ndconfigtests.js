/**
 * Created by David on 1/19/2015.
 */
var assert = require('assert');
var config = require('../config/ndconfig.js');
//high level tests for our cached config object

//trivial assertions around data format
assert(config.master === 'master.cfg');
assert(config.Sections.length === 4);

//attempt to load the base config with mongo specifications
var value;
//config is always nested in a callback
config.Value(function(data){
    value = data;
    //make sure we have a valid mongo uri
    assert(value.mongo.mongodbUri !== undefined);
    //make sure we have a valid web port
    assert(value.web.port !== undefined);
}, '../../');

