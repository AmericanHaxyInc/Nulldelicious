//set global options
//toastr options
/*global options for plugins and directives */
toastr.options = {
    "closeButton": false,
    "debug": false,
    "newestOnTop": false,
    "progressBar": false,
    "positionClass": "toast-top-full-width",
    "preventDuplicates": false,
    "onclick": null,
    "showDuration": "300",
    "hideDuration": "1000",
    "timeOut": "5000",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
};
var tinymcePlugins = [
    'advlist autolink lists link image charmap print preview anchor',
    'searchreplace visualblocks code fullscreen',
    'insertdatetime media table contextmenu paste code'
];
var tinymceToolbar = 'undo redo | insert | styleselect | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image code';

var tinymceOptions =
{
    height:500,
    menubar: false,
    plugins: tinymcePlugins,
    toolbar: tinymceToolbar
};

//route, storage, and grid dependencies
var NullDelicious = angular.module("Nulldelicious", ["ngRoute", "ngStorage", "ngTouch", "ui.grid", "ui.grid.selection", "ui.tinymce"]);

var ndTextEditor = NullDelicious.directive('ndTextEditor', function() {
    return {
        //restricted to attributes only
        restrict: 'A',
        scope: {
            /*text param are the list of directive parameters we pass for tinyMCE initialization */
            textParam: "@selector"
        },
        link: function (scope, element, attributes) {
            //get id
            var id = attributes['id'];
            //var id = element.attr('id');
            var selectorName = "#{0}".replace("{0}", id);
            //init tinymce on our dom element
            tinymce.init({ selector : selectorName,
                height:500,
                menubar: false,
                plugins: tinymcePlugins,
                toolbar: tinymceToolbar
            });
            //tinymce settings
        }
    };
});

var ndCodeEditor = NullDelicious.directive('ndCodeEditor', function() {
    return {
        restrict: 'A',
        require: ['ngModel'],
        scope: {
            /*code editor mode is the codemirror mode that we wish to use to edit this element*/
            mode: "@ndCodeEditor",
            /* make ng model available for use*/
            ngModel: '='
        },
        link: function (scope, element, attributes, ctrls) {
            //get id
            var id = attributes['id'];
            var domElement = document.getElementById(id);
            var cm = CodeMirror.fromTextArea(domElement, {
                value: "",
                mode:  scope.mode,
                theme: "base16-dark"
                //htmlMode: true
            });

            var ngModelCtrl = ctrls[0];
            //register control change
            cm.on('change', function(obj)
            {
                var newValue = cm.getValue();
                ngModelCtrl.$setViewValue(newValue);
                //register value as scope
                scope.ngModel = newValue;
            });

            //watch broadcast event for code changed in the control (outside to inside data binding)
            scope.$on('codeChanged', function(event, value)
            {
                var oldValue = cm.getValue();
                //now set our value if this is an external grid update (which means the values won't be the same)
                if(oldValue !== value) {
                    cm.getDoc().setValue(value);
                }
            })

        }
    };
});

