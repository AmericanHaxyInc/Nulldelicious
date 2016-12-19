/**
 * Created by David on 2/27/2015.
 */
var assert = require('assert');
var ndcore = require('../Ndcore.js');
var hx$ = require('haxyclosures');
var config = require('../config/Ndconfig.js');
var Q = require('q');

//SETUP
var MasterPassword = 'theskeletonkingreigns';

//FIXTURES
//universal scope
var roleId = hx$.Guid();
var userId = hx$.Guid();
var siteId = hx$.Guid();
//site scoped
var site2Id = hx$.Guid();
var role2Id = hx$.Guid();
var user2Id = hx$.Guid();
var post2Id = hx$.Guid();
//user scoped
var role3Id = hx$.Guid();
var user3Id = hx$.Guid();
var post3Id = hx$.Guid();

var siteScopedFixtures = Q.defer();
//promises that must execute before our assertions
var fixturePromises = [siteScopedFixtures];

var access = hx$.select(["user", "role", "site", "post", "key"], function(element)
{
    //give full access to user, role, site, and post
    return {
        resource: element,
        actions : [
            {name : "set"},
            {name : "get"},
            {name : "delete"}
        ]
    };
});

//site 1, user 1 data
var siteFixture = {id: siteId, title: "NewBlog", description : "This is a new blog yo"};
var roleFixture = {id : roleId, name : "Admin", access: access, siteId: siteId, siteScoped: false, userScoped: false};
var userFixture = {id: userId, name: "fakeuser1", first: "David", last: "Dworetzky", email: "fake@email.com", gender: "Male", password: "P@ssword!", siteId: siteId, roleId: roleId};
var keyFixture = {"x-nd-user" : "fakeuser1", "x-nd-secret": "P@ssword!"};


//user2 data
var site2Fixture = {id: site2Id, title: "FactWhirl", description : "Sarcastic news site"};
var role2Fixture = {id: role2Id, name: "AdminSite2", access: access, siteId: site2Id, siteScoped: true, userScoped: false};
var user2Fixture = {id: user2Id, name: "fakeuser2", first: "David", last: "Dworetzky", email: "fake@email.com", gender: "Male", password: "P@ssword1", siteId: site2Id, roleId: role2Id};
var key2Fixture = {"x-nd-user" : "fakeuser2", "x-nd-secret": "P@ssword1"};
var post2Fixture = {id: post2Id, title : "Sample Post", body: "", paragraphs: [], date: "12/30/2016", comments : [], tags : [], authorId : user2Id, siteId : site2Id, published : false};

//user 3 data
var role3Fixture = {id: role3Id, name: "FullControlUser3Site3", access: access, siteId: site2Id, siteScoped: true, userScoped: true};
var user3Fixture = {id: user3Id, name: "fakeuser3", first: "David", last: "Dworetzky", email: "fake@email.com", gender: "Male", password: "P@ssword1", siteId: site2Id, roleId: role3Id};
var key3Fixture = {"x-nd-user" : "fakeuser3", "x-nd-secret": "P@ssword1"};
var post3Fixture = {id: post3Id, title : "Sample Post", body: "", paragraphs: [], date: "12/30/2016", comments : [], tags : [], authorId : user3Id, siteId : site2Id, published : false};

//key1, key2, key3 values are the respective key contents after keys have been created
var key1 = "";
var key2 = "";
var key3 = "";
//TESTS

