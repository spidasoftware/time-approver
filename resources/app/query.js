var fs = require('fs');
var R = require('ramda');
var _ = require('lodash');
var cheerio = require('cheerio');
var request = require('request');
var Promise = require('bluebird');
var async = require('async');

var moment = require('moment');
var colors = require('colors');

var cfgText = fs.readFileSync(process.env.HOME + '/.timeConfig.json', {
    encoding: 'utf8'
});

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

var makeObj = R.reduce(function (a, b) {
    if (!a) {
        a = {};
    }
    a[b[0]] = b[1];
    return a;
}, false);

var findOptions = R.curry(function (jq, id) {
    return jq("#" + id + " option");
});

var getOptionValue = R.path('attribs.value');

var getOptionText = R.path('children.0.data');

var getOptions = function (jq) {
    return R.mapObj(R.compose(makeObj, R.map(function (ele) {
        return [getOptionText(ele), getOptionValue(ele)];
    }), R.filter(getOptionValue), R.values, findOptions(jq)))({
        orgs: 'groupId',
        tasks: 'task'
    });
};

var parseTimeBody = function (body) {
    var jq;
    jq = cheerio.load(body);
    return R.mixin(getOptions(jq), {
        name: jq('#employee').val()
    });
};

var startDate = moment().day(-6).format("MM/DD/YYYY");
var endDate = moment().day(0).format("MM/DD/YYYY");

var requestEmployeeTime = function (employee, companyId, employeeTimeMap, callback, approve) {
    var result = "searchTimeByEmployee=" + "&employeeName=" + encodeURIComponent(employee)
        + "&compId=" + encodeURIComponent(companyId) + "&startDate=" + encodeURIComponent(startDate)
        + "&endDate=" + encodeURIComponent(endDate);

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
    }, function (error, response, body) {
        try {
            var time = _.map(JSON.parse(body).data, function (entry) {
                var values = entry[Object.keys(entry)[0]].split("|");
                return {
                    id: Object.keys(entry)[0],
                    date: values[0],
                    info: values[1] + " " + values[2] + " " + values[3] + " " + values[7],
                    time: values[4],
                    approved: values[6] === "Approved"
                };
            });
            employeeTimeList.push(time);
            if (approve) {

                var approveTime = function (time) {
                    var result = "approveAll=" + _.map(time, function (entry) {
                        return entry.id
                    }).join(",");
                    req({
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
                    }, function (error, response, body) {
                        if (error) {
                            approveTime(time)
                        }
                    })
                }

            }
            //Trigger the next one.
            callback(employeeTimeList);
        } catch (err) {
            console.error(err + employeeTimeMap);
            console.log("Error on " + employee + " " + companyId);
            requestEmployeeTime(employee, companyId, employeeTimeMap, callback, approve)
        }
    });
};

var query = function (approve) {
    console.log("From: " + startDate + " to " + endDate);

    req({
        url: cfg.server + cfg.initial
    }).then(function () {
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
    }).spread(function (resp, body) {
        if (body.indexOf('You are signed in as' > 0)) {
            return req({url: cfg.server + cfg.timePage});
        } else {
            console.log("You are not logged in")
        }
    }).then(function () {

        var workers = cfg.employees;
        if (!approve) {
            workers.push(cfg.me)
        }

        var employeeTimeMap = {};

        _.each(workers, function (employee) {
            console.log("Employee " + employee.name);
            employeeTimeMap[employee.name] = [];

            // 1st para in async.each() is the array of items
            async.each(employee.companyIds,
                function (companyId, callback) {
                    requestEmployeeTime(employee.name, companyId, employeeTimeMap, callback, approve)
                },

                //Called when completed
                function (employeeTimeList) {
                    // All tasks are done now, if not approving print time form employee

                    if (!approve) {
                        console.log(employee.name.yellow);
                        _.each(employeeTimeList[0], function (entry) {
                            var logString = entry.time + " " + entry.date + ": " + entry.info;
                            if (entry.approved) {
                                console.log(logString.green);
                            } else {
                                console.log(logString.red);
                            }
                        });
                        var sum = 0;
                        _.each(employeeTimeList[0], function (entry) {
                            sum += parseFloat(entry.time)
                        });
                        console.log("Total: " + sum);
                        console.log("---------------------------------------------------")
                    }
                }
            );
        });

    });
};

module.exports = query;

