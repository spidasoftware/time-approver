var fs = require('fs');
var R = require('ramda');
var _ = require('lodash');
var cheerio = require('cheerio');
var request = require('request');
var Promise = require('bluebird');
var async = require('async');

var moment = require('moment');
var colors = require('colors');
var userHome = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
var cfgText = fs.readFileSync(userHome + '/.timeConfig.json', {
  encoding: 'utf8'
});

var printer = function(text, level, type){
  console.log(text+" "+level+" "+type);
}

var cfg = R.mixin({
  server: 'http://spidamin.com',
  initial: '/portal/web/guest/home',
  login: '/portal/web/guest/home?p_p_id=58&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&p_p_col_id=column-1&p_p_col_count=1&saveLastPath=0&_58_struts_action=%2Flogin%2Flogin',
  timePage: '/portal/group/10137/time-reporting',
  approveTime: '/portal/group/10137/time-reporting?p_p_id=TimeReportingPortlet_WAR_TimeReportingPortlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage&p_p_col_id=column-1&p_p_col_count=1&_TimeReportingPortlet_WAR_TimeReportingPortlet_action=approveTimeReporting'
}, JSON.parse(cfgText));

var jar = request.jar();

var req = Promise.promisify(request.defaults({
  jar: jar,
  followAllRedirects: true
}));

var makeObj = R.reduce(function(a, b) {
  if (!a) {
    a = {};
  }
  a[b[0]] = b[1];
  return a;
}, false);

var findOptions = R.curry(function(jq, id) {
  return jq("#" + id + " option");
});

var getOptionValue = R.path('attribs.value');

var getOptionText = R.path('children.0.data');

var getOptions = function(jq) {
  return R.mapObj(R.compose(makeObj, R.map(function(ele) {
    return [getOptionText(ele), getOptionValue(ele)];
  }), R.filter(getOptionValue), R.values, findOptions(jq)))({
    orgs: 'groupId',
    tasks: 'task'
  });
};

var parseTimeBody = function(body) {
  var jq;
  jq = cheerio.load(body);
  return R.mixin(getOptions(jq), {
    name: jq('#employee').val()
  });
};

var startDate = moment().day(-6).format("MM/DD/YYYY");
var endDate = moment().day(0).format("MM/DD/YYYY");

var requestEmployeeTime = function(employee, callback, approve) {
  var result = "searchTimeByEmployee=" + "&employeeName=" + encodeURIComponent(employee) + "&compId=" + encodeURIComponent("all") + "&startDate=" + encodeURIComponent(startDate) + "&endDate=" + encodeURIComponent(endDate);

  var url = cfg.server + cfg.approveTime;
  var employeeTimeList = [];
  request({
    url: url,
    headers: {
      'Referer': 'http://spidamin.com/portal/group/10137/time-reporting?p_p_id=TimeReportingPortlet_WAR_TimeReportingPortlet&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&p_p_col_id=column-1&p_p_col_count=1&_TimeReportingPortlet_WAR_TimeReportingPortlet_action=approveTimeReporting',
      'Content-type': 'application/x-www-form-urlencoded',
      'Accept': "*/*"
    },
    jar: jar,
    followAllRedirects: true,
    method: 'POST',
    body: result
  }, function(error, response, body) {
    try {
      var time = _.map(JSON.parse(body).data, function(entry) {
        var values = entry[Object.keys(entry)[0]].split("|");
        return {
          id: Object.keys(entry)[0],
          date: values[0],
          task: values[3],
          billing: values[8],
          description: values[7],
          time: values[4],
          proposal: values[2],
          approved: values[6] === "Approved",
          disapproved: values[6] === "Disapproved"
        };
      });
      employeeTimeList.push(time);
      if (approve) {
        var approveTime = function(time) {
          var notApproved = _.filter(time, function(entry) {
            return !entry.approved
          });
          var ids = _.map(notApproved, function(entry) {
            return entry.id
          });
          printer("Approving " + ids.length + " entries out of " + time.length + " for " + employee)
          var result = "approveAll=" + ids.join(",");

          //Only approve this employee if there are unapproved entries.
          if (ids.length > 0) {
            request({
              url: url,
              headers: {
                'Referer': 'http://spidamin.com/portal/group/10137/time-reporting?p_p_id=TimeReportingPortlet_WAR_TimeReportingPortlet&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&p_p_col_id=column-1&p_p_col_count=1&_TimeReportingPortlet_WAR_TimeReportingPortlet_action=approveTimeReporting',
                'Content-type': 'application/x-www-form-urlencoded',
                'Accept': "*/*"
              },
              jar: jar,
              followAllRedirects: true,
              method: 'POST',
              body: result
            }, function(error, response, body) {
              if (error || body.trim() !== "") {
                //Check the response body, because sometimes min sends XML if there is an error
                printer("Error (" + error + ") approving time for " + employee + ", trying again.", "error");
                requestEmployeeTime(employee, callback, approve)
              } else {
                //Trigger the next one.
                callback(null, _.flatten(employeeTimeList));
              }
            })
          }
        };
        //Call the approve time loop.
        approveTime(time);
      } else {
        //Trigger the next one.
        callback(null, _.flatten(employeeTimeList));
      }
    } catch (err) {
      printer("Error (" + err + ")requesting time for " + employee + ", trying again.");
      requestEmployeeTime(employee, callback, approve)
    }
  });
};

