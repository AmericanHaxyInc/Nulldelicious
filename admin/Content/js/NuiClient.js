/**
 * Created by David on 11/15/2015.
 */
"use strict";
var nui = (function($, Q, hx$, Base64)
{
var root = {};

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

    root.DataManager = (function(storage, token) {
        var self = this;
        //storage interface derived from angular
        self.storage = storage;
        self.interfaces = root.Interfaces;
        //which objects have been updated and when
        self.storage['Cache'] = {};
        //if we have not been provided a token or the token is not defined, then throw an error
        if (!token && !self.storage[root.AuthTokenHeader]) {
            throw 'Cannot create data manager without valid token';
        }
        self.token = token ? token : self.storage[root.AuthTokenHeader];
        //refresh auth token header value
        self.storage[root.AuthTokenHeader] = self.token;
        //refresh token expiry in current seconds...
        self.storage[root.TokenExpiration] = root.GetTime();
    });


    //whether or not we should do a refresh of this data. we return the pull time if we do
    root.DataManager.prototype.RefreshData = (function(key, args) {
        var self = this;
        var storageKey = key;
        //if branch and campaign are in our args, append them to our storage key for caching purposes
        if (args && args['key'] && args['subkey']) {
            storageKey = key + '_' + args['key'] + '_' + args['subkey'];
        }
        //if cached: true, then get the cached value
        var cached = args && args['cached'];
        var nowSeconds = root.GetTime();

        var lastUpdate = self.storage['Cache'][storageKey];
        var ignoreUpdate = lastUpdate && nowSeconds - lastUpdate < root.CachePeriod && (self.interfaces[key].cache || cached);
        //if within the cache period, and the interface is a cached interface or overridden as cached... signal a cached retrieval
        if (ignoreUpdate) {
            return null;
        } else {
            self.storage['Cache'][storageKey] = nowSeconds;
            return nowSeconds;
        }
    });

    root.DataManager.prototype.Get = (function (key, args) {
        var self = this;
        //check refresh
        var refreshTime = self.RefreshData(key, args);
        var storageKey = key;
        //if key and subkey are in our args, index this cached data by these keys
        if (args && args['key'] && args['subkey']) {
            storageKey = key + '_' + args['key'] + '_' + args['subkey'];
        }
        if (refreshTime !== null) {
            //return promise of data, also caching our data
            return self.interfaces[key].get(self.token, function(data) { self.storage[storageKey] = data; }, args);
        } else {
            //otherwise, grab this directly from storage;
            var deferred = Q.defer();
            deferred.resolve(self.storage[storageKey]);
            return deferred.promise;
        }
    });

    root.DataManager.prototype.Set = (function (key, value, args) {
        var self = this;
        var storageKey = key;
        //if branch and campaign are in our args, append them to our storage key for caching purposes
        if (args && args['key'] && args['subkey']) {
            storageKey = key + '_' + args['key'] + '_' + args['subkey'];
        }
        //update the cached data.
        var nowSeconds = root.GetTime();
        //updates to the cache happen based off of the user input
        self.storage[storageKey] = value;
        self.storage['Cache'][storageKey] = nowSeconds;
        //update the server, return promise
        return self.interfaces[key].set(self.token, value, null, args);
    });

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

        $.ajax(args).success(function (response) {
            deferred.resolve(response);
            //call storage function on response if defined
            if (store) {
                store(response);
            }
        }).error(function (response) {
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
        }).success(function(data, textStatus, response)
        {
            deferred.resolve(response);
        }).error(function(response)
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
        }).success(function (data, textStatus, response) {
            var authResponse = response.getResponseHeader(root.AuthTokenHeader);
            var currentUser = data;
            deferred.resolve([authResponse, currentUser]);
        }).error(function (response) {
            deferred.reject('Login Failed');
        });
        return deferred.promise;
    });

    /*UI configurations*/

    root.Ui = {
        DeleteTemplate : '<button class="nui-delete-button"></button>'
    };

    /*end UI configurations*/

    root.GetSites = (function(token, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'GET',
                url: root.BaseUri + '/Site/All',
                data: {}
            },
            store);
    });

    root.AddSite = (function(token, site, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'POST',
                url: root.BaseUri + '/Site',
                data: JSON.stringify(site)
            },
            store);
    });

    root.GetPosts = (function(token, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'GET',
                url: root.BaseUri + '/Post/All',
                data: {}
            },
            store);
    });

    root.AddPost = (function(token, post, store)
    {
        return root.AuthorizedRequest(token,
            {
                type: 'POST',
                url: root.BaseUri + '/Site',
                data: Json.stringify(post)
            },
            store
        );
    });

root.interfaces = {
    'Site' : {get : root.GetSites, set : root.AddSite, cache: false},
    'Post' : {get : root.GetPosts, set : root.AddPost, cache: false}

};
return root;
})($, Q, hx$, Base64);

window['nui'] = nui;


