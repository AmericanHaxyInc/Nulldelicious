/**
 * Created by David on 11/15/2015.
 */
"use strict";
var nui = (function($, Q, hx$, Base64)
{
var root = {};

    /* UI components */

    root.ui =
    {
        deleteTemplate : '<button class="nui-delete-button" ng-click="grid.appScope.RemoveRow(this)"></button>'
    };
    /*nui types */

    root.NavTypes =
    {
        Main : 0,
        User: 1,
        Editor : 2,
        Site : 3
    };

    root.EnvironmentUris =
    {
        local : "http://localhost:7777",
        production : "http://nulldelicious.com"
    };

    root.BaseUri = root.EnvironmentUris.local;
    //refactor into constants and routes library
    root.AuthTokenHeader = 'X-ND-TOKEN';
    root.ApiKeyHeader = 'X-ND-APIKEY';
    root.TokenExpiration = 1800;
    root.ApiKey = '';

    //time convention, seconds since epoch
    root.GetTime = (function() {
        return new Date().getTime() / 1000;
    });

    //Encodes our login request for basic http authentication
    root.EncodeLogin = (function (username, password) {
        if (window.btoa) {
            return btoa($.trim(username) + ':' + $.trim(password));
        } else {
            return base64.encode($.trim(username) + ':' + $.trim(password));
        }
    });

    //authorizedRequest Handler for nulldelicious
    //token is our authorization token from the server
    //args includes a list of ajax args to make
    //store is our cacheing store
    root.AuthorizedRequest = (function (token, args, store) {
        var deferred = Q.defer();
        //override beforeSend with our authorization header changes, as well as json content types
        args['beforeSend'] = function (xhr) {
            xhr.setRequestHeader(root.AuthTokenHeader, token);
        };
        args['dataType'] = 'json';
        args['contentType'] = 'application/json; charset=utf-8';

        $.ajax(args).done(function (response) {
            deferred.resolve(response);
            //call storage function on response if defined
            if (store) {
                store(response);
            }
        }).fail(function (response) {
            deferred.reject(response);
        });
        return deferred.promise;
    });

    //cors preflight request
    root.InitCors = (function()
    {
        var deferred = Q.defer();

        $.ajax({
            type: 'OPTIONS',
            url: root.BaseUri + '/Init',
            data: {}
        }).done(function(data, textStatus, response)
        {
            deferred.resolve(response);
        }).fail(function(response)
        {
            deferred.reject('Cors preflight failed');
        })
    });

    root.Login = (function(encoded)
    {
        var deferred = Q.defer();
        $.ajax({
            type: 'GET',
            url: root.BaseUri + '/User/Login',
            data: {},
            beforeSend: function (xhr) { xhr.setRequestHeader('Authorization', 'Basic {0}'.replace('{0}', encoded)); }
        }).done(function (data, textStatus, response) {
            var authResponse = response.getResponseHeader(root.AuthTokenHeader);
            var currentUser = data.user;
            deferred.resolve([authResponse, currentUser]);
        }).fail(function (response) {
            deferred.reject('Login Failed');
        });
        return deferred.promise;
    });




    /* todo : refactor as method for an angular service */

    /*tag constructor, used in tags directive */

    root.tag = (function(text)
    {
        var self = this;
        self.text = text;
    });


    /* site*/
    /*site constructor*/
    root.Site = (function(title, description)
    {
        var self = this;
        self.title = title;
        self.description = description;
        self.id = hx$.Guid();
    });

    /* post */
    /*post constructor*/
    root.Post = (function(title, body, tags, siteId)
    {
        var self = this;
        self.title = title;
        /*html body*/
        self.body = body;
        self.tags = tags;
        self.id = hx$.Guid();
        self.siteId = siteId;
        self.published = true;
        self.date = new Date();
    });

    /*role */
    /* role constructor */
    root.Role = (function(name, siteScoped, userScoped, access, siteId, id)
    {
        var self = this;
        if(!id) {
            self.id = hx$.Guid();
        }
        else
        {
            self.id = id;
        }
        self.name = name;
        self.siteScoped = siteScoped;
        self.userScoped = userScoped;

        //convert access arrays to schema format that the server expects
        var convertedAccess = _.map(access, function(object)
        {
            var convertedActions = _.map(object.actions, function(action)
            {
                return {name : action};
            });
            return {resource: object.resource, actions: convertedActions};
        });
        //use this converted format instead
        self.access = convertedAccess;


        self.siteId = siteId;
    });

    /*user constructor */

    root.User = (function(id, name, first, last, email, gender, password, siteId, roleId){
        var self = this;
        if(!id) {
            self.id = hx$.Guid();
        }
        else
        {
            self.id = id;
        }
        self.name = name;
        self.first = first;
        self.last = last;
        self.email = email;
        self.gender = gender;
        self.password = password;
        self.siteId = siteId;
        self.roleId = roleId;
    });

    /*image constructor */

    root.Image = (function(id, title, file, galleryId, tags, siteId)
    {
        var self = this;
        if(!id) {
            self.id = hx$.Guid();
        }
        else
        {
            self.id = id;
        }
        self.title = title;
        /*data is base 64 encoded data from our file*/
        self.data = file;
        //gallery id is optional
        self.galleryId = galleryId;
        self.tags = tags;
        self.siteId = siteId;
    });

    /*style constructor */

    root.Style = (function(id, name, text, siteId)
    {
        var self = this;
        if(!id) {
            self.id = hx$.Guid();
        }
        else
        {
            self.id = id;
        }
        self.name = name;
        self.text = text;
        self.siteId = siteId;
    });

    root.GetSites = (function(token, store, args)
    {
        //if a query has not been specified, retrieve all sites
        if(!args || !args.query) {
            return root.AuthorizedRequest(token,
                {
                    type: 'GET',
                    url: root.BaseUri + '/site/all/retrieve'
                },
                store);
        }
        else
        //otherwise, retrieve sites that match our query
        {
            var route = root.BaseUri + '/site/query/{key}/{value}'.replace('{key}', args.query.key).replace('{value}', args.query.value);
            return root.AuthorizedRequest(token,
                {
                    type: 'GET',
                    url: route
                },
                store);
        }
    });

    root.AddSite = (function(token, site, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'POST',
                url: root.BaseUri + '/site',
                data: JSON.stringify(site)
            },
            store);
    });

    root.DeleteSite = (function(token, site, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'DELETE',
                url: root.BaseUri + '/site/' + site.id

            },
            store);
    });

    /*post*/
    root.GetPosts = (function(token, store, args)
    {
        //if a query has not been specified, retrieve all posts
        if(!args || !args.query) {
            return root.AuthorizedRequest(token,
                {
                    type: 'GET',
                    url: root.BaseUri + '/post/all/retrieve'
                },
                store);
        }
        //otherwise, retrieve posts that match our query
        else
        {
            var route = root.BaseUri + '/post/query/{key}/{value}'.replace('{key}', args.query.key).replace('{value}', args.query.value);
            return root.AuthorizedRequest(token,
                {
                    type: 'GET',
                    url: route
                },
                store);
        }
    });

    root.AddPost = (function(token, post, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'POST',
                url: root.BaseUri + '/post',
                data: JSON.stringify(post)
            },
            store
        );
    });

    root.DeletePost = (function(token, post, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'DELETE',
                url: root.BaseUri + '/post/' + post.id

            },
            store);
    });

    /*users*/

    root.GetUsers = (function(token, store, args)
    {
        if(!args || !args.query) {
            return root.AuthorizedRequest(token,
                {
                    type: 'GET',
                    url: root.BaseUri + '/user/all/retrieve'
                },
                store
            );
        }
        //otherwise, retrieve users that match our query
        else
        {
            var route = root.BaseUri + '/user/query/{key}/{value}'.replace('{key}', args.query.key).replace('{value}', args.query.value);
            return root.AuthorizedRequest(token,
                {
                    type: 'GET',
                    url: route
                },
                store);
        }
    });

    root.AddUser = (function(token, user, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'POST',
                url: root.BaseUri + '/user',
                data: JSON.stringify(user)
            },
            store
        );
    });

    root.DeleteUser = (function(token, user, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'DELETE',
                url: root.BaseUri + '/user/' + user.id

            },
            store);
    });

    /*images*/

    root.GetImages = (function(token, store, args)
    {
        if(!args || !args.query) {
            return root.AuthorizedRequest(token,
                {
                    type: 'GET',
                    url: root.BaseUri + '/image/all/retrieve'
                },
                store
            );
        }
        //otherwise, retrieve images that match our query
        else
        {
            var route = root.BaseUri + '/image/query/{key}/{value}'.replace('{key}', args.query.key).replace('{value}', args.query.value);
            return root.AuthorizedRequest(token,
                {
                    type: 'GET',
                    url: route
                },
                store);
        }
    });

    root.AddImage = (function(token, image, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'POST',
                url: root.BaseUri + '/image',
                data : JSON.stringify(image)
            },
            store
        );
    });

    root.DeleteImage = (function(token, image, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'DELETE',
                url: root.BaseUri + '/image/' + image.id

            },
            store);
    });

    /*styles */

    root.GetStyles = (function(token, store, args)
    {
        if(!args || !args.query) {
            return root.AuthorizedRequest(token,
                {
                    type: 'GET',
                    url: root.BaseUri + '/style/all/retrieve'
                },
                store
            );
            //otherwise, retrieve themes that match our query
        }
        else
        {
            var route = root.BaseUri + '/style/query/{key}/{value}'.replace('{key}', args.query.key).replace('{value}', args.query.value);
            return root.AuthorizedRequest(token,
                {
                    type: 'GET',
                    url: route
                },
                store);
        }
    });

    root.AddStyle = (function(token, style, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'POST',
                url: root.BaseUri + '/style',
                data : JSON.stringify(style)
            },
            store
        );
    });

    root.DeleteStyle = (function(token, style, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'DELETE',
                url: root.BaseUri + '/style/' + style.id

            },
            store);
    });

    /*themes*/

    root.GetThemes = (function(token, store, args)
    {
        if(!args || !args.query) {
            return root.AuthorizedRequest(token,
                {
                    type: 'GET',
                    url: root.BaseUri + '/theme/all/retrieve'
                },
                store
            );
            //otherwise, retrieve themes that match our query
        }
        else
            {
                var route = root.BaseUri + '/theme/query/{key}/{value}'.replace('{key}', args.query.key).replace('{value}', args.query.value);
                return root.AuthorizedRequest(token,
                    {
                        type: 'GET',
                        url: route
                    },
                    store);
            }
    });

    root.AddTheme = (function(token, theme, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'POST',
                url: root.BaseUri + '/theme',
                data : JSON.stringify(theme)
            },
            store
        );
    });

    root.DeleteTheme = (function(token, theme, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'DELETE',
                url: root.BaseUri + '/theme/' + theme.id

            },
            store);
    });
    /*roles */

    root.GetRoles = (function(token, store, args)
    {
        if(!args || !args.query) {
            return root.AuthorizedRequest(token,
                {
                    type: 'GET',
                    url: root.BaseUri + '/role/all/retrieve'
                },
                store
            );
            //otherwise, retrieve themes that match our query
        }
        else
        {
            var route = root.BaseUri + '/role/query/{key}/{value}'.replace('{key}', args.query.key).replace('{value}', args.query.value);
            return root.AuthorizedRequest(token,
                {
                    type: 'GET',
                    url: route
                },
                store);
        }
    });

    root.AddRole = (function(token, theme, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'POST',
                url: root.BaseUri + '/role',
                data : JSON.stringify(theme)
            },
            store
        );
    });

    root.DeleteRole = (function(token, theme, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'DELETE',
                url: root.BaseUri + '/role/' + theme.id

            },
            store);
    });

    /* preset calls, and specific endpoints */
    root.GetPresetSchemas = (function (token, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'GET',
                url: root.BaseUri + '/preset/schemas'
            },
        store);
    });

root.interfaces = {
    'Site' : {get : root.GetSites, set : root.AddSite, delete : root.DeleteSite, cache: false},
    'Post' : {get : root.GetPosts, set : root.AddPost, delete : root.DeletePost, cache: false},
    'User' : {get : root.GetUsers, set : root.AddUser, delete : root.DeleteUser, cache: false},
    'Image' : {get : root.GetImages, set : root.AddImage, delete : root.DeleteImage, cache: false},
    /*themes are our literal ui templates that compose the other elements */
    'Theme' : {get : root.GetThemes, set : root.AddTheme, delete : root.DeleteTheme, cache: false},
    'Role' : {get : root.GetRoles, set : root.AddRole, delete : root.DeleteRole, cache: false},
    /* preset schema call -> for bootstrapped data */
    'Presets' : {get : root.GetPresetSchemas, cache: false},
    'Style' : {get : root.GetStyles, set : root.AddStyle, delete : root.DeleteStyle, cache: false}
};
return root;
})($, Q, hx$, Base64);

window['nui'] = nui;