var Main = NullDelicious.controller("Main", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location, DataManager) {
    //tinymce editor options for our sub controllers
    $scope.tinymceOptions = tinymceOptions;
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
            $scope.DataManager = new DataManager.DataManager($scope.$storage, result[0]);
            $scope.$apply();
        })
            .fail(function (error) {
                //display auth error to user.
                toastr["error"](error);
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
                //select an initial row if $scope.SelectedSiteId is set
                //modify rows so that we can make a row selection
                $scope.gridApi.grid.modifyRows($scope.GlobalSitesData.data);
                var selectedSite = hx$.single($scope.GlobalSitesData.data, function(dt)
                {
                    return dt.id === $scope.SelectedSiteId;
                });
                if(selectedSite) {
                    $scope.gridApi.selection.selectRow(selectedSite);
                }
                $scope.$apply();
            });
        }
    });
    //Ng grid templates...
    var deleteTemplate = nui.ui.deleteTemplate;

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
            toastr["error"](error);
            $scope.$apply();
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
            toastr["error"](error);
            $scope.$apply();
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

    //set editor columns and data

    var deleteTemplate = nui.ui.deleteTemplate;

    $scope.EditorColumns = [{field : 'title', displayName : 'Title'},
        {field : 'body', displayName: 'Body'},
        {field : 'Delete', cellTemplate: deleteTemplate},
        {field : 'tags', displayName: 'Tags'},
        {field : 'siteId', displayName: 'SiteId'},
        {field : 'published', displayName: 'Published'}
    ];

    $scope.EditorData = {
        data : $scope.Posts,
        columnDefs : $scope.EditorColumns,
        enableRowSelection: true,
        enableSelectAll: false,
        selectionRowHeaderWidth: 35,
        multiSelect: false
    };
    /*remove row functionality */
    $scope.RemoveRow = function(element) {
        var self = this;
        var targetRow = element.$parent.$parent.row;
        var targetId = targetRow.entity.id;
        //now get the index of the element that we wish to remove in our collection, and
        //delete it on the server
        var postToDelete = hx$.single($scope.EditorData.data, function(post)
        {
            return post.id === targetId;
        });

        $scope.DataManager.Delete('Post', postToDelete).then(function(result)
        {
            //now, remove the element from our grid
            var index = $scope.EditorData.data.indexOf(postToDelete);
            $scope.EditorData.data.splice(index, 1);
            $scope.$apply();
        }).fail(function(error)
        {
            $scope.DeleteError = true;
            toastr["error"](error);
            $scope.$apply();
        });
    };
    //post states >> either adding posts or editing them
    var postStates =
    {
        Add: 0,
        Save: 1
    };
    //tag constructor
    var tag = nui.tag;


    var defaultTags = [new tag('')];
    $scope.Tags = defaultTags;
    $scope.GetPosts = (function()
    {
        if($scope.DataManager)
        {
            $scope.DataManager.Get('Post', {
                query: {key: 'siteId', value : $scope.SelectedSiteId}
            }).then(function (data) {
                $scope.Posts = data;
                $scope.EditorData.data = $scope.Posts;
                $scope.$apply();
            });
        }
    });
    //add tags
    $scope.AddTag = (function()
    {
        $scope.Tags.push(new tag(''));
    });

    //default state is add
    $scope.PostActionState = postStates.Add;
    $scope.PostActionDescriptor = (function()
    {
        return hx$.GetKeyByValue(postStates, $scope.PostActionState) + ' Post';
    });

    $scope.PostAction = (function()
    {
        if($scope.PostActionState == postStates.Add)
        {
            //transform tags
            var tags = _.map($scope.Tags, function(key)
            {
                return {name : key.text};
            });
            var post = new nui.Post($scope.PostTitle, $scope.PostBody, tags, $scope.SelectedSiteId);
            //if we are in add state, grab our model data, new up a post, update the server
            //and update our grid model
            $scope.DataManager.Set('Post', post).then(function(data)
            {
                $scope.EditorData.data.push(data);
                $scope.$apply();
            });
        }
        else if($scope.PostActionState == postStates.Save)
        {
            //modify selected post with edited body, title, tags
            $scope.SelectedPost.body = $scope.PostBody;
            $scope.SelectedPost.title = $scope.PostTitle;
            $scope.SelectedPost.tags = _.map($scope.Tags, function(key)
            {
                return {name : key.text};
            });


            //now write back to the server, update the grid collection in the UI
            $scope.DataManager.Set('Post', $scope.SelectedPost).then(function(data)
            {
                var gridPost = hx$.single($scope.EditorData.data, function(entry)
                {
                    return entry.id === $scope.SelectedPost.id;
                });
                gridPost = data;
                $scope.$apply();
            })
        }
    });
    $scope.GetPosts();

    $scope.EditorData.onRegisterApi = function(gridApi) {
        //set gridApi on scope
        $scope.gridApi = gridApi;
        //post selection in grid
        gridApi.selection.on.rowSelectionChanged($scope, function (row) {
            //emit a selected site change event so that we can
            var selectedPost = row.entity;
            $scope.SelectedPost = selectedPost;
            $scope.PostBody = selectedPost.body;
            $scope.PostTitle = selectedPost.title;
            $scope.Tags = _.map(selectedPost.tags, function (t) {
                return new tag(t.name);
            });
            //switch to save state
            $scope.PostActionState = postStates.Save;
        });
    };

    //enable TINY MCE on editor area.
    //tinymce.init({ selector : '#PostBody' });
    //TODO. refactor this as a directive instead
});
var Images = NullDelicious.controller("Images", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location)
{

    var imageStates =
    {
        Add: 0,
        Save: 1
    };


    $scope.ImageActionState = imageStates.Add;

    $scope.nui = nui;

    var deleteTemplate = nui.ui.deleteTemplate;

    $scope.ImagesColumns = [{field : 'title', displayName : 'Title'},
        {field : 'Delete', cellTemplate: deleteTemplate},
        {field : 'tags', displayName: 'Tags'}];

    $scope.ImagesData = {
        data : $scope.Images,
        columnDefs : $scope.ImagesColumns,
        enableRowSelection: true,
        enableSelectAll: false,
        selectionRowHeaderWidth: 35,
        multiSelect: false
    };

    $scope.GetImages = (function()
    {
        if($scope.DataManager)
        {
            $scope.DataManager.Get('Image', {
                query: {key: 'siteId', value : $scope.SelectedSiteId}
            }).then(function(data){
                $scope.Images = data;
                $scope.ImagesData.data = $scope.Images;
                $scope.$apply();
            });
        }
    });

    //tag constructor
    var tag = nui.tag;

    var defaultTags = [new tag('')];
    $scope.Tags = defaultTags;
    $scope.AddTag = (function()
    {
        $scope.Tags.push(new tag(''));
    });

    $scope.RemoveRow = function(element) {
        var self = this;
        var targetRow = element.$parent.$parent.row;
        var targetId = targetRow.entity.id;
        //now get the index of the element that we wish to remove in our collection, and
        //delete it on the server
        var imageToDelete = hx$.single($scope.ImagesData.data, function(image)
        {
            return image.id === targetId;
        });

        $scope.DataManager.Delete('Image', imageToDelete).then(function(result)
        {
            //now, remove the element from our grid
            var index = $scope.ImagesData.data.indexOf(imageToDelete);
            $scope.ImagesData.data.splice(index, 1);
            $scope.$apply();
        }).fail(function(error)
        {
            $scope.DeleteError = true;
            toastr["error"](error);
            $scope.$apply();
        });
    };

    $scope.UploadFiles = (function(rawData)
    {

            var uploadFile = rawData;

            //under image state add, we create a new image and upload it
            if($scope.ImageActionState == imageStates.Add)
            {
                //transform tags
                var tags = _.map($scope.Tags, function(key)
                {
                    return {name : key.text};
                });
                //right now, no galleryId to upload
                var image = new nui.Image(null, $scope.ImageTitle, uploadFile, null, tags, $scope.SelectedSiteId);

                //the downstream promise that we return is a composite of our data update and UI update for the grid data...
                var update = Q.defer();

                //return the result of our promise upstream to the file upload control
                $scope.DataManager.Set('Image', image).then(function(result)
                {
                    //update our grid with the latest data
                    $scope.ImagesData.data.push(result);
                    update.resolve(result);
                    $scope.$apply();
                }).catch(function(error)
                {
                    update.reject(error);
                });
                return update.promise;
            }
            else if ($scope.ImageActionState == imageStates.Save)
            {

            }
    });

    //register image on action change
    $scope.ImagesData.onRegisterApi = function(gridApi) {
        //set gridApi on scope
        $scope.gridApi = gridApi;
        //post selection in grid
        gridApi.selection.on.rowSelectionChanged($scope, function (row) {
            //emit a selected site change event so that we can
            var selectedImage = row.entity;
            $scope.SelectedImage = selectedImage;
            $scope.ImageContent = selectedImage.data;

            //switch to save state
            $scope.ImageActionState = imageStates.Save;
        });
    };

    $scope.GetImages();
});

