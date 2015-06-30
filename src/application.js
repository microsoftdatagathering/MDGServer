(function () {
  'use strict';

  angular.module('mdg', ['ui.router', 'ui.sortable',
    'ngDragDrop', 'ngSanitize', 'ngDropdowns',
    'config', 'base64', 'ngCookies', 'pascalprecht.translate',

    'mdg.app.authorization',
    'mdg.app.offline',

    'mdg.app.errorsService',
    'mdg.app.validation',

    'mdg.app.subscription',
    'mdg.app.sms',

    'mdg.ui.autoComplete',
    'mdg.ui.questionBuilder',
    'mdg.ui.cascadeQuestion',
    'mdg.ui.timeSelector',
    'mdg.ui.csvOptionsImport',

    'mdg.ui.dateInput',
    'mdg.ui.dateRange',

    'mdg.ui.errorsblock',
    'mdg.ui.expand',
    'mdg.ui.validatePhoneNumber',
    'mdg.ui.validatePattern',
    'mdg.ui.notifications',
    'mdg.ui.nfEvent',

    'mdg.ui.fileSelect',
    'mdg.ui.focusMe',

    'mdg.app.page',
    'mdg.app.surveys',
    'mdg.app.users',
    'mdg.app.results',
    'mdg.app.sync'


  ], function ($httpProvider) {
    $httpProvider.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
    $httpProvider.defaults.headers.put['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';

    $httpProvider.defaults.transformRequest = [function (data) {
      /**
       *
       * @param {Object} obj
       * @return {String}
       */
      var param = function (obj) {
        var query = '',
          name, value, fullSubName, subValue, innerObj, i, subName;

        for (name in obj) {
          value = obj[name];
          if (value instanceof Array) {
            for (i = 0; i < value.length; ++i) {
              subValue = value[i];
              fullSubName = name + '[' + i + ']';
              innerObj = {};
              innerObj[fullSubName] = subValue;
              query += param(innerObj) + '&';
            }
          } else if (value instanceof Object) {
            for (subName in value) {
              subValue = value[subName];
              fullSubName = name + '[' + subName + ']';
              innerObj = {};
              innerObj[fullSubName] = subValue;
              query += param(innerObj) + '&';
            }
          } else if (value !== undefined && value !== null) {
            query += encodeURIComponent(name) + '=' + encodeURIComponent(value) + '&';
          }
        }

        return query.length ? query.substr(0, query.length - 1) : query;
      };

      return angular.isObject(data) && String(data) !== '[object File]' ? param(data) : data;
    }];

    var interceptor = ['$rootScope', '$q', '$window', '$location', function ($scope, $q, $window, $location) {

      function success(response) {
        return response;
      }

      function error(response) {
        var status = response.status;

        if (status == 401) {
          window.document.location.href = '/home';
        }

        if (status === 404 || status >= 500 || status === 0) {
          $scope.offlineMode = true;
          localStorage.setItem('offlineMode', true);
          return response;
        }

        return $q.reject(response);
      }

      return function (promise) {
        return promise.then(success, error);
      };
    }];

    $httpProvider.responseInterceptors.push(interceptor);
  });


  angular.module('mdg').filter('cascadeFilter', [function () {
    return function (questions) {
      var exp = new RegExp('cascade([^1]\\d*|\\d{2,})'),
        tempQuestions = [];
      angular.forEach(questions, function (question) {
        if (!exp.test(question.type)) {
          tempQuestions.push(question);
        }
      });
      return tempQuestions;
    };
  }]);

  angular.module('mdg').filter('deletedItemsFilter', ['$rootScope', function ($rootScope) {
    return function (items, type) {
      angular.forEach(items, function (item) {
        if (_.find($rootScope.deletedItems[type], function (id) {
            return id === item._id;
          })) {
          item.hidden = true;
        }
      });

      return items;
    };
  }]);

  angular.module('mdg').filter('selectPublished', function () {
    return function (array, selectVal) {
      if (!selectVal) {
        return array;
      }

      if (selectVal === 'Published') {
        return _(array).filter(function (item) {
          return item.published;
        });
      }

      if (selectVal === 'Unpublished') {
        return _(array).filter(function (item) {
          return !item.published;
        });
      }
    };
  });

  angular.module('mdg').config(function ($urlRouterProvider, $stateProvider) {
    $urlRouterProvider
      .otherwise('/surveys/list');
    $stateProvider
      .state('page', {
        url: '',
        templateUrl: 'app/index.html',
        controller: 'PageController',
        abstract: true,
      });
  });

  angular.module('mdg').config(['$translateProvider', function ($translateProvider) {

    $translateProvider.useStaticFilesLoader({
      prefix: 'languages/locale-',
      suffix: '.json'
    });

    $translateProvider.useMessageFormatInterpolation();
    $translateProvider.useCookieStorage();
  }]);

  angular.module('mdg').run(function ($templateCache, $rootScope, $location, $state, $stateParams, authorizationService, $anchorScroll) {
    if (window.addTemplatesToCache) {
      window.addTemplatesToCache($templateCache);
    }
    $rootScope.generateUUID = function () {
      return 'id_' + UUIDjs.create().toString().replace(/-/g, '_');
    };

    $rootScope.$on('$stateChangeSuccess', function () {
      $location.hash($rootScope.scrollTo);
      $anchorScroll();
      $rootScope.scrollTo = null;
    });

    $rootScope.version = window.version;
    $rootScope.$state = $state;
    $rootScope.$stateParams = $stateParams;
    $rootScope.goState = function (state, stateParams) {
      $rootScope.scrollTo = stateParams ? stateParams.scrollTo : undefined;
      $state.go(state, stateParams);
    };
    $rootScope.setRoute = function (route) {
      $location.path(route);
    };
    $rootScope.back = function () {
      window.history.back();
    };

    $rootScope.offlineMode = JSON.parse(localStorage.getItem('offlineMode'));
    $rootScope.loggedInUser = JSON.parse(localStorage.getItem('user'));

    $rootScope.deletedItems = {
      surveys: [],
      users: [],
      groups: [],
      results: []
    };

    $rootScope.logout = function () {
      var logout = function () {
        authorizationService.logout().then(
          function success() {
            localStorage.clear();
            window.document.location.href = '/home';
          },

          function failed(err) {
            console.log("error:", err);
          });
      };

      if ($location.$$path.indexOf('/editsurvey:') !== -1 || $location.$$path.indexOf('/builder') !== -1) {
        $state.go('page.surveys');

        $rootScope.saveSurveyPromise.then(
          function success() {
            logout();
          });
      } else {
        logout();
      }
    };

    $rootScope.$on('$stateChangeStart', function (event, toState) {
      if (!$rootScope.loggedInUser) {
        $rootScope.offlineMode = false;
        localStorage.clear();
      }

      if ($rootScope.offlineMode &&
        toState.name !== 'page.surveys' && toState.name !== 'page.builder' && toState.name !== 'page.editsurvey' &&
        toState.name !== 'page.surveys.sync' && toState.name !== 'page.builder.sync' && toState.name !== 'page.editsurvey.sync') {
        event.preventDefault();
      } else {
        authorizationService.getUserPermission().then(
          function success(config) {
            if (!$rootScope.offlineMode) {
              $rootScope.loggedInUser = config.data;
              localStorage.setItem('user', JSON.stringify(config.data));
            }

            if ($rootScope.loggedInUser && toState.name === 'page') {
              event.preventDefault();
              $location.path('/surveys');
            }
          },

          function failed(err) {
            if (toState.name === 'page') {
              event.preventDefault();
              window.document.location.href = '/home';
            }

            console.log("error:", err);
          });
      }
    });

  });
})();