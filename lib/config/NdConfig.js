//module dependencies
var fs = require('fs');
var q = require('q');
var path = require('path');

//dependencies: fs. we only use an amd define if applicable
(function (fs, q)
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

     root.Loaded = false;


	 //Load procedure for config
     root.Load = (function (fn, relativePath) {
	 var relPath = master;
	 if(relativePath !== undefined)
	 {
		 relPath = path.join(relativePath, master);
		 // concat path to form relative path of config directory
	 }
	 //this will mark our file as loaded
	 fs.readFile(relPath,
		 function(err, data){
			 if(err) throw err;
			 root.Buff = data;
			 //now validate data
			 if(!root.Validate())
			 {
				 return new Error('master.cfg is missing a critical section');
			 }
			 root.Loaded = true;
			 fn(JSON.parse(root.Buff.toString('utf8')));

		 });
     });

     root.Validate = (function () {
	 //this is where we validate we have certain structural elements in our json
	 var cfg = JSON.parse(root.Buff.toString('utf8'));
	 var result = 0;
	 for(item in root.Sections)
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
			fn(JSON.parse(root.Buff.toString()));
	 }
     });
	//executes fn if key exists in middleware in master cfg, if not, does nothing
	 root.MiddleWare = (function(key, fn, relativePath) {
		 if(!root.Loaded) {
			 root.Load(function(cfg)
			 {
				 if(cfg.middleware[key])
				 {
					 fn(cfg);
				 }
			 }, relativePath);
		 }
		 else
		 {
			 var value = JSON.parse(root.Buff.toString());
			 if(value.middleware[key]) {
				 fn(value);
			 }
		 }
	 });
     root.mongodbUri = (function (fn) {
		 if(!root.Loaded) {
			 root.Load(fn);
		 }
		 else {
			 return fn(Json.parse(root.Buff.toString('utf8')).mongo.mongodbUri);
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
 })(fs, q);