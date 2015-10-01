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

        var authenticated = ndcore.authentication.authenticate({username : user, password: password}, 'key', 'set',  {});

        authenticated.then(function(result)
        {
            console.log(result);
        });

        //test keygen

        var key = ndcore.authentication.createKey({username : user, password: password}, 0, {});

        key.then(function(result)
        {
            console.log(result);
        })


    }, '../../');

}, '../../');
