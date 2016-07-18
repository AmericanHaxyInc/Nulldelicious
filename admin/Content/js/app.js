//route, storage, and grid dependencies
var NullDelicious = angular.module("Nulldelicious", ["ngRoute", "ngStorage", "ngTouch", "ui.grid", "ui.grid.selection"]);

var Main = NullDelicious.controller("Main", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location) {
    //scope nui client scope through controller scope
    $scope.nui = nui;
    //define location in scope
    $scope.$location = $location;
    $scope.$storage = $localStorage;
    $scope.FooterMessage = function () {
        return $scope.$location.path() == '' ? ['Welcome to a deliciously simple CMS',

            'with a tiny footprint, fantastic performance',
            'and all the features you expect',
            'running on node. Nulldelicious!'] : [];
    };
    $scope.Identity = '';
    $scope.Login = (function (username, password) {
        //get encoded
        var encoded = nui.EncodeLogin(username, password);
        //clear username and password
        $scope.Username = '';
        $scope.Password = '';
        //now make login request.
        var login = nui.Login(encoded).then(function (result) {
            //keep track of current identity
            $scope.Identity = result[1];
            //create data context after login
            $scope.DataManager = new nui.DataManager($scope.$storage, result[0]);
            $scope.$apply();
        })
            .fail(function (error) {
                //display auth error to user.
                $scope.AuthError = true;
                $scope.$apply();
            });
    });

    //handle selection change
    $scope.$on('changeSiteSelection', function (event, args) {
        //get the title for display, and the id for foreign key filtering
        $scope.SelectedSite = args.title;
        $scope.SelectedSiteId = args.id;
    });
});

var Site = NullDelicious.controller("Site", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location)
{
    //scope nui client scope through controller scope
    $scope.nui = nui;

    $scope.GetSites = (function()
    {
        if($scope.DataManager) {
            $scope.DataManager.Get('Site').then(function (data) {
                $scope.GlobalSites = data;
                $scope.GlobalSitesData.data = $scope.GlobalSites;
                $scope.$apply();
            });
        }
    });
    //Ng grid templates...
    var deleteTemplate = '<button class="nui-delete-button" ng-click="grid.appScope.RemoveRow(this)"></button>';

    $scope.GlobalSitesColumns = [{field : 'title', displayName : 'Title'},
        {field : 'description', displayName: 'Description'},
        {field : 'Delete', cellTemplate: deleteTemplate}
    ];

    $scope.GlobalSitesData = {
        data : $scope.GlobalSites,
        columnDefs : $scope.GlobalSitesColumns,
        enableRowSelection: true,
        enableSelectAll: false,
        selectionRowHeaderWidth: 35,
        multiSelect: false
    };

    $scope.RemoveRow = function(element) {
        var self = this;
        var targetRow = element.$parent.$parent.row;
        var targetId = targetRow.entity.id;
        //now get the index of the element that we wish to remove in our collection, and
        //delete it on the server
        var siteToDelete = hx$.single($scope.GlobalSitesData.data, function(site)
        {
            return site.id === targetId;
        });

        $scope.DataManager.Delete('Site', siteToDelete).then(function(result)
        {
            //now, remove the element from our grid
            var index = $scope.GlobalSitesData.data.indexOf(siteToDelete);
            $scope.GlobalSitesData.data.splice(index, 1);
            $scope.$apply();
        }).fail(function(error)
        {
            $scope.DeleteError = true;
        });
    };

    $scope.AddSite = (function(title, description)
    {
        //construct new site
        var newSite = new $scope.nui.Site(title, description);
        //attempt write to server
        $scope.DataManager.Set('Site', newSite).then(function(data)
        {
            //if successful, add to our global site data collection
            $scope.GlobalSitesData.data.push(newSite);
            $scope.$apply();
        }).fail(function(error)
        {
            //if write fails, set our error and show an error modal
            $scope.ApiError = error;
        });
    });

    /*start by getting sites*/

    $scope.GetSites();

    //now register grid API's, specifically, our onchange function when we change the site selection
    $scope.GlobalSitesData.onRegisterApi = function(gridApi){
    //set gridApi on scope
    $scope.gridApi = gridApi;
    gridApi.selection.on.rowSelectionChanged($scope,function(row){
        //emit a selected site change event so that we can
        var selectedSite = row.entity;
        $scope.$emit('changeSiteSelection', selectedSite);
    });
};
});
var Editor = NullDelicious.controller("Editor", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location)
{
    //scope nui client scope through controller scope
    $scope.nui = nui;

    $scope.GetPosts = (function()
    {
        if($scope.DataManager)
        {
            $scope.DataManager.Get('Post', {
                query: {key: 'site_id', value : $scope.SelectedSiteId}
            }).then(function (data) {
                $scope.Posts = data;
                $scope.$apply();
            });
        }
    });

    $scope.GetPosts();
});
var Images = NullDelicious.controller("Images", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location)
{

    $scope.nui = nui;
    $scope.GetImages = (function()
    {
        if($scope.DataManager)
        {
            $scope.DataManager.Get('Image', {
                query: {key: 'site_id', value : $scope.SelectedSiteId}
            }).then(function(data){
                $scope.Images = data;
                $scope.$apply();
            })
        }
    });

    $scope.GetImages();
});
var Styles = NullDelicious.controller("Styles", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location)
{
    $scope.nui = nui;
    $scope.GetStyles = (function()
    {
        if($scope.DataManager)
        {
            $scope.DataManager.Get('Theme', {
                query: {key: 'site_id', value : $scope.SelectedSiteId}
            }).then(function(data)
            {
                $scope.Styles = data;
                $scope.$apply();
            });
        }
    });

    $scope.GetStyles();
});
var Users = NullDelicious.controller("Users", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location)
{
    //scope nui client scope through controller scope
    $scope.nui = nui;

    $scope.GetUsers = (function()
    {
        $scope.DataManager.Get('User', {
            query: {key: 'site_id', value : $scope.SelectedSiteId}
        }).then(function(data)
        {
            $scope.Users = data;
            $scope.$apply();
        });
    });

    $scope.GetUsers();
});
NullDelicious.config(['$routeProvider',
    function($routeProvider, $locationProvider){
        $routeProvider.when('/Editor', {
            templateUrl: 'Editor.html', controller : "Editor"
        })
            .when('/Site', {templateUrl: 'Site.html', controller: "Site"})
            .when('/Users',{templateUrl: 'Users.html', controller : "Users"})
            .when('/Styles',{templateUrl: 'Styles.html', controller: "Styles"})
            .when('/Images',{templateUrl: 'Images.html', controller: "Images"})
    }]);