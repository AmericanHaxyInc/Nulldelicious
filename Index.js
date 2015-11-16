var fs = require('fs');
var express = require('express');
var ndcore = require('./lib/Ndcore.js');
var http = require('http');
var https = require('https');
var app = express();

//request logging
app.use(function(req, res, next)
{
    var date = new Date();
    console.log('Request time : %d', Date.now());
    console.log('Request type : %s', req.path);
    next();
});
//CORS support
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

var handleError = function(error, res){
    console.log(error);
    if(error.indexOf('authorization') > -1)
    {
        res.status(403).send(error);
    }
    else
    {
        res.status(500).send(error);
    }
};

//mount all get requests for models
for(var resource in ndcore.Json)
{
    if(ndcore.Json.hasOwnProperty(resource))
    {
        var getResource = (function(appResource, req, res)
        {
            ndcore.authentication.authenticate(req.headers, appResource, 'get', res.headers)
                .then(function(principle)
                {
                    ndcore.interfaces.GetId(appResource, req.params.identification, [], 0, principle)
                        .then(function (element)
                        {
                            res.status(200).send(element);
                        }).catch(function (error) {
                            handleError(error, res);
                        });
                }).catch(function(error)
                {
                    handleError(error, res);
                })
        });
        var currentGet = getResource.bind(this, resource);
        app.get('/' + resource + '/:identification', currentGet);

        //mount query requests

        var queryResource = (function(appResource, req, res)
        {
            ndcore.authentication.authenticate(req.headers, appResource, 'get', res.headers).then(function(principle) {
                ndcore.interfaces.GetQuery(appResource, req.params.query, req.params.attribute, principle).then(function (elements) {
                    res.status(200).send(elements);
                }).catch(function (error) {
                    handleError(error, res);
                });
            }).catch(function(error)
            {
                handleError(error, res);
            });
        });
        var currentQuery = queryResource.bind(this, resource);
        app.get('/' + resource + '/:query/:attribute', currentQuery);

        //mount resource saving
        var saveResource = (function(appResource, req, res)
        {
            ndcore.authentication.authenticate(req.headers, appResource, 'set', res.headers).then(function(principle) {
                ndcore.interfaces.SetId(appResource, req.body, req.body.id, principle).then(function (element) {
                    res.status(200).send(element);
                }).catch(function (error) {
                    handleError(error, res);
                });
            }).catch(function(error)
            {
                handleError(error, res);
            });
        });
        var currentSave = saveResource.bind(this, resource);
        app.post('/' + resource, currentSave);

        var deleteResource = (function(appResource, req, res)
        {
            ndcore.authentication.authenticate(req.headers, appResource, 'delete', res.headers).then(function(principle) {
                ndcore.interfaces.DeleteId(appResource, req.params.identification, principle).then(function (result) {
                    res.status(200).send({response: "success"});
                }).catch(function (error) {
                    handleError(error, res);
                });
            }).catch(function(error)
            {
                handleError(error, res);
            });

        });
        //mount resource deletion
        var currentDelete = deleteResource.bind(this, resource);
        app.delete('/' + resource + '/:identification', currentDelete);
    }
}
//api key creation mount
app.post('/key', function(req, res)
{
    ndcore.authentication.createKey(req.headers, req.params.user, res.headers).then(function(key) {
        res.status(200).send({key: key});
    });
});
//specific endpoint for login requests
app.get('/user/login', function(req, res)
{
    ndcore.authentication.authenticate(req.headers, 'user', 'get', res.headers).then(function(principle) {
        res.status(200).send({response: "success"});
    }).catch(function(error)
    {
        handleError(error, res);
    });
});


app.listen(8080);

