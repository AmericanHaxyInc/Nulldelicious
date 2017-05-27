/**
 * Created by David on 8/7/2016.
 */
//separated out schemas from ndcore logic
var mongoose = require('mongoose');
var underscore = require('underscore');
var hx$ = require('haxyclosures');
var ndconfig = require('./config/Ndconfig.js');

(function(mongoose, underscore, ndconfig, hx$)
{
    var root = {};

    root.Presets = {
        "Enumerations": {
            "Gender": {
                Male: 0,
                Female: 1
            },
            "TemplateType": {
                js: 0,
                css: 1,
                html: 2
            }
        }
    };

    //these are the unexpanded schemas that we are using in our blog format
    //does not include auth tables
        //pure json representation of our typed schemas
    root.Json = {
        author : {
            id : String,
            name : String,
            imageId : {type : String, index: true},
            userId : {type : String, index: true}
        },
        post : {
            id : {type: String, index : true},
            title : String,
            body : String,
            paragraphs : [{body : String}],
            date : Date,
            comments : [{id : String}],
            tags : [{name : {type : String, index: true}}],
            authorId : {type : String, index: true},
            //shortened relational chain
            siteId : {type : String, index: true},
            userId : {type : String, index: true},
            published : Boolean
        },
        comment : {
            id : {type : String, index : true},
            body : String,
            userId : {type : String, index: true},
            postId : {type : String, index: true}
        },
        user : {
            id : {type : String, index : true},
            name : {type : String, index : {unique : true}},
            first: String,
            last: String,
            email : String,
            gender : String,
            date : {type : Date, default : Date.now},
            password : String, /*SHA 256 encrypted*/
            siteId : {type : String, index: true},
            roleId : {type : String, index: true}
        },
        image : {
            id : String,
            title : String,
            data : Buffer,
            type : String,
            galleryId : {type : String, index: true},
            siteId : {type: String, index: true},
            tags : [{name : {type : String, index: true}}]
        },
        //themes are composed templates of html, css, and javascript
        theme : {
            id : String,
            name : {type : String , index : {unique : true}},
            text : String,
            /*parameters are components of the template/theme that we customize*/
            parameters : [{text: String, order : Number, type: String }],
            siteId : {type : String, index: true}
        },
        //styles are css stylesheets
        style : {
            id : String,
            name : {type : String , index : {unique : true}},
            text : String,
            siteId : {type : String, index: true}
        },
        script : {
            id : String,
            name : {type : String , index : {unique : true}},
            text : String,
            siteId : {type : String, index: true}
        },
        gallery : {
            id : String,
            title : String,
            description : String,
            siteId : {type : String, index: true}
        },
        site : {
            id : String,
            title : String,
            description : String
        },
        globalSettings: {
            id : String,
            /*can be used to temporarily enable / disable commenting */
            enableComments : Boolean,
            /*enables google analytics for site*/
            enableAnalytics : Boolean,
            /*chosen theme >> css styles for generated null delicious elements*/
            themeName : String,
            siteId : String
        },
        ban : {
            id : String,
            reason : String,
            ip : String,
            date : {type : Date, default : Date.now},
            userId : {type : String, index: true},
            siteId : String
        },
        token : {
            id: String,
            duration: Number,
            issued: Date,
            content : String,
            userId : {type : String, index: true},
            roleId : {type : String, index: true},
            master : {type : Boolean}
        },
        role : {
            id : String,
            name : String,
            //resource name and restful routes that this role has access to
            access : [{resource : String, actions: [{name : String}]}],
            siteId : String,
            //whether or not a role is scoped to items with user properties, or site properties
            siteScoped : Boolean,
            userScoped : Boolean,
            //this only should exist in the case that we have a user scoped role
            userId : String
        },
        key : {
            id: String,
            //this is an encoded JSON web token whose payload is our user id
            content : String
        }
    };

    //master role definition - defines a role with full access to all of our DB objects

    root.masterRole = function()
    {
        var resources = _.reduce(root.Json,keys(), function(key, accumulator)
        {
            return accumulator.push({resource : key, actions: [{name : 'get'}, {name : 'set'}, {name : 'delete'}]});
        });
        return {
            id : new uuid.v4(),
            name : 'master',
            access : resources
        };
    };

    root.Schemas = {
        author : new mongoose.Schema(root.Json.author, { autoIndex : false})
        ,
        post :  new mongoose.Schema(root.Json.post, {autoIndex : false})
        ,
        comment : new mongoose.Schema(root.Json.comment, {autoIndex : false})
        ,
        user : new mongoose.Schema(root.Json.user, {autoIndex : false})
        ,
        image : new mongoose.Schema(root.Json.image, {autoIndex : false})
        ,
        gallery : new mongoose.Schema(root.Json.gallery, {autoIndex : false})
        ,
        site : new mongoose.Schema(root.Json.site, {autoIndex : false})
        ,
        ban : new mongoose.Schema(root.Json.ban, {autoIndex : false})
        ,
        token : new mongoose.Schema(root.Json.token, {autoIndex : false}),
        role : new mongoose.Schema(root.Json.role),
        key : new mongoose.Schema(root.Json.key),
        theme : new mongoose.Schema(root.Json.theme),
        style : new mongoose.Schema(root.Json.style),
        script : new mongoose.Schema(root.Json.script)

    };

    //quick alias for all of our models
    root.Models = {
        author : mongoose.model('author', root.Schemas.author),
        post : mongoose.model('post', root.Schemas.post),
        comment : mongoose.model('comment', root.Schemas.comment),
        user : mongoose.model('user', root.Schemas.user),
        image : mongoose.model('image', root.Schemas.image),
        gallery : mongoose.model('gallery', root.Schemas.gallery),
        site : mongoose.model('site', root.Schemas.site),
        ban : mongoose.model('ban', root.Schemas.ban),
        token : mongoose.model('token', root.Schemas.token),
        key : mongoose.model('key', root.Schemas.key),
        role : mongoose.model('role', root.Schemas.role),
        theme : mongoose.model('theme', root.Schemas.theme),
        style :  mongoose.model('style', root.Schemas.style),
        script : mongoose.model('script', root.Schemas.script)
    };

    root.ValidResource = function (resource)
    {
        if(!root.Schemas[resource] || !root.Models[resource])
        {
            throw Error("this resource is not defined");
        }
    };

    // Export the ndschemas object for **Node.js**, with
    // backwards-compatibility for the old `require()` API. If we're in
    // the browser, add `ndschemas` as a global object.
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = root;
        }
        exports.ndconfig = root;
    } else {
        global['ndschemas'] = root;
    }
    //if we are using an amd loader...
    if (typeof define === 'function' && define.amd) {
        define('ndschemas', ['mongoose', 'underscore', 'ndconfig', 'hx$'], function() {
            return root;
        });
    }
    return root;

})(mongoose, underscore, ndconfig, hx$);
