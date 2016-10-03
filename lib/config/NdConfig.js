//module dependencies
var fs = require('fs');
var Q = require('q');
var path = require('path');
var hx$ = require('.././HaxyClosures.js');

//dependencies: fs. we only use an amd define if applicable
(function (fs, Q, hx$, path)
 {
     var master = 'master.cfg';
	 var buffSize = 100000;
     //max buffer size for our config object
     var root = {};
	 root.master = master;
	 //levels of recursion to search for our master.cfg
	 root.recursion = 3;

     root.Sections = ['auth', 'mongo', 'web', 'master', 'application'];

     root.Buff = new Buffer(buffSize);

	 //init load is used to load
	 root.InitLoad = false;
     root.Loaded = false;
	 //array of callbacks to execute when ndconfig has loaded
	 root.onLoad = [];

	 //string representation of our config
	 root.BufferContent = (function()
	 {
		 return JSON.parse(root.Buff.toString('utf8'));
	 });

	 //Load procedure for config
	 //load should return a promise that indicates whether the fn has been registered or loaded
     root.Load = (function (fn, relativePath) {
		 hx$.log('calling nulldelicious config load');
		 var deferred = Q.defer();
		 if(!root.InitLoad) {
			 hx$.log('initiating load of nulldelicious config');
			 root.InitLoad = true;
			 var relPath = master;
			 if (relativePath !== undefined) {
				 relPath = path.join(relativePath, master);
				 // concat path to form relative path of config directory
			 }
			 hx$.log('reading nulldelicious config');
			 //this will mark our file as loaded
			 fs.readFile(relPath,
				 function (err, data) {
					 if (err) throw err;
					 root.Buff = data;
					 //now validate data
					 if (!root.Validate()) {
						 return new Error('master.cfg is missing a critical section');
					 }
					 var content = root.BufferContent();
					 //now iterate through and call our callbacks
					 hx$.log('executing all registered callbacks');
					 hx$.foreach(root.onLoad, function(callback)
					 {
						 if(typeof callback === 'function')
						 {
							 callback(content);
						 }
					 });
					 deferred.resolve(fn(content));
					 root.Loaded = true;
				 });
		 }
		 else
		 {
			 hx$.log('deferring function call until nulldelicious config is loaded');
			 //otherwise, push the callback onto our list of onLoad callbacks
			 if(!root.Loaded) {
				 root.onLoad.push(fn);
				 deferred.resolve();
			 }
			 else
			 {
				 hx$.log('executing callback function on loaded config')
				 //or if already loaded, simply execute the callback
				 deferred.resolve(fn(root.BufferContent()));

			 }
		 }
		 return deferred.promise;
     });

     root.Validate = (function () {
	 	//this is where we validate we have certain structural elements in our json
	 	var cfg = root.BufferContent();
	 	var result = 0;
	 		for(var item in root.Sections)
	 		{
	    	 	if(cfg[root.Sections[item]] === undefined)
		 		result++;
	 		}
	 	return result === 0;
     });

     //returns the object representation of our config file.
	 //fn is our onload callback
     root.Value = (function (fn, relativePath) {
	 if(!root.Loaded) {
		 root.Load(fn, relativePath);
	 }
	 else
	 	{
			fn(root.BufferContent());
	 	}
     });
	//executes fn if key exists in middleware in master cfg, if not, does nothing
	 //returns a promise when fulfilled, indicates our callback has been registered or config has been loaded
	 root.MiddleWare = (function(key, fn, relativePath) {
		 if(!root.Loaded) {
			 return root.Load(function(cfg)
			 {
				 if(cfg.middleware[key])
				 {
					 fn(cfg.middleware[key]);
				 }
			 }, relativePath);
		 }
		 else
		 {
			 var deferred = Q.defer();
			 var value = root.BufferContent();
			 if(value.middleware[key]) {
				 deferred.resolve(fn(value.middleware[key]));
			 }
			 return deferred.promise;
		 }
	 });
     root.mongodbUri = (function (fn, relativePath) {
		 if(!root.Loaded) {
			 root.Load(fn, relativePath);
		 }
		 else {
			 return fn(root.BufferContent().mongo.mongodbUri);
		 }

     });
	 // Export the ndconfig object for **Node.js**, with
	 // backwards-compatibility for the old `require()` API. If we're in
	 // the browser, add `ndconfig` as a global object.
	 if (typeof exports !== 'undefined') {
		 if (typeof module !== 'undefined' && module.exports) {
			 exports = module.exports = root;
		 }
		 exports.ndconfig = root;
	 } else {
		 global['ndconfig'] = root;
	 }
	 //if we are using an amd loader...
	 if (typeof define === 'function' && define.amd) {
		 define('ndconfig', ['fs', 'q'], function() {
			 return root;
		 });
	 }

     return root;
 })(fs, Q, hx$, path);