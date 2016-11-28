var fs = require('fs');
var express = require('express');
var ndschemas = require('./lib/NdSchemas.js');
var ndcore = require('./lib/Ndcore.js');
var http = require('http');
var https = require('https');
var ndconfig = require('./lib/config/NdConfig.js');
var Q = require('q');
var hx$ = require('haxyclosures');

var bodyParser = require('body-parser');
var multer = require('multer'); // v1.0.5
var upload = multer(); // for parsing multipart/form-data


var app = express();
//assign our core's config to be the ndconfig instance loaded from index
ndcore.config = ndconfig;


//Application Middleware
//request logging

//execute this callback if
var logger = ndconfig.MiddleWare('logging', function() {
    app.use(function (req, res, next) {
        var date = new Date();
        hx$.log('Request time : %d', Date.now());
        hx$.log('Request type : %s', req.path);
        next();
    });
});

var xpoweredby = ndconfig.MiddleWare('xpoweredby', function() {
    //change site to have x-powered-by nulldelicious http header
    app.use(function (req, res, next) {
        res.set("X-Powered-By", "nulldelicious");
        next();
    });
});

var cors = ndconfig.MiddleWare('cors', function() {
    //CORS support
    app.use(function (req, res, next) {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-ND-TOKEN");
        res.set("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,DELETE");
        res.set("Access-Control-Expose-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-ND-TOKEN");

        if ('OPTIONS' == req.method) {
            res.sendStatus(204);
        }
        else {
            next();
        }
    });
});

//middle ware for populating our request body
var bodyParserMiddleware = ndconfig.MiddleWare('bodyParser', function(config)
{
    //our config object for body-parser is a direct translation of the object properties (i.e. request size, etc.) that we want to pass in
    app.use(bodyParser.json(config)); // for parsing application/json
    app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
});




//now, after our middleware is mounted,
// mount the rest of the routes and start the app