/*
Directive adapted from base upload template at :
https://css-tricks.com/examples/DragAndDropFileUploading/?submit-on-demand

we use our injected data manager to make the ajax calls within this directive
 */
var ndFileUpload = Images.directive('ndFileUpload', function(){
    return{
        restrict : 'E',
        scope: {
            /* upload callback is the callback that we should use
             our parent controller to write our file data back to the server*/
            uploadCallback: "@uploadCallback"
        },
        link: function(scope, element, attributes)
        {
            var isAdvancedUpload = (function()
            {
                var div = document.createElement( 'div' );
                return ( ( 'draggable' in div ) || ( 'ondragstart' in div && 'ondrop' in div ) ) && 'FormData' in window && 'FileReader' in window;
            })();

            //now apply the effect in this element's scope.

            var form = $(element).find('form');
            var input = form.find('input[type="file"]');
            var label = form.find( 'label' );
            var errorMsg = form.find( '.box-error span' );
            var restart	= form.find( '.box-restart' );
            var droppedFiles = false;

            var showFiles	 = (function( files )
                {
                    label.text( files.length > 1 ? ( input.attr( 'data-multiple-caption' ) || '' ).replace( '{count}', files.length ) : files[ 0 ].name );
                });

            // letting the server side to know we are going to make an Ajax request
            form.append( '<input type="hidden" name="ajax" value="1" />' );

            // automatically submit the form on file select
            input.on( 'change', function( e )
            {
                showFiles( e.target.files );
            });


            // drag&drop files if the feature is available
            if( isAdvancedUpload )
            {
                form
                    .addClass( 'has-advanced-upload' ) // letting the CSS part to know drag&drop is supported by the browser
                    .on( 'drag dragstart dragend dragover dragenter dragleave drop', function( e )
                    {
                        // preventing the unwanted behaviours
                        e.preventDefault();
                        e.stopPropagation();
                    })
                    .on( 'dragover dragenter', function() //
                    {
                        form.addClass( 'is-dragover' );
                    })
                    .on( 'dragleave dragend drop', function()
                    {
                        form.removeClass( 'is-dragover' );
                    })
                    .on( 'drop', function( e )
                    {
                        droppedFiles = e.originalEvent.dataTransfer.files; // the files that were dropped
                        showFiles( droppedFiles );
                    });
            }
            // if the form was submitted
            form.on( 'submit', function( e )
            {
                // preventing the duplicate submissions if the current one is in progress
                if( form.hasClass( 'is-uploading' ) ) return false;

                form.addClass( 'is-uploading' ).removeClass( 'is-error' );
                if( isAdvancedUpload ) // ajax file upload for modern browsers
                {
                    e.preventDefault();
                    // gathering the form data

                    //var ajaxData = new FormData( form.get( 0 ) );
                    var fileData = [];
                    if( droppedFiles )
                    {
                        _.each( droppedFiles, function( i, file )
                        {
                            fileData.push(i);
                        });
                    }
                    var callback = scope.$parent[scope.uploadCallback];
                    if(typeof(callback) !== 'function')
                    {
                        throw new Error('callback {0} is not a function!'.replace('{0}', callbackName));
                    }
                    else
                    {
                        //now read the file data using a file reader, and call our callback with this info
                        var reader = new FileReader();

                        reader.onload = function(e) {
                            var rawData = reader.result;
                            callback(rawData).then(function(result)
                            {
                                form.removeClass( 'is-uploading' );
                                form.addClass('is-success');
                            }).fail(function(error)
                            {
                                form.removeClass( 'is-uploading' );
                                alert( 'Error. File upload failed' );
                            })
                        };
                        //read the first uploaded file for this directive only
                        reader.readAsDataURL(fileData[0]);
                    }
                }
                else // fallback Ajax solution upload for older browsers
                {
                    var iframeName	= 'uploadiframe' + new Date().getTime();
                        var iframe		= $( '<iframe name="' + iframeName + '" style="display: none;"></iframe>' );

                    $( 'body' ).append( iframe );
                    form.attr( 'target', iframeName );

                    iframe.one( 'load', function()
                    {
                        var data = $.parseJSON( iframe.contents().find( 'body' ).text() );
                        form.removeClass( 'is-uploading' ).addClass( data.success == true ? 'is-success' : 'is-error' ).removeAttr( 'target' );
                        if( !data.success ) errorMsg.text( data.error );
                        iframe.remove();
                    });
                }
            });
            // restart the form if has a state of error/success
            restart.on( 'click', function( e )
            {
                e.preventDefault();
                form.removeClass( 'is-error is-success' );
                input.trigger( 'click' );
            });
            // Firefox focus bug fix for file input
            input
                .on( 'focus', function(){ input.addClass( 'has-focus' ); })
                .on( 'blur', function(){ input.removeClass( 'has-focus' ); });
        },
        templateUrl: '../../template/nui-file-upload.html'
    }
});
var Scripts = NullDelicious.controller("Scripts", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location)
{
    $scope.nui = nui;

    var deleteTemplate = nui.ui.deleteTemplate;

    $scope.ScriptsColumns = [{field : 'name', displayName : 'Name'},
        {field : 'text', displayName: 'Text'},
        {field : 'siteId', displayName: 'SiteId'},
        {field : 'Delete', cellTemplate: deleteTemplate}
    ];

    $scope.ScriptsData = {
        data : $scope.Scripts,
        columnDefs : $scope.ScriptsColumns,
        enableRowSelection: true,
        enableSelectAll: false,
        selectionRowHeaderWidth: 35,
        multiSelect: false
    };
    /*remove row functionality */
    $scope.RemoveRow = function(element) {
        var self = this;
        var targetRow = element.$parent.$parent.row;
        var targetId = targetRow.entity.id;
        //now get the index of the element that we wish to remove in our collection, and
        //delete it on the server
        var scriptToDelete = hx$.single($scope.ScriptsData.data, function(script)
        {
            return script.id === targetId;
        });

        $scope.DataManager.Delete('Script', scriptToDelete).then(function(result)
        {
            //now, remove the element from our grid
            var index = $scope.ScriptsData.data.indexOf(scriptToDelete);
            $scope.ScriptsData.data.splice(index, 1);
            $scope.$apply();
        }).fail(function(error)
        {
            $scope.DeleteError = true;
            toastr["error"](error);
            $scope.$apply();
        });
    };
    //styles states >> either adding styles or editing them
    var scriptsStates =
    {
        Add: 0,
        Save: 1
    };

    //default state is add
    $scope.ScriptActionState = scriptsStates.Add;
    $scope.ScriptActionDescriptor = (function()
    {
        return hx$.GetKeyByValue(scriptsStates, $scope.ScriptActionState) + ' Script';
    });

    $scope.ScriptAction = (function() {
        if ($scope.ScriptActionState == scriptsStates.Add) {
            var name = $scope.ScriptName;
            var text = $scope.ScriptText;
            var siteId = $scope.SelectedSiteId;
            var script = new nui.Style(null, name, text, siteId);
            $scope.DataManager.Set('Script', script).then(function (data) {
                $scope.ScriptsData.data.push(data);
                $scope.$apply();
            }).catch(function(error)
            {
                alert(error);
            });
        }
        else if ($scope.ScriptActionState == scriptsStates.Save) {
            $scope.SelectedScript.text = $scope.ScriptText;
            $scope.SelectedScript.name = $scope.ScriptName;

            $scope.DataManager.Set('Script', $scope.SelectedScript).then(function(data) {
                var gridScript = hx$.single($scope.ScriptsData.data, function(entry)
                {
                    return entry.id === $scope.SelectedScript.id;
                });
                gridScript = data;
                $scope.$apply();
            })
        }
    });

    $scope.GetScripts = (function()
    {
        if($scope.DataManager)
        {
            $scope.DataManager.Get('Script', {
                query: {key: 'siteId', value : $scope.SelectedSiteId}
            }).then(function(data)
            {
                $scope.Scripts = data;
                $scope.ScriptsData.data = $scope.Scripts;
                $scope.$apply();
            });
        }
    });

    $scope.ScriptsData.onRegisterApi = function(gridApi) {
        //set gridApi on scope
        $scope.gridApi = gridApi;
        //post selection in grid
        gridApi.selection.on.rowSelectionChanged($scope, function (row) {
            //emit a selected site change event so that we can
            var selectedScript = row.entity;
            $scope.SelectedScript = selectedScript;
            $scope.ScriptName = selectedScript.name;
            $scope.ScriptText = selectedScript.text;

            //switch to save state
            $scope.ScriptActionState = scriptsStates.Save;
        });
    };

    /*scope watches*/

    /*scope watches */
    $scope.$watch('ScriptText', function(newValue, oldValue)
    {
        $scope.$broadcast('codeChanged', newValue);
    });
    $scope.GetScripts();
});

