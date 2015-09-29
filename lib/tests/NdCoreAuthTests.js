/**
 * Created by David on 2/27/2015.
 */
var assert = require('assert');
var ndcore = require('../ndcore.js');
var hx$ = require('../HaxyClosures.js');
var config = require('../config/ndconfig.js');

var connected = 0;
ndcore.connection.connect(function()
{
    hx$.log('Starting ndcore auth tests');
    config.Value(function(value)
    {
        var user = value.master.uname;
        var password = value.master.password;




        //test authenticate method with master password
        //we bootstrap this from the current master config

        //create user with role

        //test that this role
    });







    //now use this user's credentials to test negative and positives with this role
});
