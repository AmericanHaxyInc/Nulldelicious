var assert = require('assert');
var ndcore = require('../Ndcore.js');
var hx$ = require('haxyclosures');

//test that we can make a successful connection to mongodb
var connected = 0;
ndcore.connection.connect(function()
{
    //run these all with extracted master auth headers

    hx$.Log("starting ndcore tests");
    assert.ok(ndcore.connection.connected);
    //test a sample authentication using the default creds
    //test that the returned auth token is useable.
    hx$.Log("initializing guids");
    //test that we can create a site, and populate it with sample users, posts, comments, and images
    var siteId = hx$.Guid();
    var userId = hx$.Guid();
    var roleId = hx$.Guid();
    var postId = hx$.Guid();
    var post2Id = hx$.Guid();
    var authorId = hx$.Guid();
    var imageId = hx$.Guid();

    //mock up a principal with full access to resources to use for testing core functionality
    var principal = new ndcore.authentication.Principle(
        {
            name : 'David',
            role : {},
            master : 1
        }
    );
    hx$.Log("schema adds");
    //test schema adds
    hx$.Log("adding site");
    ndcore.interfaces.SetId('site', siteId, {id : siteId, title : "NewBlog", description : "This is a new blog yo"}, principal)
        .then(function() {
            hx$.Log("adding user");
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
        }
    ).then(function()
        {
            hx$.Log("adding role");
            return ndcore.interfaces.SetId("role", roleId, {id : roleId, name : "Admin", access: [{resource : "user", interfaces : [{name : "user"}, {name : "site"}]}]}, principal);
        }).then(function()
        {
            hx$.Log("adding author");
            return ndcore.interfaces.SetId("author", authorId, {id: authorId, name : "David Dworetzky", imageId : imageId, userId : userId}, principal);
        }).then(function()
        {
            hx$.Log("adding post");
            return ndcore.interfaces.SetId("post", postId, {id: postId, title : "Lemoncello party favors", body: "", paragraphs: [], date: "01/26/2015", comments : [], tags : [], authorId : authorId, siteId : siteId, published : false}, principal);
        }).then(function()
        {
            hx$.Log("retrieving post");
            return ndcore.interfaces.GetId("post", postId, [], 0, principal);
        }).then(function(post)
        {
            hx$.Log("data validation and relational assertions");
            //now test data querying
            assert.ok(post.paragraphs);
            assert.ok(post.title === "Lemoncello party favors");
            //now test the GET returns the de-normalized data that were looking for
            assert.ok(post.site_title === "NewBlog");
            assert.ok(post.site_description === "This is a new blog yo");
            return ndcore.interfaces.SetId("post", post2Id, {id: post2Id, title : "SamplePost", body: "Sweet!", paragraphs: [], date: "02/04/2015", comments: [], tags : [], authorId : authorId, siteId : siteId, published : false}, principal);
        }).then(function() {
            return ndcore.interfaces.GetId("post", postId, [], 0, principal);
        }).then(function(post)
            {
            return ndcore.interfaces.GetQuery("post", "title", "SamplePost", principal);
        }).then(function(post2)
        {
            //query by id and key value pair
            hx$.log("testing querying...");
            assert.ok(post2[0].body === "Sweet!");
            hx$.log("testing Delete");
            return ndcore.interfaces.DeleteId("role", roleId, principal);
        }).then(function(result)
        {
            hx$.log("final get");
           assert.ok(result !== null);
            return ndcore.interfaces.GetId("role", roleId, [], 0,principal);
        }).then(function(role) {
            hx$.log("final get assertion");
            assert.ok(!role);
            return ndcore.interfaces.SetId('site', siteId, {id : siteId, title : "NewBlog2", description : "This is a new blog yo"}, principal)
        }).then(function(result)
        {
          hx$.log("data change assertion");
          assert.ok(result.title === "NewBlog2");
          hx$.log("tests complete!");
        })
        .catch(function(err)
        {
            hx$.log('Error ' + err);
            throw new Error(err);
        });


}, '../../');