var Styles = NullDelicious.controller("Styles", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location)
{
    $scope.nui = nui;

    //set editor columns and data

    var deleteTemplate = nui.ui.deleteTemplate;

    $scope.StylesColumns = [{field : 'name', displayName : 'Name'},
        {field : 'text', displayName: 'Text'},
        {field : 'siteId', displayName: 'SiteId'},
        {field : 'Delete', cellTemplate: deleteTemplate}
    ];

    $scope.StylesData = {
        data : $scope.Styles,
        columnDefs : $scope.StylesColumns,
        enableRowSelection: true,
        enableSelectAll: false,
        selectionRowHeaderWidth: 35,
        multiSelect: false
    };
    /*remove row functionality */
    $scope.RemoveRow = function(element) {
        var self = this;
        var targetRow = element.$parent.$parent.row;
        var targetId = targetRow.entity.id;
        //now get the index of the element that we wish to remove in our collection, and
        //delete it on the server
        var styleToDelete = hx$.single($scope.StylesData.data, function(style)
        {
            return style.id === targetId;
        });

        $scope.DataManager.Delete('Style', styleToDelete).then(function(result)
        {
            //now, remove the element from our grid
            var index = $scope.StylesData.data.indexOf(styleToDelete);
            $scope.StylesData.data.splice(index, 1);
            $scope.$apply();
        }).fail(function(error)
        {
            $scope.DeleteError = true;
            toastr["error"](error);
            $scope.$apply();
        });
    };
    //styles states >> either adding styles or editing them
    var stylesStates =
    {
        Add: 0,
        Save: 1
    };

    //default state is add
    $scope.StyleActionState = stylesStates.Add;
    $scope.StyleActionDescriptor = (function()
    {
        return hx$.GetKeyByValue(stylesStates, $scope.StyleActionState) + ' Style';
    });

    $scope.StyleAction = (function() {
        if ($scope.StyleActionState == stylesStates.Add) {
            var name = $scope.StyleName;
            var text = $scope.StyleText;
            var siteId = $scope.SelectedSiteId;
            var style = new nui.Style(null, name, text, siteId);
            $scope.DataManager.Set('Style', style).then(function (data) {
                $scope.StylesData.data.push(data);
                $scope.$apply();
            }).catch(function(error)
            {
                alert(error);
            });
        }
        else if ($scope.StyleActionState == stylesStates.Save) {
            $scope.SelectedStyle.text = $scope.StyleText;
            $scope.SelectedStyle.name = $scope.StyleName;

            $scope.DataManager.Set('Style', $scope.SelectedStyle).then(function(data) {
                var gridStyle = hx$.single($scope.StylesData.data, function(entry)
                {
                    return entry.id === $scope.SelectedStyle.id;
                });
                gridStyle = data;
                $scope.$apply();
            })
        }

    });

    $scope.GetStyles = (function()
    {
        if($scope.DataManager)
        {
            $scope.DataManager.Get('Style', {
                query: {key: 'siteId', value : $scope.SelectedSiteId}
            }).then(function(data)
            {
                $scope.Styles = data;
                $scope.StylesData.data = $scope.Styles;
                $scope.$apply();
            });
        }
    });

    $scope.StylesData.onRegisterApi = function(gridApi) {
        //set gridApi on scope
        $scope.gridApi = gridApi;
        //post selection in grid
        gridApi.selection.on.rowSelectionChanged($scope, function (row) {
            //emit a selected site change event so that we can
            var selectedStyle = row.entity;
            $scope.SelectedStyle = selectedStyle;
            $scope.StyleName = selectedStyle.name;
            $scope.StyleText = selectedStyle.text;

            //switch to save state
            $scope.StyleActionState = stylesStates.Save;
        });
    };

    /*scope watches */
    $scope.$watch('StyleText', function(newValue, oldValue)
    {
        $scope.$broadcast('codeChanged', newValue);
    });

    $scope.GetStyles();
});
var Users = NullDelicious.controller("Users", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location)
{
    //scope nui client scope through controller scope
    $scope.nui = nui;

    var deleteTemplate = nui.ui.deleteTemplate;

    var userStates =
    {
        Add: 0,
        Save: 1
    };

    $scope.UserActionState = userStates.Add;
    $scope.UserActionDescriptor = (function () {
        return hx$.GetKeyByValue(userStates, $scope.UserActionState) + ' User';
    });

    $scope.UsersColumns = [{field: 'name', displayName: 'Username'},
        {field: 'first', displayName: 'First Name'},
        {field: 'last', displayName: 'Last Name'},
        {field: 'email', displayName: 'Email'},
        {field: 'phone', displayName: 'Phone'},
        {field: 'gender', displayName: 'Gender'},
        {field: 'Delete', cellTemplate: deleteTemplate}
    ];
        $scope.UsersData = {
            data: $scope.Users,
            columnDefs: $scope.UsersColumns,
            enableRowSelection: true,
            enableSelectAll: false,
            selectionRowHeaderWidth: 35,
            multiSelect: false
        };

    $scope.GetUsers = (function()
    {
        $scope.DataManager.Get('User', {
            query: {key: 'siteId', value : $scope.SelectedSiteId}
        }).then(function(data)
        {
            $scope.Users = data;
            $scope.UsersData.data = data;
            $scope.$apply();
        });
    });

    $scope.GetPresets = (function()
    {
        //TODO: refactor this as one preset call on load of application
        $scope.DataManager.Get('Presets').then(function (data) {
            var genders = _.map(data.enums.Gender, function(value, key)
            {
                return key;
            });
            $scope.UserGenders = genders;
        });
    });

    $scope.GetRoles = (function()
    {
        $scope.DataManager.Get('Role', {query: {key: 'siteId', value : $scope.SelectedSiteId}}).then(function(data)
        {
            $scope.UserRoles = data;
            $scope.$apply();
        });
    });

    $scope.UserAction = (function () {
        //add state
        if ($scope.UserActionState == userStates.Add) {
            var user = new nui.User(null, $scope.Username, $scope.FirstName, $scope.LastName, $scope.Email, $scope.SelectedGender, $scope.Password, $scope.Phone, $scope.SelectedSiteId, $scope.SelectedRole.id);
            $scope.DataManager.Set('User', user).then(function (data) {
                $scope.UsersData.data.push(data);
                $scope.$apply();
            });
        }
        //save state
        else if ($scope.UserActionState == userStates.Save) {
            var user = new nui.User($scope.SelectedUser.id, $scope.Username, $scope.FirstName, $scope.LastName, $scope.Email, $scope.SelectedGender, $scope.Password, $scope.Phone, $scope.SelectedSiteId, $scope.SelectedRole.id);
            $scope.DataManager.Set('User', user).then(function (data) {
                //on save, modify the element in the grid
                var gridUser = hx$.single($scope.UsersData.data, function (usr) {
                    return usr.id == $scope.SelectedUser.id;
                });
                gridUser = data;
                $scope.$apply();
            });
        }

    });

    /*remove row functionality */
    $scope.RemoveRow = function(element) {
        var self = this;
        var targetRow = element.$parent.$parent.row;
        var targetId = targetRow.entity.id;
        //now get the index of the element that we wish to remove in our collection, and
        //delete it on the server
        var userToDelete = hx$.single($scope.UsersData.data, function(user)
        {
            return user.id === targetId;
        });

        $scope.DataManager.Delete('User', userToDelete).then(function(result)
        {
            //now, remove the element from our grid
            var index = $scope.UsersData.data.indexOf(userToDelete);
            $scope.UsersData.data.splice(index, 1);
            $scope.$apply();
        }).fail(function(error)
        {
            $scope.DeleteError = true;
            toastr["error"](error);
            $scope.$apply();
        });
    };

    $scope.GetUsers();
    $scope.GetPresets();
    $scope.GetRoles();

    //register grid API's
    $scope.UsersData.onRegisterApi = function (gridApi) {
        //set gridApi on scope
        $scope.gridApi = gridApi;

        gridApi.selection.on.rowSelectionChanged($scope, function (row) {
            //this is where we set our currently selected row in scope
            $scope.SelectedUser = row.entity;
            $scope.Username = $scope.SelectedUser.name;
            $scope.FirstName = $scope.SelectedUser.first;
            $scope.LastName = $scope.SelectedUser.last;
            $scope.Email = $scope.SelectedUser.email;
            $scope.SelectedGender = $scope.SelectedUser.gender;
            $scope.Password = $scope.SelectedUser.password;
            $scope.Phone = $scope.SelectedUser.phone;
            $scope.SelectedRole = hx$.single($scope.UserRoles, function(data)
            {
                return data.id === $scope.SelectedUser.roleId;
            });

            //now change our action to a save action
            $scope.UserActionState = userStates.Save;
        });
    };
});

