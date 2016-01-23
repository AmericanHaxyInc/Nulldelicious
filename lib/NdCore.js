//dependencies
//mongoose for ODM
//underscore for general util
//ndconfig for bootstrapping config information
//hx$ for general util
//moment, token negotiation and time diff
//crypto, token negotiation
//jsonwebtoken, for... api keys
//uuid... for uuids... duh

var mongoose = require('mongoose');
var underscore = require('underscore');
var ndconfig = require('./config/Ndconfig.js');
var hx$ = require('./HaxyClosures.js');
var moment = require('moment');
var crypto = require('crypto');
//for creating secure json web tokens
var jwt = require('jsonwebtoken');
var uuid = require('node-uuid');

var Q = require('q');
	(function(mongoose, underscore, ndconfig, hx$, moment, crypto, jwt, uuid)
       {
	   var root = {};

	   root.timeout = 1000;
	   root.errors = [];
	   
	   
//these are the unexpanded schemas that we are using in our blog format
//does not include auth tables
		//pure json representation of our typed schemas
		root.Json = {
			'author' : {
				id : String,
				name : String,
				imageId : {type : String, index: true},
				userId : {type : String, index: true}
			},
			'post' : {
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
				published : Boolean
			},
			'comment' : {
				id : {type : String, index : true},
				body : String,
				userId : {type : String, index: true},
				postId : {type : String, index: true}
			},
			'user' : {
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
			'image' : {
				id : String,
				title : String,
				data : Buffer,
				galleryId : {type : String, index: true},
				tags : [{name : {type : String, index: true}}]
			},
			'theme' : {
				id : String,
				name : String,
				data : Buffer

			},
			'gallery' : {
				id : String,
				title : String,
				description : String,
				siteId : {type : String, index: true}
			},
			'site' : {
				id : String,
				title : String,
				description : String
			},
			'globalSettings': {
				id : String,
				/*can be used to temporarily enable / disable commenting */
				enableComments : Boolean,
				/*enables google analytics for site*/
				enableAnalytics : Boolean,
				/*chosen theme >> css styles for generated null delicious elements*/
				themeName : String,
				siteId : String
			},
			'ban' : {
				id : String,
				reason : String,
				ip : String,
				date : {type : Date, default : Date.now},
				userId : {type : String, index: true}
			},
			'token' : {
				id: String,
				duration: Number,
				issued: Date,
				content : String,
				userId : {type : String, index: true},
				roleId : {type : String, index: true}
			},
			'role' : {
				id : String,
				name : String,
				//resource name and restful routes that this role has access to
				access : [{resource : String, actions: [{name : String}]}]
			},
			'key' : {
				id: String,
				//this is an encoded JSON web token whose payload is our user id
				content : String
			}
		};

	   root.Schemas = {
	       'author' : new mongoose.Schema(root.Json.author, { autoIndex : false})
		   ,
	       'post' :  new mongoose.Schema(root.Json.post, {autoIndex : false})
		   ,
	       'comment' : new mongoose.Schema(root.Json.comment, {autoIndex : false})
           ,
	       'user' : new mongoose.Schema(root.Json.user, {autoIndex : false})
           ,
	       'image' : new mongoose.Schema(root.Json.image, {autoIndex : false})
	       ,
	       'gallery' : new mongoose.Schema(root.Json.gallery, {autoIndex : false})
	       ,
	       'site' : new mongoose.Schema(root.Json.site, {autoIndex : false})
           ,
	       'ban' : new mongoose.Schema(root.Json.ban, {autoIndex : false})
		   ,
		   'token' : new mongoose.Schema(root.Json.token, {autoIndex : false}),
		   'role' : new mongoose.Schema(root.Json.role),
		   'key' : new mongoose.Schema(root.Json.key)

	   };

	   //quick alias for all of our models
	   root.Models = {
	       'author' : mongoose.model('author', root.Schemas.author),
	       'post' : mongoose.model('post', root.Schemas.post),
	       'comment' : mongoose.model('comment', root.Schemas.comment),
	       'user' : mongoose.model('user', root.Schemas.user),
	       'image' : mongoose.model('image', root.Schemas.image),
	       'gallery' : mongoose.model('gallery', root.Schemas.gallery),
	       'site' : mongoose.model('site', root.Schemas.site),
	       'ban' : mongoose.model('ban', root.Schemas.ban),
		   'token' : mongoose.model('token', root.Schemas.token),
		   'key' : mongoose.model('key', root.Schemas.key),
		   'role' : mongoose.model('role', root.Schemas.role)
	   };


		root.StripModuleId = (function (name) {
			//returned undefined if not a valid module name
			if (name.indexOf("id") > -1 && name !== "id") {
				return name.substring(0, name.indexOf("id"));
			}
			return undefined;
		});

		//generates an array of edges [model], [model, name], [name1, name2], etc that represents our dependency chain
		root.GenerateDependencies = (function(model, dependencies)
		{
			if(!dependencies)
			{
				dependencies = [[model]];
			}
			if(root.Schemas[model])
			{
				for(var member in root.Schemas[model]) {
					var name = root.StripModuleId(member);
					//if the name exists and it isn't contained in our collection...
					if(name != undefined && !hx$.singleOrDefault(dependencies, function(element){return element[1] === name})) {
						//if we follow the standard foreign key relationship of our model by convention
						dependencies.push([model, name]);
						//add this dependency and search further
						dependencies = root.GenerateDependencies(name, dependencies);
					}
				}
				return dependencies;
			}
		});

		root.GenerateIdMap = (function (dependencies, Id) {
			var head = dependencies.shift();
			var idMap = {head : Id};
			//discard head
			dependencies = dependencies.shift();
			for (var element in dependencies)
			{
				//keys and values for our edges in the spanning tree
				var key = dependencies[element][0];
				var value = dependencies[element][1];
				var fKeyName = key + 'Id';
				var Ids = [];
				//need to change this to an IN style query on mongo
				root.Models[value].find(fKeyName).select(fKeyName).exec(function(error, result)
				{
					if (error) hx$.Log(error);
					Ids = result[fKeyName];
					//add mapping
					idMap[value] = Ids;
				});

			}
			return idMap;
		});

	       //helper function for generating route
	       root.GenerateRoute = (function(args)
				       {
					   var self = this;
					   //resulting route takes the form "arg/arg/arg"
					   return hx$.ApplyArgs(arguments, function(arg, accumulator){return '/' + arg;});
				       });

	   root.connection = {
	       'connect' : (function(fn, relativePath){


	   if(root.connection.connected)
		   {
			   //if we've already connected, execute our callback
			   fn();
		       return;
		   }
		   ndconfig.Value(function(cfg)
		   {
			mongoose.connect(cfg.mongo.mongodbUri);
		    root.connection.connection = mongoose.connection;
		    root.connection.connection.on('error',
				function()
				{
					hx$.Log('connection error when attempting to connect to mongodb on URI : ' + cfg.mongo.mongodbUri)
				}
			);
		    //once we are open, we set our connection property in this module
		    root.connection.connection.once('open', function(){
		    	root.connection.connected = true;
				fn();
			   });
		   }, relativePath);

	       }),
	       'connected' : false,
	       'connection' : null,
	       'connectionTimeout' : false

	   };
	   //there are two forms of authentication, absolute and resource based.
		//absolute happens when master passwords are configured in master.cfg
		//and the correct hashed password is provided
       root.authentication = {

		   //error handling in deferred scope in auth
		   'checkAuthError' : (function(err, deferred)
		   {
			   if(err) {
				   hx$.Log(err);
				   deferred.reject(new Error('authorization failed'));
				   return true;
			   }
			   return false;
		   }),
		   'generateToken' : (function(authCfg, responseHeaders, userid, roleid)
		   {
			   //set token, and add token auth header.
			   var tokenModel = mongoose.model('token', root.Schemas.token);
			   var token = new tokenModel({
				   id: uuid.v4(),
				   content : uuid.v4(),
				   issued : new Date(),
				   duration : authCfg.tokenDuration,
				   userid : userid,
				   roleid : roleid
			   });
			   token.save();
			   responseHeaders[root.authentication.authToken] = token.content;
		   }),
		   //returns a promise of a generated api key
		   'createKey' : (function(authHeaders, userId, responseHeaders, relativePath)
		   {
			   //create our own promise scope here, and resolve it with the results of root.interfaces.Set key
			   var deferred = Q.defer();
			   //first thing, authenticate
			   var authenticated = root.authentication.authenticate(authHeaders, 'key', 'set', responseHeaders, relativePath);
			   authenticated.then(function(principle)
			   {
				   //verify that the creation request is well-formed
				   if(userId == undefined)
				   {
					   deferred.reject(new Error('Cannot create a key without a defined user identity '));
				   }
				   //now retrieve our private key value
				   ndconfig.Value(function(authCfg)
				   {
					   var id = uuid.v4();
					   var privateKey = authCfg.tokenPrivateKey;
					   //now sign our json web token and return it to the user.
					   var payload = JSON.stringify({id : userId});
					   var content = jwt.sign(payload,
						   					  privateKey,
						   					  {
												  algorithm: 'HS256',
												  issuer : authCfg.application.url,
											      subject : userId,
												  noTimestamp : true
											  });
					   root.interfaces.SetId('key', id, {id: id, content : content}, principle).then(function(result)
					   {
						   deferred.resolve(result);
					   }).catch(function(error)
					   {
						   deferred.reject(error);
					   });
				   });
			   }).catch(function(ex)
			   {
				   deferred.reject(ex);
			   });
			   return deferred.promise;
		   }),
		   'authenticateApiKey' : (function(key, authCfg, deferred, responseHeaders)
		   {
			   var model = mongoose.model('key', root.Schemas['key']);
				//find an element matching our key
			   model.findOne({content : key}, function(err, element)
			   {
				   if(err)
				   {
					   deferred.reject(new Error('Authorization failure. Invalid Api Key'));
				   }
				   else
				   {
					   var privateKey = authCfg.tokenPrivateKey;
					   //decode this json web token
					   var decoded = jwt.verify(element.content, privateKey , {algorithm: 'HS256'}, function(err, decoded)
					   {
						   if (err)
						   {
							   deferred.reject(new Error('Authorization failure. Invalid Api Key'));
						   }
						   else
						   {
							   var result = decoded;
							   var userId = decoded.id;

							   //now, get our user and role context

							   var userModel = root.Models.user;
							   var roleModel = root.Models.role;

							   userModel.findOne({'id' : userId}, function(err, user)
							   {
								   if(err)
								   {
									   deferred.reject(new Error('Authorization failure. Invalid Api Key'));
								   }
								   else
								   {
									   var roleId = user.roleId;
									   roleModel.findOne({'id' : roleId}, function(err, role)
									   {
										   if (err)
										   {
											   deferred.reject(new Error('Authorization failure. Invalid Api Key'));
										   }
										   //generate token
										   root.authentication.generateToken(authCfg, responseHeaders, user.id, roleId);

										   //now assign principle
										   var principle = new root.authentication.Principle({
											   name: user.name,
											   role: role.access,
											   master: 0,
											   id: user.id
										   });
										   deferred.resolve(principle);

									   });
								   }
							   });
						   }
					   });

				   }
			   });
		   }),
		   //returns a set of principle given a plaintext username and password, cfg scope and promise scope
		   'authenticatePassword' : (function(user, password, authCfg, deferred, responseHeaders)
		   {
				   /*check the master authentication record to see if master auth is enabled and if a master password is set*/
				   if(user === authCfg.master.uname && authCfg.master.masterEnabled)
				   {
					   var digest = root.authentication.hash(password, authCfg.master.hash);
					   //hash and compare, then return principle
					   if(digest === authCfg.master.password)
					   {
						   //return a principle with master
						   var principle = new root.authentication.Principle({name : user, role: {}, master : 1});
						   deferred.resolve(principle);
					   }
					   else
					   {
						   deferred.reject(new Error('Authorization failure. password does not match'));
					   }
				   }
				   //otherwise, attempt to authenticate user and password against our mongo user store
				   else {
					   var model = root.Models.user;
					   model.findOne({'name': user}, function (err, usr) {
						   if (!root.authentication.checkAuthError(err, deferred)) {
							   //now hash password and check against user entry.
							   if (usr.password === root.authentication.hash(password, authCfg.master.hash)) {
								   root.authentication.generateToken(authCfg, responseHeaders);

								   //find roles and return principle
								   var role = root.Models.role;
								   role.findOne({'id': usr.roleId}, function (err, role) {
									   if (!root.authentication.checkAuthError(err, deferred)) {
										   //now assign principle
										   var principle = new root.authentication.Principle({
											   name: usr.name,
											   role: role.access,
											   master: 0,
											   id: usr.id
										   });
										   deferred.resolve(principle);
									   }
								   });
							   }
							   else
							   {
								   deferred.reject(new Error('Authorization failure. password does not match'));
							   }
						   }
					   });
				   }
		   }),
		   //authentication is controlled by type of resource, and auth headers passed
		   'authenticate' : (function(authHeaders, resource, inrface, responseHeaders, relativePath)
		   {
			   var deferred = Q.defer();
			   ndconfig.Value(function(authCfg) {
				   var user = authHeaders[root.authentication.authUser.toLowerCase()];
				   var password = authHeaders[root.authentication.authPw.toLowerCase()];
				   var token = authHeaders[root.authentication.authToken.toLowerCase()];
				   var apiKey = authHeaders[root.authentication.authApiKey.toLowerCase()];
				   //authorization header
				   var authorization = authHeaders['Authorization'];
				   //first check for basic http authentication against our user store
				   if (authorization) {
					   if(authorization.contains('Basic'))
					   {
						   //re-hydrate our username and password from base 64 string
							var base64 = authorization.split("Basic ")[1];
							var plainText = atob(base64);
						    var userText = plainText.split(':')[0];
						    var passwordText = plainText.split(':')[1];

						   //now, authenticate this username and password, bubbling up authentication promise
						   root.authenticatePassword(userText, passwordText, authCfg, deferred, responseHeaders);
					   }
					   else
					   {
						   deferred.reject('authorization failed');
					   }
				   }
				   //if token is present, attempt to validate token
				   if (token) {
					   var valid = 0;
					   var model = root.Models.token;
					   root.findOne({'content': token}, function (err, tk) {
						   if(!root.authentication.checkAuthError(err, deferred))
						   {
						   //diff token and time to see if this is still valid
						   //switch this from mongo to memcache to possibly improve performance
						   var issued = moment(tk.issued);
						   var current = moment();
						   if (current.diff(issued, 'minutes') <= tk.duration) {
							   //find the associated role and create our principle
							   var role = root.Models.role;
							   role.findOne({'id': tk.roleId}, function (err, role) {
								   if(!root.authentication.checkAuthError(err, deferred))
								   {
									   //need the user for our principal
									   var userModel = root.Models.user;
									   userModel.findOne({'id': tk.userId}, function (err, usr) {
										   if(!root.authentication.checkAuthError(err, deferred))
										   {
											   var principle = new root.authentication.Principle({
												   name: usr.name,
												   role: role.access,
												   master: 0,
												   id: usr.id
											   });
											   deferred.resolve(principle);
										   }
									   });
								   }
							   })
						   }

						   }
						   else {
							   deferred.reject(new Error('authorization failed'));
						   }
					   });
				   }
				   else if (apiKey)
				   {
					   root.authentication.authenticateApiKey(apiKey, authCfg, deferred, responseHeaders);
				   }
				   else if (user && password){
						   root.authentication.authenticatePassword(user, password, authCfg, deferred, responseHeaders);
				   }
			   }, relativePath);
			   return deferred.promise;
		   }),
		   'authUser' : 'X-ND-USER',
		   'authPw' : 'X-ND-SECRET',
		   'authToken' : 'X-ND-TOKEN',
		   'authApiKey' : 'X-ND-APIKEY',
		   'xsrfToken' : 'ND-XSRF-TOKEN',
		   //principle object we pass along to core interfaces
		   'Principle' : function(obj)
		   {
			   var self = this;
			   //a role is an array of resource access, and named interfaces
			   self.role = obj.role;
			   self.name = obj.name;
			   //if this is 1, then we have unrestricted access, 0 role based.
			   self.master = obj.master;
			   self.id = obj.id;
		   },
		   'hash' : (function(string, hashMethod)
		   {
			   if(hashMethod == undefined)
			   {
				   hashMethod = 'sha256';
			   }

			   var hash = crypto.createHash(hashMethod);
			   //pass our string to the hash
			   hash.update(string);
			   //now return the digest
			   return hash.digest('hex');
		   })
	   };
		//principle validation for specific interface
		root.authentication.Principle.prototype.ValidateForInterface = function(resource, action)
		{
			var self = this;
			//first check to see if we have master access
			if(self.master === 1)
			{
				return true;
			}
			var resourceAccess = hx$.single(self.role, function(element)
			{
				return element.resource === resource;
			});
			//if this role is not defined in our principle, bail
			if(resourceAccess == undefined) {
				throw new Error('Failed to validate principle for interface with resource: ' + resource);
			}
			var actionAccess = hx$.single(resourceAccess.actions, function(element)
			{
				return element.name === action;
			});
			if (actionAccess == undefined)
			{
				throw new Error('Failed to validate principle for interface with action: ' + action);
			}
			else
			{
				return true;
			}
		};

	   root.filters = {
		   'user' : [{name : 'password', func : 'hashpw', type : 'field'}],
		   'filters' : {
			   'hashpw': (function (pw) {
				   var hashDigest = root.authentication.hash(pw);
				   return hashDigest;
			   })
		   }

	   };

		//filter objects represent a function transform that is performed on a DTO as it passes through an interface
		root.filters.types = {
			//field level transforms
			'field' : 0,
			//transforms that require the record
			'record' : 1
		};

		//joins represent relational joins for de-normalizing data as it is queried
	   //for now these are just used to return adjacent nodes in the relational map
	   root.joins = {
		   "post": ["author", "site"],
		   "author": ["user"],
		   "ban": ["user"],
		   "user": ["site", "role"]
	   };
	   
	   //helper function for joining models once they have been returned.
		//uses internal _doc access and assumes singleton cardinality;
           root.joinModels = (function(m1, m2, m1name, m2name)
			      {
				  //m1 is a set of elements, and m2 is a single element
				  hx$.foreach(m1, function(element) {
					  	//adds the properties of m2 that are in schemas (not id or fks) to m1
					  	for (var property in m2._doc) {
							//for each property in m2 that is a schema property
						  	if (m2._doc.hasOwnProperty(property) && root.Json[m2name][property] !== undefined) {
							  	// copy if not fk or id
							  	if 	(property.toLowerCase().indexOf("id") < 0) {
								  	//properties in m1 are underscore delimited with the name of m2
								  	//in the de-normalized object
								  	element[m2name + '_' + property] = m2._doc[property]
							      }
						      }
					      }
				      });
					  return m1;
				  });
		//this is a version of join models that returns an incremental dataset
		root.joinModelsIncremental  = (function(m1, m2, m1name, m2name)
		{
			var changeset = {};
			//m1 is a set of elements, and m2 is a single element
			hx$.foreach(m1, function(element) {
				//adds the properties of m2 that are in schemas (not id or fks) to m1
				for (var property in m2._doc) {
					//for each property in m2 that is a schema property
					if (m2._doc.hasOwnProperty(property) && root.Json[m2name][property] !== undefined) {
						// copy if not fk or id
						if 	(property.toLowerCase().indexOf("id") < 0) {
							//properties in m1 are underscore delimited with the name of m2
							//in the de-normalized object
							changeset[m2name + '_' + property] = m2._doc[property]
						}
					}
				}
			});
			return changeset;
		});

	   root.ValidResource = (function (resource)
	   {
		   if(!root.Schemas[resource] || !root.Models[resource])
		   {
			   throw Error("this resource is not defined");
		   }
	   });

	   root.interfaces = {
		   //dnorm is the list of resources that have been added to the object, denormalized
	       "GetId" : (function(resource, idValue, dnorm, single, principle){
		   principle.ValidateForInterface(resource, 'get');
		   //mark this node as visited
		   if(dnorm === undefined) dnorm = [];
		   dnorm.push(resource);

		   var deferred = Q.defer();
		   var model = mongoose.model(resource, root.Schemas[resource]);
		   root.connection.connect(function() {
			   //find, and then recursively build relational object
			   model.findOne({id: idValue}, function (err, elements) {
				   if (err) {
					   hx$.Log(err);
					   deferred.reject(new Error(err));
				   }
				   else {
					   //recursive build of denormalized model.
					   var joins = root.joins[resource] !== undefined ? hx$.exclude(root.joins[resource], dnorm) : undefined;
					   if(joins !== undefined && joins.length > 0 && single !== 1)
					   {
						   //composite promise for datasets to add to elements
						   //eliminates all remaining joins
						   Q.all(hx$.select(joins, function(join)
						   {
							   var changeset = Q.defer();
							   //if this join is not already in our collection of joins, do a subquery
							   //this is to avoid circular subquerying
							   var In = hx$.single(dnorm, function(element){return element == join});
							   if(In === undefined) {
								   dnorm.push(join);
								   //join with the first element found
									root.interfaces.GetId(join, elements[join + 'Id'], dnorm, 1, principle).then(function(element)
									{
										var diff = root.joinModelsIncremental(elements, element, resource, join);
										changeset.resolve(diff);
									});
							   }
							   else
							   {
								   //if this is already in our list of joins, the changeset is empty
								   changeset.resolve({});
							   }
							   return changeset.promise;

						   })).then(function(result)
						   {
							   hx$.foreach(result, function(change)
							   {
									hx$.AddProps(elements, change);
							   });
							   deferred.resolve(elements);
						   });
					   }
					   else
					   {
						   //terminal case
						   deferred.resolve(elements);
					   }

				   }
			   });
		   });
		   return deferred.promise;
	       }),
	       "SetId" : (function(resource, idValue, resourceValue, principal){
			   principal.ValidateForInterface(resource, 'set');
			   var model = mongoose.model(resource, root.Schemas[resource]);
			   //if we have any applicable filters, apply them.
			   if(root.filters[resource]!== undefined && root.filters[resource].length > 0)
			   {
				   hx$.foreach(root.filters[resource], function(entry)
				   {
					   var filter = root.filters.filters[entry.func];
					   resourceValue[entry.name] = filter(resourceValue[entry.name]);
				   })
			   }
			   var deferred = Q.defer();
			   //try to find an element, if it does not exist, add it to the DB!
			   //promise scope of get id.
			   model.findOne({id : idValue}, function(err, element)
			   {
				   if(err)
				   {
					   hx$.Log(err);
					   deferred.reject(new Error(err));
				   }
				   else if(element === null)
				   {
					   //if element is null, try saving a new mongoose model
					   var newElement = mongoose.model(resource, root.Schemas[resource]);
					   var item = new newElement(resourceValue);
					   item.save(function (err) {
						   if (err) {
							   hx$.Log(err);
							   deferred.reject(new Error(err));
						   }
						   deferred.resolve(item);
					   });

				   }
				   else if (element !== null)
				   {
					   hx$.CopyProps(element, resourceValue);
					   element.save(function (err)
					   {
						   if(err)
						   {
							   hx$.Log(err);
							   deferred.reject(new Error(err));
						   }
						   deferred.resolve(element);
					   })
				   }

			   });
			   return deferred.promise;
	       }),
		   /*deleteid attempts to delete resource with idValue by doing a dependency delete*/
	       "DeleteId" : (function(resource, idValue, principal){
		   principal.ValidateForInterface(resource, 'delete');
		   var deferred = Q.defer();
		   var element = mongoose.model(resource, root.Schemas[resource]);
		   root.connection.connect(function() {
			   element.findOneAndRemove(hx$.KeyValue('id', idValue), function(error, data)
			   {
				   if(error)
				   {
					   deferred.reject(new Error(err));
				   }
				   else
				   {
					   deferred.resolve(data);
				   }
			   });
		   });
		   return deferred.promise;
	       }),
		   "GetQuery" : (function(resource, key, value, principal) {
		   principal.ValidateForInterface(resource, 'get');

		   var deferred = Q.defer();
		   var element = mongoose.model(resource, root.Schemas[resource]);

		   root.connection.connect(function() {
			   element.find(hx$.KeyValue(key, value), function (err, result) {
				   if (err) {
					   hx$.Log(err);
					   deferred.reject(new Error(err));
				   }
				   deferred.resolve(result);
			   });
		   });
		   return deferred.promise;
	       }),
	       "GetAll" : (function(resource, principal) {
		   principal.ValidateForInterface(resource, 'get');
		   var deferred = Q.defer();
		   var element = mongoose.model(resource, root.Schemas[resource]);
		   root.connection.connect(function() {
			   element.find(function (err, result) {
				   if (err) {
					   hx$.Log(err);
					   deferred.reject(new Error(err));
				   }
				   deferred.resolve(result);
			   });
		   });
		   return deferred.promise;
	       })
	   };
		// Export the ndconfig object for **Node.js**, with
		// backwards-compatibility for the old `require()` API. If we're in
		// the browser, add `ndconfig` as a global object.
		if (typeof exports !== 'undefined') {
		if (typeof module !== 'undefined' && module.exports) {
			exports = module.exports = root;
		}
		exports.ndconfig = root;
		} else {
			global['ndcore'] = root;
		}
		//if we are using an amd loader...
		if (typeof define === 'function' && define.amd) {
			define('ndcore', ['mongoose', 'underscore', 'ndconfig', 'hx$', 'moment', 'crypto'], function() {
				return root;
			});
		}
	       return root;



	   })(mongoose, underscore, ndconfig, hx$, moment, crypto, jwt, uuid);