var reviewer = function(approve) {

  printer("Time Approver", null, "heading");
  if (approve) {
    printer("Approving from: " + startDate + " to " + endDate);
  } else {
    printer("Reviewing from: " + startDate + " to " + endDate);
  }

  req({
    url: cfg.server + cfg.initial
  }).then(function() {
    return req({
      url: cfg.server + cfg.login,
      method: 'POST',
      form: {
        _58_redirect: '',
        _58_rememberMe: false,
        _58_login: cfg.email,
        _58_password: cfg.password
      }
    });
  }).spread(function(resp, body) {
    if (body.indexOf('You are signed in as' > 0)) {
      return req({
        url: cfg.server + cfg.timePage
      });
    } else {
      printer("You are not logged in", "warning")
    }
  }).then(function() {
    var workers = cfg.employees.slice(0);
    if (!approve) {
      workers.push(cfg.me)
    }
    printer("Employees: " + JSON.stringify(workers))

    // 1st para in async.each() is the array of items
    // https://github.com/caolan/async#parallel
    var par = {}
    _.each(workers, function(employee) {
      if (employee.indexOf(", ") < 0) {
        printer("ERROR " + employee + " does not contain a comma and a space after the first name, please fix and try again.", "error")
        printer("The approver must be restarted to reload the config", "error")
        throw "tmeConfig.json employee is misconfigured."
      }
      par[employee] = function(callback) {
        //Let try to not bring down min, randomly distribute the requests of 10 seconds.
        var wait = Math.round(Math.random() * 10000);
        setTimeout(function() {
          requestEmployeeTime(employee, callback, approve)
        }, wait);
      }
    });
    printer("Requesting time for employees, spacing calls out over 10 seconds so we don't bring down SPIDAMin");
    async.parallel(par,
      //Called when completed
      function(errors, results) {
        // All tasks are done now, if not approving print time form employee

        if (!approve) {
          //Hijacking what I think is the err message for the call back
          _.forIn(results, function(times, name) {

            var sum = 0;
            _.each(times, function(entry) {
              sum += parseFloat(entry.time)
            });
            printer(name + ": " + sum, null, "heading");
            _.each(times, function(entry) {
              if (entry.approved) {
                printer(entry, "success", "time");
              } else if (entry.disapproved) {
                printer(entry, "error", "time");
              } else {
                printer(entry, null , "time");
              }
            });

          });
        }
      })
  });
};


var disapprover = function(event, id, reason){
  //DisBttTimeId:4028e4885048e5ad01505ca272b313db
  //DisBttTimeRemark:Testing
  var params = "clearRow=&DisBttTimeId="+id + "&DisBttTimeRemark=" + encodeURIComponent(reason)
  var url = cfg.server + cfg.approveTime;
  request({
    url: url,
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
      'Accept': "*/*"
    },
    jar: jar,
    followAllRedirects: true,
    method: 'POST',
    body: params
  }, function(error, response, body) {
    if (error) {
      event.returnValue = false;
    } else {
      event.returnValue = true;
    }
  })
};

/**
* The main export.  Pass in the printer of the responses
*/
module.exports = function(p){
  printer = p
  return {
    reviewer: reviewer,
    disapprover: disapprover
  }
};
