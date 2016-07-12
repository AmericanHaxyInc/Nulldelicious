//route, storage, and grid dependencies
var NullDelicious = angular.module("Nulldelicious", ["ngRoute", "ngStorage", "ui.grid"]);

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

    var deleteTemplate = nui.Ui.DeleteTemplate;
    $scope.GlobalSitesColumns = [{field : 'title', displayName : 'Title'},
        {field : 'description', displayName: 'Description'},
        {field : 'Delete', cellTemplate: deleteTemplate}
    ];

    $scope.GlobalSitesData = {
        data : $scope.GlobalSites,
        columnDefs : $scope.GlobalSitesColumns
    };

    $scope.RemoveSiteDataByTitle = (function(title)
    {
        //find the element to remove.
        var index = $scope.GlobalSitesData.data.indexOf(title);
        //show modal confirming deletion

        //make call to server to delete

        //remove from collection
        $scope.GlobalSitesData.data.splice(index, 1);
    });

    $scope.AddSite = (function(title, description)
    {
        //construct new site
        var newSite = new $scope.nui.Site(title, description);
        //attempt write to server
        $scope.DataManager.Set('Site', newSite).then(function(data)
        {
            //if successful, add to our global site data collection
            $scope.GlobalSitesData.push(newSite);
        }).fail(function(error)
        {
            //if write fails, set our error and show an error modal
            $scope.ApiError = error;
        });
    });

    /*start by getting sites*/

    $scope.GetSites();
});
var Editor = NullDelicious.controller("Editor", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location)
{
    //scope nui client scope through controller scope
    $scope.nui = nui;
    //todo: remove fixture data
    $scope.Posts = [
        {
            "id" : "1",
            "title" : "Star Wars Battlefront",
            "body" : "lorem ipsum dolores si amet",
            "date" : new Date(),
            "comments" : ["this is a set", "of comments"],
            "tags" : ["star wars", "games"],
            "author_name" : "David Dworetzky",
            "site_title" : "David's Blog",
            "site_description" : "David's Blog"
        },
        {
            "id" : "1",
            "title" : "Star Wars Battlefront continued",
            "body" : "lorem ipsum dolores si amet amet dolores sit ipsum",
            "date" : new Date(),
            "comments" : ["this is another set", "of comments"],
            "tags" : ["star wars", "games"],
            "author_name" : "David Dworetzky",
            "site_title" : "David's Blog",
            "site_description" : "David's Blog"
        }
    ]
});
var Images = NullDelicious.controller("Images", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location)
{
    $scope.nui = nui;
    //todo: remove fixture data
    $scope.Images = [];

});
var Styles = NullDelicious.controller("Styles", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location)
{
    $scope.nui = nui;
    //todo: remove fixture data
    $scope.Styles = [];
});
var Users = NullDelicious.controller("Users", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location)
{
    //scope nui client scope through controller scope
    $scope.nui = nui;
    //todo: remove fixture data
    $scope.GlobalUsers = [
        {
            "id" : "1",
            "name" : "ddworetzky",
            "first" : "David",
            "last" : "Dworetzky",
            "email" : "fakeemail@gmail.com",
            "gender" : "male",
            "date" : new Date(),
            "password" : "",
            "site_title" : "David's Blog",
            "site_description" : "David's Blog",
            "role_name" : "admin",
            "role_access" : []
        }

    ]
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