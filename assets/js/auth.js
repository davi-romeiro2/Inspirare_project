// Inspirare auth helper. Browser-side, no build step.
// Exposes window.InspirareAuth with token storage + a thin fetch() wrapper.

(function () {
  'use strict';

  var TOKEN_KEY = 'inspirare_token';
  var PROFILE_KEY = 'inspirare_profile';
  // In production this would come from a config file or <meta> tag.
  var API_BASE = 'http://localhost:3000/api';

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (_e) { return null; }
  }

  function setToken(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch (_e) { /* ignore */ }
  }

  function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (_e) { /* ignore */ }
  }

  function getProfile() {
    try {
      var raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) { return null; }
  }

  function setProfile(profile) {
    try {
      if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      else localStorage.removeItem(PROFILE_KEY);
    } catch (_e) { /* ignore */ }
  }

  function clearProfile() {
    try { localStorage.removeItem(PROFILE_KEY); } catch (_e) { /* ignore */ }
  }

  function api(path, options) {
    options = options || {};
    var headers = Object.assign(
      { 'Content-Type': 'application/json' },
      options.headers || {}
    );
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    return fetch(API_BASE + path, Object.assign({}, options, { headers: headers }))
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) {
            var err = new Error((data && (data.message || data.error)) || ('http_' + res.status));
            err.status = res.status;
            err.code = data && data.error;
            err.fields = data && data.fields;
            throw err;
          }
          return data;
        });
      });
  }

  window.InspirareAuth = {
    getToken: getToken, setToken: setToken, clearToken: clearToken,
    getProfile: getProfile, setProfile: setProfile, clearProfile: clearProfile,
    api: api,
  };
})();