var connected = 0;
ndcore.connection.connect(function()
{
    hx$.log('Starting ndcore auth tests');
    hx$.log('----- FIRST SECTION TESTS AND FIXTURES ----- ');
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

            hx$.log("creating new site");
            ndcore.interfaces.SetId("site", siteId, siteFixture, principal).then(function(site)
            {
                hx$.log("creating new role with full access to user, role, site, and post");
                return ndcore.interfaces.SetId("role", roleId, roleFixture, principal);
            }).then(function(role)
            {
                hx$.log("creating new user with associated role id");
                return ndcore.interfaces.SetId('user', userId, userFixture, principal);
            }).then(function(user)
            {
                //test key gen
                hx$.log("creating key associated with user");
                var key = ndcore.authentication.createKey(keyFixture, userId, {});
                key.then(function(key)
                {
                    hx$.log('Api key gen generated result');
                    //should be our json web token object at this point
                    hx$.log(key.content);
                    key1 = key.content;
                    //with the value of the existing key, let's authenticate and then read and write some values

                    hx$.log('authenticating with key');
                    var keyAuthentication = ndcore.authentication.authenticate({"x-nd-apikey" : key.content}, 'post', 'set',  {});

                    //start by retrieving our site

                    keyAuthentication.then(function(principal2)
                    {
                        hx$.log('retrieving site information via provided api key');
                        ndcore.interfaces.GetId("site", siteId, [], 0, principal2).then(function(site)
                        {
                            hx$.log('Retrieved post successfully using api key authentication');
                            hx$.log('Site title is' + site.title);

                            hx$.log('Creating site2');
                            return ndcore.interfaces.SetId("site", site2Id, site2Fixture, principal);
                        }).then(function(site2)
                        {
                            hx$.log('Site 2 created');
                            hx$.log('Creating role2');
                            return ndcore.interfaces.SetId("role", role2Id, role2Fixture, principal);
                        }).then(function(role2)
                        {
                            hx$.log('Role 2 created');
                            hx$.log('Creating user 2');
                            return ndcore.interfaces.SetId("user", user2Id, user2Fixture, principal);
                        }).then(function(user2)
                        {
                            hx$.log('User 2 created');
                            hx$.log('Creating key 2');
                            return ndcore.authentication.createKey(key2Fixture, user2Id, {});
                        }).then(function(key2)
                        {
                            key2 = key2.content;
                            hx$.log('Role 3 created');
                            hx$.log('Creating role 3');
                            return ndcore.interfaces.SetId("role", role3Id, role3Fixture, principal);
                        }).then(function(role3)
                        {
                            hx$.log('Role 3 created');
                            hx$.log('Creating user 3');
                            return ndcore.interfaces.SetId("user", user3Id, user3Fixture, principal);
                        }).then(function(user3)
                        {
                            hx$.log('User 3 created');
                            hx$.log('Creating key 3');
                            return ndcore.authentication.createKey(key3Fixture, user3Id, {});
                        }).then(function(key3)
                        {
                            key3 = key3.content;
                            hx$.log('Key 3 created. Testing site and user scoped assertions');
                            siteScopedFixtures.resolve(true);
                        });
                        //now lets run our user scoped tests.
                    });

                }).catch(function(err)
                {
                    hx$.log('Api key gen resulted in an error');
                    hx$.log(err);
                });
            }).catch(function(err)
            {
                hx$.log(err);
            });
        }).catch(function(err)
        {
            hx$.log('error occurred');
            hx$.log(err);
        });

    }, '../../');

}, '../../');

//post fixture tests

var postFixtures = Q.all(fixturePromises);
postFixtures.then(function(result)
{
    hx$.log('starting site scoped and user scoped tests');
    hx$.log('----- SECOND SECTION TESTS USER AND SITE SCOPED TOKENS----- ');
    var currentPrincipal = {};
    //authenticate user 2
    ndcore.authentication.authenticate({"x-nd-apikey" : key2}, 'post', 'set',  {})
        .then(function(principal2)
        {
            hx$.log('Creating post under site 2');
            //attempt to create post under site 2
            ndcore.interfaces.SetId("post", post2Id, post2Fixture, principal2).then(function(post)
            {
                assert.ok(post);
                hx$.log('created post under site 2');
                hx$.log('edit site 2 with site scoped key');
                //edit site 2
                site2Fixture.description = "Changed Description";
                return ndcore.interfaces.SetId("site", site2Id, site2Fixture, principal2);
            }).then(function(site)
            {
                assert.ok(site.description === "Changed Description");
                hx$.log('description changed');
                hx$.log('edit site 1 with site scoped key.');
                //now try to edit site 1, this should fail
                siteFixture.description = "Changed Description";
                return ndcore.interfaces.SetId("site", siteId, siteFixture, principal2);
            }).then(function(site2)
            {
                //fail if we change this site successfully
                hx$.log('site was changed. failure');
                assert.fail();
            }).catch(function(error)
            {
                hx$.log('site failed successfully');
                //we expect failure on our final step
                assert.ok(error);
                hx$.log('authenticating user 3');
                return ndcore.authentication.authenticate({"x-nd-apikey" : key3}, 'post', 'set', {})
            }).then(function(principal3)
            {
                currentPrincipal = principal3;
                hx$.log('user 3 authenticated');
                hx$.log('creating new post with principal3');
                return ndcore.interfaces.SetId("post", post3Id, post3Fixture, currentPrincipal);
            }).then(function(post3)
            {
                hx$.log('post 3 created successfully');
                hx$.log('edit this same post with principal3');
                post3Fixture.body = "altered body";
                return ndcore.interfaces.SetId("post", post3Id, post3Fixture, currentPrincipal);
            }).then(function(post3)
            {
                hx$.log('post 3 edited successfully');
                hx$.log('changing site 2 with principal3');
                site2Fixture.description = "Another changed description";
                return ndcore.interfaces.SetId("site", site2Id, site2Fixture, currentPrincipal);
            }).then(function(site2)
            {
                hx$.log('site was changed. failure');
                assert.fail();
            }).catch(function(error)
            {
                hx$.log('site failed successfully');
                assert.ok(error);
            });
        });
});