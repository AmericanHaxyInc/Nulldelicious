
    //module dependencies... Either load them with require or assume they are in global scope
    var _ = (function(){
        if(typeof require != 'undefined') {
            return require('underscore');
        }
        else
        {
            return _;
        }
    })();

    //root module scope
    (function (_) {
        var global = this;
        //Haxy.Closures library. Data structures, common functionality, and language extensions.
        //Written by David Dworetzky.
        var root = {};

        //logging...
        root.LogTypes = {
            error : 0,
            warn : 1,
            info : 2,
            none : -1
        };
        root.LogLevel = root.LogTypes.info;
        //log gate
        root.Log = (function (message, level)
        {
            //the default log level is info
            if(typeof(level) == 'undefined')
            {
                level = root.LogTypes.info;
            }
            if(level == root.LogTypes.none)
            {
                return new Error('Cannot use none as a logging level for message logging');
            }
            else if(level <= root.LogLevel)
            {
                console.log(message);
            }
        });
        //aliasing
        root.log = root.Log;

        root.Error = (function()
        {
            return root.Log(root.LogTypes.error);
        });
        root.error = root.Error;

        root.Warn = (function()
        {
            return root.Log(root.LogTypes.warn);
        });
        root.warn = root.Warn;

        root.Info = (function()
        {
            return root.Log(root.LogTypes.info);
        });
        root.info = root.Info;


        //DATASTRUCTURES AND METHODS
        //http://stackoverflow.com/questions/6906916/collisions-when-generating-uuids-in-javascript
        root.GUID = (function GUID(options) {

            //if we request an empty guid... return nothing.
            if (options !== undefined) {
                if (options === 0) {
                    return '00000000-0000-0000-0000-000000000000';
                }
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        });

        //alias to Guid as well as GUID
        root.Guid = root.GUID;

        root.GetKeyByValue = (function (obj, value) {
            for (var prop in obj) {
                if (obj.hasOwnProperty(prop)) {
                    if (obj[prop] === value)
                        return prop;
                }
            }
        });
        root.TryGetValue = (function (obj, property, result) {
            for (var prop in obj) {
                if (obj.hasOwnProperty(property)) {
                    if (prop === property) {
                        result.result = 1;
                        return obj[prop];
                    }
                }
            }
            //false
            result.result = 0;
            return undefined;
        });
        root.CopyProps = (function(model1, model2, fn)
        {
            for(var element2 in model2)
            {
                for(var element1 in model1)
                {
                    if(element1 === element2 && model1.hasOwnProperty(element1) && (!fn || fn(element1, element2)))
                    {
                        model1[element1] = model2[element2];
                    }
                }
            }
        });

        root.AddProps = (function(model1, model2)
        {
            for(var element2 in model2)
            {
                if(model2.hasOwnProperty(element2)) {
                    model1[element2] = model2[element2]
                }
            }
        });

        //ApplyArgs applies a function and an accumulator over a list of operations
        root.ApplyArgs = (function(fn, accumulator, args)
        {
            var self = this;
            var args = Array.prototype.slice.apply(arguments);
            fn = args.shift();
            accumulator = args.shift();
            //iteration
            for (var arg in args)
            {
                //process each arg in file
                if(args.hasOwnProperty(arg)) {
                    accumulator = fn(accumulator, args[arg]);
                }
            }
            return accumulator;
        });

        root.StatefulObject = (function (States, Cyclical) {
            //States, array of States
            this.States = States;
            this.Cyclical = Cyclical;

            this.CurrState = 0;

            this.ObservedState = (function () {
                return this.States[this.CurrState];
            });
            //Advance State 
            this.AdvanceState = (function () {
                var self = this;
                if (self.States.length > self.CurrState + 1) {
                    self.CurrState = self.CurrState + 1;
                }
                else if (self.States.length === self.CurrState + 1 && self.Cyclical === 1) {
                    self.CurrState = 0;
                }
            });
        });


        root.foreach = (function (array, func) {

            //first we check to see if this is legitimately an array. If not, we treat execution as if it should be done
            //one singleton.
            if (array instanceof Array) {
                //if array not undefined or empty...
                if (array) {
                    for (var i = 0; i < array.length; i++) {
                        func(array[i]);
                    }
                }
            }
            else {
                func(array);
            }
        });

        //aliasing
        root.ForEach = root.foreach;

        root.foreachReverse = (function (array, func)
        {
            //reverse array then foreach it.
            array.sort(function(a, b){if(a > b) return -1; else if (a < b) return 1; else return 0;});
            root.foreach(array, func);
        });

        //aliasing

        root.ForEachReverse = root.foreachReverse;

        root.where = (function (array, comparison) {
            var values = [];
            for (var i = 0; i < array.length; i++) {
                if (comparison(array[i])) {
                    values.push(array[i]);
                }
            }
            return values;
        });

        //aliasing
        root.Where = root.where;

        root.select = (function (array, xform) {
            var values = [];
            for (var i = 0; i < array.length; i++)
            {
                values.push(xform(array[i]));
            }
            return values;
        });

        root.Select = root.select;

        //array intersection and exclusion
        root.intersect = (function(a1, a2)
        {
            if(a1 === undefined || a2 === undefined) return [];
            return root.where(a1, function(element)
            {
                return a2.indexOf(element) !== -1;
            })
        });

        //aliasing
        root.Intersect = root.intersect;

        root.exclude = (function(a1, a2)
        {
            if(a1 === undefined) return [];
            return root.where(a1, function(element)
            {
                return a2.indexOf(element) === -1;
        })
        });

        //aliasing
        root.Exclude = root.exclude;

        root.last = (function (array)
        {
            return array[array.length - 1];
        });
        //aliasing
        root.Last = root.last;



        root.single = (function (array, comparison) {
            var values = [];
            for (var i = 0; i < array.length; i++) {
                if (comparison(array[i])) {
                    return array[i];
                }
            }
            return undefined;
        });
        //aliasing
        root.Single = root.single;
        root.removeFirst = (function (array, comparison) {
            var toRemove = -1;
            for (var i = 0; i < array.length; i++) {
                if (comparison(array[i]))
                {
                    toRemove = i;
                }
            }
            if (toRemove !== -1) { array.splice(toRemove, 1); }
            return array;
        });
        //aliasing
        root.RemoveFirst = root.removeFirst;

        root.enumToArray = (function (enm)
        {
            var vals = [];
            for(var val in enm)
            {
                vals.push(val)
            }
            return vals;
        });
        //aliasing
        root.EnumToArray = root.enumToArray;

	root.getKeys = (function(obj)
	{
	    var vals = [];
	    for(var property in obj)
		{
		    if(obj.hasOwnProperty(property))
			{
			    vals.push(property);
			}
		}
	    return vals;
	});
        //aliasing
        root.GetKeys = root.getKeys;

        root.singleOrDefault = (function (array, comparison) {
            if (array.length !== 0) {
                var result = root.single(array, comparison);
                if (result === undefined) {
                    return array[0];
                }
                else {
                    return result;
                }
            }
            else {
                return undefined
            }
        });
        //aliasing
        root.SingleOrDefault = root.singleOrDefault;


        root.trimTo = (function(character, string)
        {
            var index = string.indexOf(character);
            return string.substring(index + 1, string.length);
        });
        //aliasing
        root.TrimTo = root.trimTo;

        //simple key value pair
        root.KeyValue = (function(key, value)
        {
            var obj = {};
            obj[key] = value;
            return obj;
        });
        //INHERITANCE AND COMPOSITION
        //after this is called, the constructor for the base method also needs to invoke the base constructor...
        root.Inherits = (function (target, source) {
            //store constructor
            var temp = source;
            //source is a _target object.
            source.prototype = target;
            //Correct constructor prototype reference... 
            source.prototype.constructor = temp;
        });

        //only use with primitive objects, and consider using _.extend instead.
        root.MixInto = (function (target, source, methodNames) {
            // ignore the actual args list and build from arguments so we can
            // be sure to get all of the method names
            var args = Array.prototype.slice.apply(arguments);
            source = args.shift();
            target = args.shift();
            methodNames = args;

            var method;
            var length = methodNames.length;
            for (var i = 0; i < length; i++) {
                method = methodNames[i];

                // bind the function from the source and assign the
                // bound function to the target
                source[method] = _.bind(target[method], source);
            }
        });

        //given two closures i.e. constructors for objects, return a new object that is an amalgam of the two
        root.DynamicMixInto = (function (target, source, methodNames) {
            var args = Array.prototype.slice.apply(arguments);
            target = args.shift();
            source = args.shift();
            methodNames = args;

            var obj1 = new target();
            var obj2 = new source();

            var length = methodNames.length;
            for (var i = 0; i < length; i++) {
                method = methodNames[i];

                // bind the function from the source and assign the
                // bound function to the target
                obj2[method] = _.bind(obj1[method], obj2);

            }
            return obj2;

        });

        // Export the hx$ object for **Node.js**, with
        // backwards-compatibility for the old `require()` API. If we're in
        // the browser, add `hx$` as a global object.
        if (typeof exports !== 'undefined') {
            if (typeof module !== 'undefined' && module.exports) {
                exports = module.exports = root;
            }
            exports.hx$ = root;
        } else {
             global['hx$'] = root;
        }
        //if we are using an amd loader...
        if (typeof define === 'function' && define.amd) {
            define('hx$', ['underscore'], function() {
                return root;
            });
        }
        return root;
    }(_));
