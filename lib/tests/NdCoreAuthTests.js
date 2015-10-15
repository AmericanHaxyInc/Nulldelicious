/**
 * Created by David on 2/27/2015.
 */
var assert = require('assert');
var ndcore = require('../Ndcore.js');
var hx$ = require('../HaxyClosures.js');
var config = require('../config/Ndconfig.js');

//SETUP
var MasterPassword = 'masterpassword';

var connected = 0;
ndcore.connection.connect(function()
{
    hx$.log('Starting ndcore auth tests');
    config.Value(function(value)
    {
        var user = value.master.uname;
        var password = MasterPassword;

        //authenticate using master interface

        var authenticated = ndcore.authentication.authenticate({"x-nd-user" : user, "x-nd-secret": password}, 'key', 'set',  {});

        authenticated.then(function(result)
        {
            //result is our principle
            hx$.log('Principle returned from auth');
            hx$.log(result);

            //now, generate a user, and chain this user into our key gen

            //test key gen
            var key = ndcore.authentication.createKey({"x-nd-user" : user, "x-nd-secret": password}, 0, {});
            key.then(function(result)
            {
                hx$.log('Api key gen generated result');
                //should be our json web token object at this point
                hx$.log(result);
                //with the value of the existing key, let's attempt to read and write some values.
            }).catch(function(err)
            {
                hx$.log('Api key gen resulted in an error');
                hx$.log(err);
            });
        }).catch(function(err)
        {
            hx$.log('error occurred');
            hx$.log(err);
        });
    }, '../../');

}, '../../');
