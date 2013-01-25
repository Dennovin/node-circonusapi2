/**
 * Tiny library for interacting with Circonus' API v2
 *
 * Exported methods
 *  setup:  inital setup function to give the API your auth token an app name
 *  get, post, put, delete: docs for each method below, are proxies for the
 *                          various methods for REST calls
 *
 * Notes:
 *  callback functions take 3 args (code, error, body)
 *    code:   HTTP Response code, if null a non HTTP error occurred
 *    error:  Error message from API, null on 200 responses
 *    body:   Response body, i.e. the thing you probably want
 */

var https = require('https'),
    qs = require('querystring'),
    apihost = 'api.circonus.com',
    apiport = 443,
    apipath = '/v2/',
    authtoken = null,
    appname = null;

exports.setup = function (token, app) {
  authtoken = token;
  appname = app;
};

/**
 * GET:
 *
 *  endpoint: (/check_bundle, /check/1, etc.)
 *  data:     object which will be converted to a query string
 *  callback: what do we call when the response from the server is complete, 
 *            arguments are callback(code, error, body)
 */
exports.get = function (endpoint, data, callback) {
  var options = get_request_options('GET', endpoint, data);
  do_request(options, callback);
};

/**
 * POST:
 *
 *  endpoint: specify an object collection (/check_bundle, /graph, etc.)
 *  data:     object which will be stringified to JSON and written to the server
 *  callback: what do we call when the response from the server is complete, 
 *            arguments are callback(code, error, body)
 */
exports.post = function (endpoint, data, callback) {
  var options = get_request_options('POST', endpoint, data);
  do_request(options, callback);
};

/**
 * PUT:
 *
 *  endpoint: specify an exact object (/check_bundle/1, /template/2, etc.)
 *  data:     object which will be stringified to JSON and written to the server
 *  callback: what do we call when the response from the server is complete, 
 *            arguments are callback(code, error, body)
 */
exports.put = function (endpoint, data, callback) {
  var options = get_request_options('PUT', endpoint, data);
  do_request(options, callback);
};

/**
 * DELETE:
 *
 *  endpoint: specify an exact object (/check_bundle/1, /rule_set/1_foo, etc.)
 *  callback: what do we call when the response from the server is complete, 
 *            arguments are callback(code, error, body)
 */
exports.delete = function (endpoint, callback) {
  var options = get_request_options('DELETE', endpoint);
  do_request(options, callback);
};

/**
 * This is called from the various exported functions to actually perform
 * the request.  Will retry up to 5 times in the event we get a connection
 * reset error.
 */ 
var do_request = function (options, callback) {
  var req = https.request(options, function(res) {
    var body = '';

    res.on('data', function(chunk) {
      body += chunk; 
    });

    res.on('end', function() {
      var err_msg = null;

      // If this isn't a 200 level, extract the message from the body
      if ( res.statusCode < 200 || res.statusCode > 299 ) {
        try {
          err_msg = JSON.parse(body).message;
        }
        catch (err) {
          err_msg = "An error occurred, but the body could not be parsed: " + err;
        }
      }

      callback(res.statusCode, err_msg, (body) ? JSON.parse(body) : null);
    });
  });

  req.on('error', function(e) {
    if ( e.code === 'ECONNRESET' && options.circapi.retry < 5 ) {
      options.circapi.retry += 1;
      // sleep 1 second and try again, probably hit the rate limit
      setTimeout(function() {
        this.do_request(options, callback);
      }, 1000 * options.circapi.retry);
    }
    else {
      callback(null, e.message, null);
    }
  });

  if ( options.method.toUpperCase() === 'POST' || options.method.toUpperCase() === 'PUT' ) {
    req.write(JSON.stringify(options.circapi.data));
  }
  req.end();
};

/**
 * Hands back an options object suitable to use with the HTTPS class
 */
var get_request_options = function (method, endpoint, data) {
  var options = {
        host: apihost,
        port: apiport,
        path: apipath,
        method: method.toUpperCase(),
        agent: false,
        headers: {
          "X-Circonus-Auth-Token": authtoken,
          "X-Circonus-App-Name": appname,
          "Accept": "application/json"
        },
        circapi: {
          retry: 0,
          data: null
        }
      };

  options.circapi.data = data;
  if ( options.method === 'GET' && data !== null && Object.keys(data).length !== 0 ) {
    options.path += '?' + qs.stringify(data);
  }

  if ( endpoint.match(/^\//) ) {
    endpoint = endpoint.substring(1);
  }
  options.path += endpoint;

  return options;
};