var Roles = NullDelicious.controller("Roles", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location) {
    $scope.nui = nui;

    var roleStates =
    {
        Add: 0,
        Save: 1
    };

    //default state is add
    $scope.RoleActionState = roleStates.Add;
    $scope.RoleActionDescriptor = (function () {
        return hx$.GetKeyByValue(roleStates, $scope.RoleActionState) + ' Role';
    });

    var deleteTemplate = nui.ui.deleteTemplate;

    $scope.RoleColumns = [{field: 'name', displayName: 'Name'},
        {field: 'access', displayName: 'Access'},
        {field: 'siteScoped', displayName: 'Site Scoped'},
        {field: 'userScoped', displayName: 'User Scoped'},
        {field: 'Delete', cellTemplate: deleteTemplate}
    ];

    $scope.RoleData = {
        data: $scope.Roles,
        columnDefs: $scope.RoleColumns,
        enableRowSelection: true,
        enableSelectAll: false,
        selectionRowHeaderWidth: 35,
        multiSelect: false
    };

    $scope.GetRoles = (function () {
        if ($scope.DataManager) {
            $scope.DataManager.Get('Role', {
                query: {key: 'siteId', value: $scope.SelectedSiteId}
            }).then(function (data) {
                if (data.length > 0) {
                    $scope.Roles = data;
                    $scope.RoleData.data = $scope.Roles;
                    $scope.$apply();
                }
            });
        }
    });

    //TODO: refactor this as one preset call on load of application
    $scope.GetPresets = (function () {
        if ($scope.DataManager) {
            $scope.DataManager.Get('Presets').then(function (data) {
                //assign result to scope value for role grid
                $scope.roleDefinitions = data;
                //assign only keys to roledefinitions - we don't want to show the whole schema
                $scope.roleDefinitions.schemas = _.map($scope.roleDefinitions.schemas, function (value, key) {
                    return key;
                });

                $scope.DefaultRoleAccess = _.map($scope.roleDefinitions.schemas, function (value, key) {
                    return {resource: value, actions: []};
                });

                $scope.$apply();
            });
        }
    });

    //toggle role action - whether it is on or off for this scope
    $scope.ToggleRole = (function (schema, action) {
        //get the object that matches the role access
        //now add or remove it from the access array
        var access = hx$.single($scope.DefaultRoleAccess, function (element) {
            return element.resource == schema;
        });
        if (access.actions.indexOf(action) == -1) {
            access.actions.push(action);
        }
        else {
            hx$.removeFirst(access.actions, function (element) {
                return element == action;
            });
        }
    });

    //whether or not we should display our button as highlighted

    $scope.Highlighted = (function (schema, action)
    {
        var access = hx$.single($scope.DefaultRoleAccess, function(element) {
            return element.resource == schema;

        });
        //if our schema, action pair already exists, then we want to highlight this role in the UI
        return access.actions.indexOf(action) > -1;
    });


    //role save/write action

    $scope.RoleAction = (function () {
        //add state
        if ($scope.RoleActionState == roleStates.Add) {
            var role = new nui.Role($scope.RoleName, $scope.UserScopedRole, $scope.SiteScopedRole, $scope.DefaultRoleAccess, $scope.SelectedSiteId);
            $scope.DataManager.Set('Role', role).then(function (data) {
                $scope.RoleData.data.push(data);
                $scope.$apply();
            });
        }
        //save state
        else if ($scope.RoleActionState == roleStates.Save) {
            var role = new nui.Role($scope.RoleName, $scope.UserScopedRole, $scope.SiteScopedRole, $scope.DefaultRoleAccess, $scope.SelectedRole.siteId, $scope.SelectedRole.id);
            $scope.DataManager.Set('Role', role).then(function (data) {
                //on save, modify the element in the grid
                var gridRole = hx$.single($scope.RoleData.data, function (rl) {
                    return rl.id == $scope.SelectedRole.id;
                });
                gridRole = data;
                $scope.$apply();
            });
        }

    });

    //grid row removal
    $scope.RemoveRow = function(element) {
        var self = this;
        var targetRow = element.$parent.$parent.row;
        var targetId = targetRow.entity.id;
        //now get the index of the element that we wish to remove in our collection, and
        //delete it on the server
        var roleToDelete = hx$.single($scope.RoleData.data, function (role) {
            return role.id === targetId;
        });

        $scope.DataManager.Delete('Role', roleToDelete).then(function (result) {
            //now, remove the element from our grid
            var index = $scope.RoleData.data.indexOf(roleToDelete);
            $scope.RoleData.data.splice(index, 1);
            $scope.$apply();
        }).fail(function (error) {
            $scope.DeleteError = true;
            toastr["error"](error);
            $scope.$apply();
        });
    };

    //get presets for our role scope
    $scope.GetPresets();
    //get roles for our present site selection
    $scope.GetRoles();

    //register grid API's
    $scope.RoleData.onRegisterApi = function (gridApi) {
        //set gridApi on scope
        $scope.gridApi = gridApi;

        gridApi.selection.on.rowSelectionChanged($scope, function (row) {
            //this is where we set our currently selected row in scope
            $scope.SelectedRole = row.entity;
            $scope.RoleName = $scope.SelectedRole.name;
            $scope.UserScopedRole = $scope.SelectedRole.userScoped;
            $scope.SiteScopedRole = $scope.SelectedRole.siteScoped;
            var access = $scope.SelectedRole.access;
            //transform access and re-assign it to our scope
            var convertedAccess = _.map(access, function(object)
            {
                var convertedActions = _.map(object.actions, function(action)
                {
                    return action.name;
                });
                return {resource: object.resource, actions: convertedActions};
            });
            $scope.DefaultRoleAccess = convertedAccess;

            //now change our action to a save action
            $scope.RoleActionState = roleStates.Save;
        });
    };
});

