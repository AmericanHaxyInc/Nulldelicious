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
var hx$ = require('haxyclosures');
var moment = require('moment');
var crypto = require('crypto');
//for creating secure json web tokens
var jwt = require('jsonwebtoken');
var uuid = require('node-uuid');
var atob = require('atob');

var ndschemas = require('./NdSchemas.js');
var ndfilters = require('./NdFilters.js');

var Q = require('q');
	(function(mongoose, underscore, ndconfig, hx$, moment, crypto, jwt, uuid, ndschemas, ndfilters)
       {
	   var root = {};

	   root.timeout = 1000;
	   root.errors = [];
	   //our config is the loaded ndconfig module, unless we pass in an already loaded config object
	   root.config = ndconfig;

		/*START HELPERS for MONGOOSE updates and de-normalization*/
		root.AssignSchemaPropertiesFromUpdate = (function(element, resourceValue)
		{
			//the property must already exist in the doc to be assigned...
			for(var prop in element._doc)
			{
				//only assign a custom property. Mongoose internals '_' and id fields should not be mutable
				if(element._doc.hasOwnProperty(prop) && prop !== 'id' && prop.indexOf("_") === -1)
				{
					element[prop] = resourceValue[prop];
				}
				element.markModified(prop);
			}
		});

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
			if(ndschemas.Schemas[model])
			{
				for(var member in ndschemas.Schemas[model]) {
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
				ndschemas.Models[value].find(fKeyName).select(fKeyName).exec(function(error, result)
				{
					if (error) hx$.log(error);
					Ids = result[fKeyName];
					//add mapping
					idMap[value] = Ids;
				});

			}
			return idMap;
		});

		/*END HELPERS for MONGOOSE updates and denormalization*/

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
	   else
	   		{
				root.config.Value(function(cfg)
				{
					mongoose.connect(cfg.mongo.mongodbUri);
					root.connection.connection = mongoose.connection;
					root.connection.connection.on('error',
						function()
						{
							hx$.error('connection error when attempting to connect to mongodb on URI : ' + cfg.mongo.mongodbUri)
						}
					);
					//once we are open, we set our connection property in this module
					root.connection.connection.once('open', function(){
						root.connection.connected = true;
						fn();
					});
				}, relativePath);
	   		}
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
				   hx$.log(err);
				   deferred.reject(new Error('authorization failed'));
				   return true;
			   }
			   return false;
		   }),
		   'generateToken' : (function(authCfg, response, userId, roleId, isMaster)
		   {
			   var deferred = Q.defer();
			   hx$.log('generating token for userId: ' + userId);
			   root.connection.connect(function() {
				   //set token, and add token auth header.
				   var tokenModel = mongoose.model('token', ndschemas.Schemas.token);
				   var token = new tokenModel({
					   id: uuid.v4(),
					   content: uuid.v4(),
					   issued: new Date(),
					   duration: authCfg.auth.tokenDuration,
					   userid: userId,
					   roleid: roleId,
					   master: isMaster
				   });
				   token.save(function(err)
				   {
					   if(err)
					   {
						   hx$.error(err);
						   deferred.reject(err);
					   }
					   //to prevent calls in test libs
					   if (response.set) {
						   response.set(root.authentication.authToken, token.content);
					   }
					   deferred.resolve();
				   });
			   });
			   return deferred.promise;
		   }),
		   //returns a promise of a generated api key
		   'createKey' : (function(authHeaders, userId, response, relativePath)
		   {
			   //create our own promise scope here, and resolve it with the results of root.interfaces.Set key
			   var deferred = Q.defer();
			   //first thing, authenticate
			   var authenticated = root.authentication.authenticate(authHeaders, 'key', 'set', response, relativePath);
			   authenticated.then(function(principle)
			   {
				   //verify that the creation request is well-formed
				   if(userId == undefined)
				   {
					   deferred.reject(new Error('Cannot create a key without a defined user identity '));
				   }
				   //now retrieve our private key value
				   root.config.Value(function(authCfg)
				   {
					   var id = uuid.v4();
					   var privateKey = authCfg.tokenPrivateKey;
					   //now sign our json web token and return it to the user.
					   //we must sign this with an issuer, id, and subject
					   var payload = JSON.stringify({id : userId, issuer: authCfg.application.url, subject: userId, timestamp: new Date()});
					   var content = jwt.sign(payload,
						   					  privateKey,
						   					  {
												  algorithm: 'HS256'
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
		   'authenticateApiKey' : (function(key, authCfg, deferred, response)
		   {
			   hx$.log('authenticating api key.');
			   var model = mongoose.model('key', ndschemas.Schemas['key']);
				//find an element matching our key
			   model.findOne({content : key}, function(err, element)
			   {
				   if(err)
				   {
					   deferred.reject(new Error('Authorization failure. Invalid Api Key'));
				   }
				   else
				   {
					   hx$.log('found api key, now decoding and matching the key.')
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

							   var userModel = ndschemas.Models.user;
							   var roleModel = ndschemas.Models.role;
							   // now find the user model, in connection scope
							   root.connection.connect(function() {
								   userModel.findOne({'id': userId}, function (err, user) {
									   if (err) {
										   deferred.reject(new Error('Authorization failure. Invalid Api Key'));
									   }
									   else {
										   var roleId = user.roleId;
										   roleModel.findOne({'id': roleId}, function (err, role) {
											   if (err) {
												   deferred.reject(new Error('Authorization failure. Invalid Api Key'));
											   }
											   //generate token
											   var tokenGenerated = root.authentication.generateToken(authCfg, response, user.id, roleId, false);
											   var principle = new root.authentication.Principle({
												   name: user.name,
												   role: role,
												   master: 0,
												   id: user.id
											   });
											   //now assign principle, contingent upon token generation
											   tokenGenerated.then(function(result)
											   {
												   deferred.resolve(principle);
											   }).catch(function(err)
											   {
												   deferred.reject(err);
											   });
										   });
									   }
								   });
							   });
						   }
					   });
				   }
			   });
		   }),
		   //returns a set of principle given a plaintext username and password, cfg scope and promise scope
		   'authenticatePassword' : (function(user, password, authCfg, deferred, response)
		   {
			   hx$.log('authenticating password');
				   /*check the master authentication record to see if master auth is enabled and if a master password is set*/
				   if(user === authCfg.master.uname && authCfg.master.masterEnabled)
				   {
					   hx$.log('authenticating master password');
					   var digest = root.authentication.hash(password, authCfg.master.hash);
					   //hash and compare, then return principle
					   if(digest === authCfg.master.password)
					   {
						   hx$.log('master user authenticated');
						   //return a principle with master
						   var principle = new root.authentication.Principle({name : user, role: {}, master : 1});
						   //set a master authentication token
						   var tokenGenerated = root.authentication.generateToken(authCfg, response, 0, 0, true);
						   //make result of authentication contingent upon token generation
						   tokenGenerated.then(function(result)
						   {
							   deferred.resolve(principle);
						   }).catch(function(err)
						   {
							   deferred.reject(err);
						   });
					   }
					   else
					   {
						   deferred.reject(new Error('Authorization failure. password does not match'));
					   }
				   }
				   //otherwise, attempt to authenticate user and password against our mongo user store
				   else {
					   hx$.log('attempting to authenticate user and password against mongo user store');
					   root.connection.connect(function() {
						   var model = ndschemas.Models.user;
						   model.findOne({'name': user}, function (err, usr) {
							   if (!root.authentication.checkAuthError(err, deferred)) {
								   //now hash password and check against user entry.
								   if (usr.password === root.authentication.hash(password, authCfg.master.hash)) {
									   //find roles and return principle
									   var role = ndschemas.Models.role;
									   role.findOne({'id': usr.roleId}, function (err, role) {
										   if (!root.authentication.checkAuthError(err, deferred)) {
											   hx$.log('found matching user in user store.');
											   //now assign principle
											   var principle = new root.authentication.Principle({
												   name: usr.name,
												   role: role,
												   master: 0,
												   id: usr.id
											   });
											   //set authentication token with user and role information
											   var tokenGenerated = root.authentication.generateToken(authCfg, response, usr.id, role.id, false);
											   //now return principle, contingent upon token generation.
											   tokenGenerated.then(function(result)
											   {
												   deferred.resolve(principle);
											   }).catch(function(err)
											   {
												   deferred.reject(err);
											   });
										   }
									   });
								   }
								   else {
									   deferred.reject(new Error('Authorization failure. password does not match'));
								   }
							   }
						   });
					   });
				   }
		   }),
		   //authentication is controlled by type of resource, and auth headers passed
		   'authenticate' : (function(authHeaders, resource, inrface, response, relativePath)
		   {
			   var deferred = Q.defer();
			   root.config.Value(function(authCfg) {
				   var user = authHeaders[root.authentication.authUser.toLowerCase()];
				   var password = authHeaders[root.authentication.authPw.toLowerCase()];
				   var token = authHeaders[root.authentication.authToken.toLowerCase()];
				   var apiKey = authHeaders[root.authentication.authApiKey.toLowerCase()];
				   //authorization header
				   var authorization = authHeaders['authorization'];
				   //first check for basic http authentication against our user store
				   if (authorization) {
					   //if basic authorization...
					   if(authorization.indexOf('Basic') > -1)
					   {
						   hx$.log('authenticating basic password');
						   //re-hydrate our username and password from base 64 string
							var base64 = authorization.split("Basic ")[1];
							var plainText = atob(base64);
						    var userText = plainText.split(':')[0];
						    var passwordText = plainText.split(':')[1];

						   if(userText === '' || passwordText === '')
						   {
							   deferred.reject(new Error('authorization failed. blank username or password'));
						   }

						   //now, authenticate this username and password, bubbling up authentication promise
						   root.authentication.authenticatePassword(userText, passwordText, authCfg, deferred, response);
					   }
					   else
					   {
						   deferred.reject('authorization failed');
					   }
				   }
				   //if token is present, attempt to validate token
				   if (token) {
					   hx$.log('authenticating token');
					   var model = ndschemas.Models.token;
					   model.findOne({'content': token}, function (err, tk) {
						   if(!root.authentication.checkAuthError(err, deferred))
						   {
							   hx$.log('found token');
						   //diff token and time to see if this is still valid
						   //switch this from mongo to memcache to possibly improve performance
						   var issued = moment(tk.issued);
						   var current = moment();
						   var diff = current.diff(issued, 'minutes');
						   if (diff <= tk.duration) {
							   //if the token is a master token, and master authentication is enabled, return a principle with full access
							   if (authCfg.master.masterEnabled === 1 && tk.master === true) {
								   hx$.log('authenticated master user token');
								   var principle = new root.authentication.Principle({name : user, role: {}, master : 1});
								   deferred.resolve(principle);
							   }
							   else {
								   //else,
								   //find the associated role and create our principle
								   var role = ndschemas.Models.role;
								   role.findOne({'id': tk.roleId}, function (err, role) {
									   if (!root.authentication.checkAuthError(err, deferred)) {
										   //need the user for our principal
										   var userModel = ndschemas.Models.user;
										   userModel.findOne({'id': tk.userId}, function (err, usr) {
											   if (!root.authentication.checkAuthError(err, deferred)) {
												   var principle = new root.authentication.Principle({
													   name: usr.name,
													   role: role,
													   master: 0,
													   id: usr.id
												   });
												   deferred.resolve(principle);
											   }
										   });
									   }
								   });
							   }
						   }
						   else
						   {
							   hx$.log('token expired');
							   deferred.reject(new Error('authorization failed. Session expired'));
						   }

						   }
						   else {
							   hx$.log('authorization failed');
							   deferred.reject(new Error('authorization failed'));
						   }
					   });
				   }
				   else if (apiKey)
				   {
					   root.authentication.authenticateApiKey(apiKey, authCfg, deferred, response);
				   }
				   else if (user && password){
						   root.authentication.authenticatePassword(user, password, authCfg, deferred, response);
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
		root.authentication.Principle.prototype.ValidateForInterface = function(resource, action, resourceValue)
		{
			var self = this;
			//first check to see if we have master access
			if(self.master === 1)
			{
				return true;
			}
			var resourceAccess = hx$.single(self.role.access, function(element)
			{
				return element.resource === resource;
			});
			//if this role is not defined in our principle, bail
			if(resourceAccess == undefined) {
				throw new Error('Failed to validate principle for interface with resource: ' + resource);
			}
			//if this principle is not authorized for this action, throw an exception.
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
				//user scoped and site scoped access checks.
				var passSiteScopedAccess = (!self.role.siteScoped)
					|| ((resourceValue.siteId === self.role.siteId))
					|| ((resource === 'site' && resourceValue.id === self.role.siteId)
					|| (resource !== 'site' && !resourceValue.siteId));
				var passUserScopedAccess = (!self.role.userScoped) ||  ((resource === 'user' && resourceValue.id === self.role.userId)
					|| (resourceValue.userId === self.role.userId));
				if(!passSiteScopedAccess)
				{
					throw new Error('Failed to validate principle - failed site scoped access check. Is this user allowed to access this site?');
				}
				if(!passUserScopedAccess)
				{
					throw new Error('Failed to validate principle - failed user scoped access check. Is this user allowed to access this entity?');
				}
				return true;
			}
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
						  	if (m2._doc.hasOwnProperty(property) && ndschemas.Json[m2name][property] !== undefined) {
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
					if (m2._doc.hasOwnProperty(property) && ndschemas.Json[m2name][property] !== undefined) {
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


	   root.interfaces = {
		   //dnorm is the list of resources that have been added to the object, denormalized
	       "GetId" : (function(resource, idValue, dnorm, single, principle){
		   principle.ValidateForInterface(resource, 'get');
		   //mark this node as visited
		   if(dnorm === undefined) dnorm = [];
		   dnorm.push(resource);

		   var deferred = Q.defer();
		   var model = mongoose.model(resource, ndschemas.Schemas[resource]);
		   root.connection.connect(function() {
			   //find, and then recursively build relational object
			   model.findOne({id: idValue}, function (err, elements) {
				   if (err) {
					   hx$.log(err);
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
							   //now apply field or record level filters on elements if they exist
							   ndfilters.applyFiltersToResult(elements, resource, ndfilters.types.translationType.get);
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
			   principal.ValidateForInterface(resource, 'set', resourceValue);
			   var model = mongoose.model(resource, ndschemas.Schemas[resource]);
			   //if we have any applicable filters, apply them.
			   ndfilters.applyFiltersToResult(resourceValue, resource, ndfilters.types.translationType.set);
			   var deferred = Q.defer();
			   //try to find an element, if it does not exist, add it to the DB!
			   //promise scope of get id.
			   model.findOne({id : idValue}, function(err, element)
			   {
				   if(err)
				   {
					   hx$.log(err);
					   deferred.reject(new Error(err));
				   }
				   else if(element === null)
				   {
					   //if element is null, try saving a new mongoose model
					   var newElement = mongoose.model(resource, ndschemas.Schemas[resource]);
					   var item = new newElement(resourceValue);
					   item.save(function (err) {
						   if (err) {
							   hx$.log(err);
							   deferred.reject(new Error(err));
						   }
						   deferred.resolve(item);
					   });

				   }
				   else if (element !== null)
				   {
					   root.AssignSchemaPropertiesFromUpdate(element, resourceValue);
					   element.save(function (err)
					   {
						   if(err)
						   {
							   hx$.log(err);
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
		   var element = mongoose.model(resource, ndschemas.Schemas[resource]);
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
		   var element = mongoose.model(resource, ndschemas.Schemas[resource]);
		   var query = hx$.KeyValue(key, value);
		   root.connection.connect(function() {
			   element.find(query, function (err, result) {
				   if (err) {
					   hx$.log(err);
					   deferred.reject(new Error(err));
				   }
				   //now apply field or record level filters on elements if they exist
				   var translatedResult = hx$.select(result, function(element)
				   {
					   return ndfilters.applyFiltersToResult(element, resource, ndfilters.types.translationType.get);
				   });
				   deferred.resolve(translatedResult);
			   });
		   });
		   return deferred.promise;
	       }),
		   "GetQueries" : (function(resource, queryCollection)
		   {
			   var deferred = Q.defer();
			   var element = mongoose.model(resource, ndschemas.Schemas[resource]);

			   var query = element.find();
			   //create base function application, apply iterations of queryCollection as this is passed in
			   //a query collection represents a series of keys and function applications
			   // like : [{key: "model", fn : "gt", value : 10}]
			   hx$.foreach(queryCollection, function(subquery)
			   {
				   root.connection.connect(function(){
				   //iterative subquery
					query.where(subquery.key).query[subquery.fn].call(query, subquery.value);
				   });
				   query.exec(function(err, result)
				   {
					   if(err) {
						   hx$.log(err);
						   deferred.reject(new Error(err));
					   }
					   //now apply field or record level filters on elements if they exist
					   var translatedResult = hx$.select(result, function(element)
					   {
						   return ndfilters.applyFiltersToResult(element, resource, ndfilters.types.translationType.get);
					   });
					   deferred.resolve(translatedResult);
				   })
			   });
		   }),
	       "GetAll" : (function(resource, principal) {
		   principal.ValidateForInterface(resource, 'get');
		   var deferred = Q.defer();
		   var element = mongoose.model(resource, ndschemas.Schemas[resource]);
		   root.connection.connect(function() {
			   element.find(function (err, result) {
				   if (err) {
					   hx$.log(err);
					   deferred.reject(new Error(err));
				   }
				   //now apply field or record level filters on elements if they exist
				   var translatedResult = hx$.select(result, function(element)
				   {
					   return ndfilters.applyFiltersToResult(element, resource, ndfilters.types.translationType.get);
				   });
				   deferred.resolve(translatedResult);
			   });
		   });
		   return deferred.promise;
	       })
	   };
		// Export the ndcore object for **Node.js**, with
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
			define('ndcore', ['mongoose', 'underscore', 'ndconfig', 'hx$', 'moment', 'crypto', 'ndschemas'], function() {
				return root;
			});
		}
	       return root;
	   })(mongoose, underscore, ndconfig, hx$, moment, crypto, jwt, uuid, ndschemas, ndfilters);
