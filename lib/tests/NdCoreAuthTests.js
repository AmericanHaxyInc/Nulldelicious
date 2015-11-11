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

        authenticated.then(function(principal)
        {
            //result is our principle
            hx$.log('Principle returned from auth');
            hx$.log(principal);

            //now, generate a user, and chain this user into our key gen
            var roleId = hx$.Guid();
            var userId = hx$.Guid();
            var siteId = hx$.Guid();
            var access = hx$.select(["user", "role", "site", "post"], function(element)
            {
                //give full access to user, role, site, and post
                return {
                    resource: element,
                    interfaces : [
                        {name : "set"},
                        {name : "read"},
                        {name : "delete"}
                    ]
                };
            });
            hx$.log("creating new site");
            ndcore.interfaces.SetId("site", siteId, {id: siteId, title: "NewBlog", description : "This is a new blog yo"}, principal).then(function()
            {
                hx$.log("creating new role with full access to user, role, site, and post");
                return ndcore.interfaces.SetId("role", roleId, {id : roleId, name : "Admin", access: access}, principal);
            }).then(function()
            {
                hx$.log("creating new user with associated role id");
                return ndcore.interfaces.SetId('user', userId, {
                    id: userId,
                    name: "ddworetzky",
                    first: "David",
                    last: "Dworetzky",
                    email: "fake@email.com",
                    gender: "Male",
                    password: "P@ssword!",
                    siteId: siteId,
                    roleId: roleId
                }, principal);
            }).catch(function(err)
            {
                hx$.log(err);
            });
            //test key gen
            hx$.log("creating key associated with user");
            var key = ndcore.authentication.createKey({"x-nd-user" : "ddworetzky", "x-nd-secret": "P@ssword!"}, 0, {});
            key.then(function(key)
            {
                hx$.log('Api key gen generated result');
                //should be our json web token object at this point
                hx$.log(key.content);
                //with the value of the existing key, let's authenticate and then read and write some values

                var keyAuthentication = ndcore.authentication.authenticate({"x-nd-apikey" : key.content}, 'post', 'set',  {});

                //start by retrieving our site

                keyAuthentication.then(function(principal2)
                {
                    ndcore.interfaces.GetId("site", siteId, [], 0, principal2).then(function(site)
                    {
                        hx$.log('Retrieved post successfully using api key authentication');
                        hx$.log('Site title is' + site.title);
                    })
                });
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