//Template controller -> controls which templates are active on our site. Retrieves themes from storage
var template = NullDelicious.controller("Template", function ($scope, $http, $localStorage, $sessionStorage, $route, $routeParams, $location){
    $scope.nui = nui;
        var templateStates =
        {
            Add: 0,
            Save: 1
        };
    
        //default state is add
        $scope.TemplateActionState = templateStates.Add;
        $scope.TemplateActionDescriptor = (function () {
            return hx$.GetKeyByValue(templateStates, $scope.TemplateActionState) + ' Template';
        });
    
        var deleteTemplate = nui.ui.deleteTemplate;
    
        $scope.TemplateColumns = [{field: 'name', displayName: 'Name'},
            {field: 'text', displayName: 'Text'},
            {field: 'parameters', displayName: 'Parameters'},
            {field: 'Delete', cellTemplate: deleteTemplate}
        ];
    
        $scope.TemplateData = {
            data: $scope.Templates,
            columnDefs: $scope.TemplateColumns,
            enableRowSelection: true,
            enableSelectAll: false,
            selectionRowHeaderWidth: 35,
            multiSelect: false
        };
    
        $scope.GetTemplates = (function () {
            if ($scope.DataManager) {
                $scope.DataManager.Get('Theme', {
                    query: {key: 'siteId', value: $scope.SelectedSiteId}
                }).then(function (data) {
                    if (data.length > 0) {
                        $scope.Templates = data;
                        $scope.TemplateData.data = $scope.Templates;
                        $scope.$apply();
                    }
                });
            }
        });

        //callbacks

        //template save/write action
    $scope.TemplateAction = (function () {
        //add state
        if ($scope.TemplateActionState == templateStates.Add) {
            var theme = new nui.Theme(null, $scope.TemplateText, $scope.TemplateName, $scope.TemplateText, null, $scope.SelectedSiteId);
            $scope.DataManager.Set('Theme', theme).then(function (data) {
                $scope.TemplateData.data.push(data);
                $scope.$apply();
            });
        }
        //save state
        else if ($scope.TemplateActionState == templateStates.Save) {
            var theme = new nui.Theme($scope.SelectedTemplateId, $scope.TemplateText, $scope.TemplateName, $scope.TemplateText, null, $scope.SelectedSiteId);
            $scope.DataManager.Set('Theme', theme).then(function (data) {
                //on save, modify the element in the grid
                var gridTemplate = hx$.single($scope.TemplateData.data, function (rl) {
                    return rl.id == $scope.SelectedTemplateId;
                });
                gridTemplate = data;
                $scope.$apply();
            });
        }

    });

    //grid row removal
    $scope.RemoveRow = function(element) {
        var self = this;
        var targetRow = element.$parent.$parent.row;
        var targetId = targetRow.entity.id;
        //now get the index of the element that we wish to remove in our collection, and
        //delete it on the server
        var templateToDelete = hx$.single($scope.TemplateData.data, function (template) {
            return template.id === targetId;
        });

        $scope.DataManager.Delete('Template', templateToDelete).then(function (result) {
            //now, remove the element from our grid
            var index = $scope.TemplateData.data.indexOf(templateToDelete);
            $scope.TemplateData.data.splice(index, 1);
            $scope.$apply();
        }).fail(function (error) {
            $scope.DeleteError = true;
            toastr["error"](error);
            $scope.$apply();
        });
    };

    //get templates
    $scope.GetTemplates();

    //register grid API's
    $scope.TemplateData.onRegisterApi = function (gridApi) {
        //set gridApi on scope
        $scope.gridApi = gridApi;

        gridApi.selection.on.rowSelectionChanged($scope, function (row) {
            //this is where we set our currently selected row in scope
            $scope.SelectedTemplate = row.entity;
            $scope.TemplateName = $scope.SelectedTemplate.name;
            $scope.SelectedTemplateId = row.entity.id;

            $scope.TemplateActionState = templateStates.Save;
        });
    }
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
            .when('/Roles', {templateUrl: 'Roles.html', controller: "Roles"})
            .when('/Scripts', {templateUrl: 'Scripts.html', controller: "Scripts"})
            .when('/Templates', {templateUrl: 'Template.html', controller: "Template"})
    }]);