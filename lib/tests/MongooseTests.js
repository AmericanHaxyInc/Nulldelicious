/**
 * Created by David on 1/30/2015.
 */
//direct mongoose tests for functionality used by nd interfaces

var assert = require('assert');
var mongoose = require('mongoose');
var ndconfig = require('../config/ndconfig.js');
var ndcore =  require('../ndcore.js')


var postId = "a7a6601d-bbe6-422b-a30e-8c8c8192c935";

ndconfig.Value(function(cfg)
{
    mongoose.connect(cfg.mongo.mongodbUri);
    mongoose.connection.once('open', function(){
        //on connection open, execute our retrieval code
        var postModel = ndcore.Models.post;
        postModel.findOne({id : postId}, function (err, elements)
        {
            assert.ok(!err);
            assert.ok(elements.id === postId);
        });
    });
})




