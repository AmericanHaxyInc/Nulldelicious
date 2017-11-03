/**
 * Created by David on 10/8/2016.
 */
var crypto = require('crypto');
var hx$ = require('haxyclosures');
var ndschemas = require('./NdSchemas.js');

(function(hx$, ndschemas, crypto) {

    var root = {};

    root.hash =  function(string, hashMethod)
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
    };
    root.types = {
        levels: {
            //field level transforms
            'field': 0,
            //transforms that require the record
            'record': 1
        },
        translationType: {
            'get': 0,
            'set': 1,
            'symmetric': 2
        }
    };

    //uses regex to match a base 64 string for image encoding, and return our necessary components
    root.decodeBase64Image = function(dataString){
        var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

        //there should be 3 match groups for image uploads
        if (matches.length !== 3) {
            throw new Error('Invalid input string');
        }
        var response =
        {
            dataImage : matches[0],
            type : matches[1],
            data : matches[2]
        };

        return response;
    };

    root.filters = {
        hashpw: function (pw) {
            var hashDigest = root.hash(pw, "sha256");
            return hashDigest;
        },
        validateGender: function (gender) {
            //validate that user gender is in our valid schema values
            var genders = hx$.getKeys(ndschemas.Presets.Enumerations.Gender);
            if (genders.indexOf(gender) < 0) {
                throw new Error('gender {0} is an invalid gender'.replace('{0}', gender));
            }
            return gender;
        },
        validateBoolean : function (boolean)
        {
           //validate that a boolean value is either true or false
            if(boolean !== true && boolean !== false)
            {
                throw new Error('boolean value is not true or false');
            }
            return boolean;
        },
        //so that we can transform base64 encoded image uploads to a buffer representation in our database model
        transformImage: function (data) {
            data = new Buffer(data, 'base64');
            return data;
        },
        transformImageBinaryToBase64: function (data) {
            var result = data.toString('base64');
            return result;
        },
        transformImageRecord : function (record)
        {
            var data = record.data;
            var dataResponse = root.decodeBase64Image(data);
            record.type = dataResponse.type;
            record.data = new Buffer(dataResponse.data, 'base64');
            return record;
        },
        transformImageBinaryToBase64Record: function (record)
        {
            //transform binary to base 64, then append data elements that we need
            var dataTransformed = record.data.toString('base64');
            var dataType = record.type;
            record.data = "data:{0};base64,{1}".replace('{0}', dataType).replace('{1}', dataTransformed);
            return record;
        },
        validatePhone: function (phone)
        {
            var phoneRegex = new RegExp('/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im');
            if(!phoneRegex.test(phone))
            {
                throw new Error('not a valid phone number');
            }
        }
    };
        root.filtersConfig = {
            /*validation filter for user*/
            user: [{
                name: 'password',
                func: 'hashpw',
                type: root.types.levels.field,
                translationType: root.types.translationType.set
            },
            {
                name: 'phone',
                func: 'validatePhone',
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
            image: [
                {
                    name: 'data',
                    func: 'transformImageRecord',
                    type: root.types.levels.record,
                    translationType: root.types.translationType.set
                },
                {
                    name: 'data',
                    func: 'transformImageBinaryToBase64Record',
                    type: root.types.levels.record,
                    translationType: root.types.translationType.get
                }
            ],
            role: [
                {
                    name: 'siteScoped',
                    func: 'validateBoolean',
                    type: root.types.levels.field,
                    translationType: root.types.translationType.set
                },
                {
                    name: 'userScoped',
                    func: 'validateBoolean',
                    type: root.types.levels.field,
                    translationType: root.types.translationType.set
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
                    if(entry.type == root.types.levels.field) {
                        var filter = root.filters[entry.func];
                        var filterResult = filter(result[entry.name]);
                        result[entry.name] = filterResult;

                        //translate doc contents for get only filters
                        if (entry.translationType == root.types.translationType.get) {
                            result._doc[entry.name] = filterResult;
                        }
                    } else if(entry.type == root.types.levels.record)
                    {
                        //record level transforms
                        var filter = root.filters[entry.func];
                        //if we are doing a set, result has no _doc property, in which case we transform the direct object
                        var filterResult = entry.translationType == root.types.translationType.set ? filter(result) : filter(result._doc);

                        if(entry.translationType == root.types.translationType.set) {
                            result = filterResult;
                        }
                        //translate doc contents for get only filters
                        if (entry.translationType == root.types.translationType.get) {
                            result._doc = filterResult;
                        }
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