var middleWare = Q.all([logger, xpoweredby, cors, bodyParserMiddleware]);
middleWare.then(function (middlewareResult) {


//error handling middleware
    app.use(function (err, req, res, next) {
        hx$.error(err.stack);
        res.status(500).send('An unexpected error occurred.');
    });


    var handleError = function (error, res) {
        hx$.log(error);
        var errorMessage = typeof(error) === 'string' ? error : error.message;
        //maps internal error reason to failure codes
        if (errorMessage.toLowerCase().indexOf('authorization') > -1) {
            res.status(403).send(errorMessage);
        }
        else {
            res.status(500).send(errorMessage);
        }
    };
//specific endpoints
//specific endpoint for login requests
    app.get('/user/login', function (req, res) {
        hx$.log('logging in user');
        //set appropriate response header for this endpoint type
        res.set("Content-Type", "application/json");
        ndcore.authentication.authenticate(req.headers, 'user', 'get', res).then(function (principle) {
            hx$.log('user logged in');
            res.status(200).send(JSON.stringify({user: principle.name}));
        }).catch(function (error) {
            handleError(error, res);
        });
    });

//api key creation mount
    app.post('/key', function (req, res) {
        hx$.log('api key creation');
        //the appropriate content type for this response is json
        res.set("Content-Type", "application/json");
        ndcore.authentication.createKey(req.headers, req.params.user, res).then(function (key) {
            res.status(200).send(JSON.stringify({key: key}));
        });
    });

//enabled schemas and presets mount
    app.get('/preset/schemas', function(req, res) {
        hx$.log('call to retrieve schemas');
        res.set("Content-Type", "application/json");
        //send the json representation of our schemas
        var schemas = ndschemas.Json;
        //along with the json representation of role types
        var roleTypes = ['get', 'set', 'delete'];
        var response = {
            schemas: schemas,
            roles : roleTypes,
            enums : ndschemas.Presets.Enumerations
        };
        res.status(200).send(JSON.stringify(response));
    });


//mount all get requests for models
    for (var resource in ndschemas.Json) {
        if (ndschemas.Json.hasOwnProperty(resource)) {
            //mount get by id
            var getResource = (function (appResource, req, res) {
                //only follow this route if it is not a login route, that's why we place the login route first
                hx$.log('getting resource {}'.replace('{}', appResource));
                ndcore.authentication.authenticate(req.headers, appResource, 'get', res)
                    .then(function (principle) {
                        res.set("Content-Type", "application/json");
                        ndcore.interfaces.GetId(appResource, req.params.identification, [], 0, principle)
                            .then(function (element) {
                                res.status(200).send(JSON.stringify(element));
                            }).catch(function (error) {
                                handleError(error, res);
                            });
                    }).catch(function (error) {
                        handleError(error, res);
                    });
            });
            var currentGet = getResource.bind(this, resource);
            app.get('/' + resource + '/:identification', currentGet);

            //mount get all
            var getAll = (function (appResource, req, res) {
                hx$.log('getting all resources {}'.replace('{}', appResource));
                ndcore.authentication.authenticate(req.headers, appResource, 'get', res)
                    .then(function (principle) {
                        res.set("Content-Type", "application/json");
                        ndcore.interfaces.GetAll(appResource, principle)
                            .then(function (elements) {
                                res.status(200).send(JSON.stringify(elements));
                            }).catch(function (error) {
                                handleError(error, res);
                            })
                    });
            });
            var currentGetAll = getAll.bind(this, resource);
            app.get('/' + resource + '/all/retrieve', currentGetAll);


            //mount query requests

            var queryResource = (function (appResource, req, res) {
                hx$.log('running api subquery on resource {}'.replace('{}', appResource));
                ndcore.authentication.authenticate(req.headers, appResource, 'get', res).then(function (principle) {
                    res.set("Content-Type", "application/json");
                    ndcore.interfaces.GetQuery(appResource, req.params.query, req.params.attribute, principle).then(function (elements) {
                        res.status(200).send(JSON.stringify(elements));
                    }).catch(function (error) {
                        handleError(error, res);
                    });
                }).catch(function (error) {
                    handleError(error, res);
                });
            });
            var currentQuery = queryResource.bind(this, resource);
            app.get('/' + resource + '/query/:query/:attribute', currentQuery);

            //mount resource saving
            var saveResource = (function (appResource, req, res) {
                hx$.log('saving resource {}'.replace('{}', appResource));
                ndcore.authentication.authenticate(req.headers, appResource, 'set', res).then(function (principle) {
                    res.set("Content-Type", "application/json");
                    //check for empty request bodies
                    if(typeof(req.body) == 'undefined')
                    {
                        res.status(500).send('invalid request body');
                    }
                    ndcore.interfaces.SetId(appResource, req.body.id, req.body, principle).then(function (element) {
                        res.status(200).send(JSON.stringify(element));
                    }).catch(function (error) {
                        handleError(error, res);
                    });
                }).catch(function (error) {
                    handleError(error, res);
                });
            });
            var currentSave = saveResource.bind(this, resource);
            app.post('/' + resource, currentSave);

            var deleteResource = (function (appResource, req, res) {
                hx$.log('deleting resource {}'.replace('{}', appResource));
                ndcore.authentication.authenticate(req.headers, appResource, 'delete', res).then(function (principle) {
                    res.set("Content-Type", "application/json");
                    ndcore.interfaces.DeleteId(appResource, req.params.identification, principle).then(function (result) {
                        res.status(200).send(JSON.stringify({response: "success"}));
                    }).catch(function (error) {
                        handleError(error, res);
                    });
                }).catch(function (error) {
                    handleError(error, res);
                });

            });
            //mount resource deletion
            var currentDelete = deleteResource.bind(this, resource);
            app.delete('/' + resource + '/:identification', currentDelete);
        }
    }
    app.listen(7777);
});

