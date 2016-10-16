/**
 * Created by David on 10/8/2016.
 */
var crypto = require('crypto');
var hx$ = require('./HaxyClosures.js');
var ndschemas = require('./NdSchemas.js');

(function(hx$, ndschemas, crypto) {

    var root = {};

    root.hash =  (function(string, hashMethod)
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
    });

    root.types = {
        'levels': {
            //field level transforms
            'field': 0,
            //transforms that require the record
            'record': 1
        },
        'translationType': {
            'get': 0,
            'set': 1,
            'symmetric': 2
        }
    };

    root.filters = {
        'hashpw': (function (pw) {
            var hashDigest = root.hash(pw);
            return hashDigest;
        }),
        'validateGender': (function (gender) {
            //validate that user gender is in our valid schema values
            var genders = hx$.getKeys(ndschemas.Presets.Enumerations.Gender);
            if (genders.indexOf(gender) < 0) {
                throw new Error('gender {0} is an invalid gender'.replace('{0}', gender));
            }
            return gender;
        }),
        //so that we can transform base64 encoded image uploads to a buffer representation in our database model
        'transformImage': (function (data) {
            data = new Buffer(data, 'base64');
            return data;
        }),
        'transformImageBinaryToBase64': (function (data) {
            var result = data.toString('base64');
            return result;
        })
    };
        root.filtersConfig = {
            /*validation filter for user*/
            'user': [{
                name: 'password',
                func: 'hashpw',
                type: root.types.levels.field,
                translationType: root.types.translationType.set
            },
                /*validation filter for gender*/
                {
                    name: 'gender',
                    func: 'validateGender',
                    type: root.types.levels.field,
                    translationType: root.types.translationType.set
                }],
            'image': [
                {
                    name: 'data',
                    func: 'transformImage',
                    type: root.types.levels.field,
                    translationType: root.types.translationType.set
                },
                {
                    name: 'data',
                    func: 'transformImageBinaryToBase64',
                    type: root.types.levels.field,
                    translationType: root.types.translationType.get
                }
            ]
        };

    root.applyFiltersToResult = (function(result, resource, translationType)
    {
        //now apply field or record level filters on elements if they exist
        if(root.filtersConfig[resource]!== undefined && root.filtersConfig[resource].length > 0) {
            hx$.foreach(root.filtersConfig[resource], function(entry) {
                //apply any X or symmetric filters, depending on what interface we are in
                if(entry.translationType == translationType || entry.translationType == root.types.translationType.symmetric) {
                    var filter = root.filters[entry.func];
                    var filterResult = filter(result[entry.name]);
                    result[entry.name] = filterResult;

                    //translate doc contents for get only filters
                    if(entry.translationType == root.types.translationType.get)
                    {
                        result._doc[entry.name] = filterResult;
                    }
                }
            });
        }
        return result;
    });

    // Export the ndcore object for **Node.js**, with
    // backwards-compatibility for the old `require()` API. If we're in
    // the browser, add `ndconfig` as a global object.
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = root;
        }
        exports.ndfilters = root;
    } else {
        global['ndfilters'] = root;
    }
    //if we are using an amd loader...
    if (typeof define === 'function' && define.amd) {
        define('ndfilters', ['hx$', 'ndschemas', 'crypto'], function() {
            return root;
        });
    }

    return root;

})(hx$, ndschemas, crypto);