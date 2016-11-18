/**
 * Created by David on 11/15/2016.
 */
//our data manager service is used for communication with the server and caching.
//we're assuming that nui has been hoisted into scope, along with  the appropriate dependencies

//TODO : Add http interfaces as service dependencies
NullDelicious.factory('DataManager', function(){
    var service = {};

    //3 minutes of caching by default
    service.CachePeriod = 180;

    service.DataManager = (function(storage, token) {
        var self = this;
        //storage interface derived from angular
        self.storage = storage;
        self.interfaces = nui.interfaces;
        //which objects have been updated and when
        self.storage['Cache'] = {};
        //if we have not been provided a token or the token is not defined, then throw an error
        if (!token && !self.storage[nui.AuthTokenHeader]) {
            throw 'Cannot create data manager without valid token';
        }
        self.token = token ? token : self.storage[nui.AuthTokenHeader];
        //refresh auth token header value
        self.storage[nui.AuthTokenHeader] = self.token;
        //refresh token expiry in current seconds...
        self.storage[nui.TokenExpiration] = nui.GetTime();
    });


    //whether or not we should do a refresh of this data. we return the pull time if we do
    service.DataManager.prototype.RefreshData = (function(key, args) {
        var self = this;
        var storageKey = key;
        //if branch and campaign are in our args, append them to our storage key for caching purposes
        if (args && args['key'] && args['subkey']) {
            storageKey = key + '_' + args['key'] + '_' + args['subkey'];
        }
        //if cached: true, then get the cached value
        var cached = args && args['cached'];
        var nowSeconds = nui.GetTime();

        var lastUpdate = self.storage['Cache'][storageKey];
        var ignoreUpdate = lastUpdate && nowSeconds - lastUpdate < service.CachePeriod && (self.interfaces[key].cache || cached);
        //if within the cache period, and the interface is a cached interface or overridden as cached... signal a cached retrieval
        if (ignoreUpdate) {
            return null;
        } else {
            self.storage['Cache'][storageKey] = nowSeconds;
            return nowSeconds;
        }
    });

    service.DataManager.prototype.Get = (function (key, args) {
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

    service.DataManager.prototype.Set = (function (key, value, args) {
        var self = this;
        var storageKey = key;
        //if key and subkey are in our args, append them to our arguments for storage.
        if (args && args['key'] && args['subkey']) {
            storageKey = key + '_' + args['key'] + '_' + args['subkey'];
        }
        //update the cached data.
        var nowSeconds = nui.GetTime();
        //updates to the cache happen based off of the user input
        self.storage[storageKey] = value;
        self.storage['Cache'][storageKey] = nowSeconds;
        //update the server, return promise
        return self.interfaces[key].set(self.token, value, null, args);
    });

    service.DataManager.prototype.Delete = (function (key, value, args)
    {
        var self = this;
        var storageKey = key;

        //now remove the matching item from storage, if we are caching elements
        if(self.interfaces.cache) {
            hx$.removeFirst(self.storage[storageKey], function (element) {
                return element.id === value.id;
            });
        }
        return self.interfaces[key].delete(self.token, value, null, args);
    });

    //return our data manager service
    return service;
});
