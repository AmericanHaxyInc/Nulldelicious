var fs = require('fs');
var express = require('express');
var ndcore = require('./lib/Ndcore.js');
var http = require('http');
var https = require('https');
var ndconfig = require('./lib/config/NdConfig.js');
var Q = require('q');


var app = express();


//Application Middleware
//request logging

//execute this callback if
var logger = ndconfig.MiddleWare('logging', function() {
    app.use(function (req, res, next) {
        var date = new Date();
        console.log('Request time : %d', Date.now());
        console.log('Request type : %s', req.path);
        next();
    });
});

var xpoweredby = ndconfig.MiddleWare('xpoweredby', function() {
    //change site to have x-powered-by nulldelicious http header
    app.use(function (req, res, next) {
        res.setHeader("X-Powered-By", "nulldelicious");
        next();
    });
});

var cors = ndconfig.MiddleWare('cors', function() {
    //CORS support
    app.use(function (req, res, next) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
        res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,DELETE");

        if ('OPTIONS' == req.method) {
            res.sendStatus(204);
        }
        else {
            next();
        }
    });
});
//now, after our middleware is mounted,
// mount the rest of the routes and start the app

var middleWare = Q.all([logger, xpoweredby, cors]);
middleWare.then(function (middlewareResult) {


//error handling middleware
    app.use(function (err, req, res, next) {
        console.error(err.stack);
        res.status(500).send('An unexpected error occurred.');
    });


    var handleError = function (error, res) {
        console.log(error);
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
        console.log('logging in user');
        ndcore.authentication.authenticate(req.headers, 'user', 'get', res).then(function (principle) {
            res.status(200).send({user: principle.name});
        }).catch(function (error) {
            handleError(error, res);
        });
    });

//api key creation mount
    app.post('/key', function (req, res) {
        console.log('api key creation');
        ndcore.authentication.createKey(req.headers, req.params.user, res).then(function (key) {
            res.status(200).send({key: key});
        });
    });


//mount all get requests for models
    for (var resource in ndcore.Json) {
        if (ndcore.Json.hasOwnProperty(resource)) {
            //mount get by id
            var getResource = (function (appResource, req, res) {
                //only follow this route if it is not a login route, that's why we place the login route first
                console.log('getting resource {}'.replace('{}', appResource));
                ndcore.authentication.authenticate(req.headers, appResource, 'get', res)
                    .then(function (principle) {
                        ndcore.interfaces.GetId(appResource, req.params.identification, [], 0, principle)
                            .then(function (element) {
                                res.status(200).send(element);
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
                console.log('getting all resources {}'.replace('{}', appResource));
                ndcore.authentication.authenticate(req.headers, appResource, 'get', res)
                    .then(function (principle) {
                        ndcore.interfaces.GetAll(appResource, principle)
                            .then(function (elements) {
                                res.status(200).send(elements);
                            }).catch(function (error) {
                                handleError(error, res);
                            })
                    });
            });
            app.get('/' + resource + '/all', getAll);


            //mount query requests

            var queryResource = (function (appResource, req, res) {
                console.log('running api subquery on resource {}'.replace('{}', appResource));
                ndcore.authentication.authenticate(req.headers, appResource, 'get', res).then(function (principle) {
                    ndcore.interfaces.GetQuery(appResource, req.params.query, req.params.attribute, principle).then(function (elements) {
                        res.status(200).send(elements);
                    }).catch(function (error) {
                        handleError(error, res);
                    });
                }).catch(function (error) {
                    handleError(error, res);
                });
            });
            var currentQuery = queryResource.bind(this, resource);
            app.get('/' + resource + '/:query/:attribute', currentQuery);

            //mount resource saving
            var saveResource = (function (appResource, req, res) {
                console.log('saving resource {}'.replace('{}', appResource));
                ndcore.authentication.authenticate(req.headers, appResource, 'set', res).then(function (principle) {
                    ndcore.interfaces.SetId(appResource, req.body, req.body.id, principle).then(function (element) {
                        res.status(200).send(element);
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
                console.log('deleting resource {}'.replace('{}', appResource));
                ndcore.authentication.authenticate(req.headers, appResource, 'delete', res).then(function (principle) {
                    ndcore.interfaces.DeleteId(appResource, req.params.identification, principle).then(function (result) {
                        res.status(200).send({response: "success"});
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

