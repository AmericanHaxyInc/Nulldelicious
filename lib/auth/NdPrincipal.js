/**
 * Created by David on 3/5/2017.
 */
'use strict';
var hx$ = require('haxyclosures');
//Principal class. Contains information
class NdPrincipal
{
    constructor(params)
    {
        //a role is an array of resource access, and name interfaces
        this.role = params.role;
        this.name = params.name;
        //if this is 1, then we have unrestricted access, 0 role based
        this.master = params.master;
        this.id = params.id;
    }
    ValidateForInterface(resource, action, resourceValue)
    {
        hx$.log("Validating principle for {0} resource, {1} action".replace("{0}", resource).replace("{1}", action));
        //first check to see if we have master access
        if (this.master === 1) {
            return true;
        }
        var resourceAccess = hx$.single(this.role.access, function (element) {
            return element.resource === resource;
        });
        //if this role is not defined in our principle, bail
        if (resourceAccess == undefined) {
            throw new Error('Failed to validate principle for interface with resource: ' + resource);
        }

        var actionAccess = hx$.single(resourceAccess.actions, function (element) {
            return element.name === action;
        });
        //if this principle is not authorized for this action, throw an exception.
        if (actionAccess == undefined) {
            throw new Error('Failed to validate principle for interface with action: ' + action);
        }
        hx$.log("Pass resource and action access. Now running user and site scoped checks");

        //user scoped and site scoped access checks.
        var passSiteScopedAccess = (!this.role.siteScoped)
                //if there is no resource value (as in get all), then we pass validation
            || (!resourceValue)
            || ((resourceValue.siteId === this.role.siteId))
            || ((resource === 'site' && resourceValue.id === this.role.siteId)
            || (resource !== 'site' && !resourceValue.siteId));
        var passUserScopedAccess = (!this.role.userScoped)
                //if there is no resource value (as in get all), then we pass validation
            || (!resourceValue)
            || ((resource === 'user' && resourceValue.id === this.role.userId)
            || (resourceValue.userId === this.role.userId));
        if (!passSiteScopedAccess) {
            throw new Error('Failed to validate principle - failed site scoped access check. Is this user allowed to access this site?');
        }
        if (!passUserScopedAccess) {
            throw new Error('Failed to validate principle - failed user scoped access check. Is this user allowed to access this entity?');
        }
        hx$.log("Passed all checks. Principle validated for interface");
        return true;
    }
}

// Export the principal object for **Node.js**, with
// backwards-compatibility for the old `require()` API. If we're in
// the browser, add `principal` as a global object.
if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
        exports = module.exports = NdPrincipal;
    }
    exports.NdPrincipal = NdPrincipal;
} else {
    global['NdPrincipal'] = NdPrincipal;
}
//if we are using an amd loader...
if (typeof define === 'function' && define.amd) {
    define('NdPrincipal', ['hx$'], function() {
        return NdPrincipal;
    });
}
