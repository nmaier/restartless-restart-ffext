/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Speak Words.
 *
 * The Initial Developer of the Original Code is The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Edward Lee <edilee@mozilla.com>
 *   Erik Vold <erikvvold@gmail.com>
 *   Nils Maier <maierman@web.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// make XHR available, if it isn't already
if (!('XMLHttpRequest' in this)) {
  this.XMLHttpRequest = Components.Constructor(
    "@mozilla.org/xmlextras/xmlhttprequest;1",
    "nsIXMLHttpRequest");
}

/**
 * Waits for a browser window to finish loading before running the callback
 *
 * @usage runOnLoad(window, callback): Apply a callback to to run on a window when it loads.
 * @param [function] callback: 1-parameter function that gets a browser window.
 */
function runOnLoad(window, callback) {
  // Listen for one load event before checking the window type
  window.addEventListener("load", function() {
    window.removeEventListener("load", arguments.callee, false);

    // Now that the window has loaded, only handle browser windows
    if (window.document.documentElement.getAttribute("windowtype") == "navigator:browser")
      callback(window);
  }, false);
}


/**
 * Add functionality to existing browser windows
 *
 * @usage runOnWindows(callback): Apply a callback to each open browser window.
 * @param [function] callback: 1-parameter function that gets a browser window.
 */
function runOnWindows(callback) {
  // Wrap the callback in a function that ignores failures
  function watcher(window) {
    try {
      callback(window);
    }
    catch(ex) {}
  }

  // Add functionality to existing windows
  let browserWindows = Services.wm.getEnumerator("navigator:browser");
  while (browserWindows.hasMoreElements()) {
    // Only run the watcher immediately if the browser is completely loaded
    let browserWindow = browserWindows.getNext();
    if (browserWindow.document.readyState == "complete")
      watcher(browserWindow);
    // Wait for the window to load before continuing
    else
      runOnLoad(browserWindow, watcher);
  }
}

/**
 * Apply a callback to each open and new browser windows.
 *
 * @usage watchWindows(callback): Apply a callback to each browser window.
 * @param [function] callback: 1-parameter function that gets a browser window.
 */
function watchWindows(callback) {
  // Wrap the callback in a function that ignores failures
  function watcher(window) {
    try {
      callback(window);
    }
    catch(ex) {}
  }

  // Add functionality to existing windows
  runOnWindows(callback);

  // Watch for new browser windows opening then wait for it to load
  function windowWatcher(subject, topic) {
    if (topic == "domwindowopened")
      runOnLoad(subject, watcher);
  }
  Services.ww.registerNotification(windowWatcher);

  // Make sure to stop watching for windows if we're unloading
  unload(function() Services.ww.unregisterNotification(windowWatcher));
}

/**
 * Save callbacks to run when unloading. Optionally scope the callback to a
 * container, e.g., window. Provide a way to run all the callbacks.
 *
 * @usage unload(): Run all callbacks and release them.
 *
 * @usage unload(callback): Add a callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 *
 * @usage unload(callback, container) Add a scoped callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @param [node] container: Remove the callback when this container unloads.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 */
function unload(callback, container) {
  // Initialize the array of unloaders on the first usage
  let unloaders = unload.unloaders;
  if (unloaders == null)
    unloaders = unload.unloaders = [];

  // Calling with no arguments runs all the unloader callbacks
  if (callback == null) {
    unloaders.slice().forEach(function(unloader) unloader());
    unloaders.length = 0;
    return;
  }

  // The callback is bound to the lifetime of the container if we have one
  if (container != null) {
    // Remove the unloader when the container unloads
    container.addEventListener("unload", removeUnloader, false);

    // Wrap the callback to additionally remove the unload listener
    let origCallback = callback;
    callback = function() {
      container.removeEventListener("unload", removeUnloader, false);
      origCallback();
    }
  }

  // Wrap the callback in a function that ignores failures
  function unloader() {
    try {
      callback();
    }
    catch(ex) {}
  }
  unloaders.push(unloader);

  // Provide a way to remove the unloader
  function removeUnloader() {
    let index = unloaders.indexOf(unloader);
    if (index != -1)
      unloaders.splice(index, 1);
  }
  return removeUnloader;
}

/**
 * Get a localized and/or formatted string
 *
 * @author Nils Maier
 * @usage _('string')
 * @usage _('formated', param1, ...)
 * @param [String] id
 * @param [String] ...
 * @return [String] localized string
 */
function _() {
  if (arguments.length == 0) {
    return null;
  }
  if (arguments.length == 1) {
    return _.strings.GetStringFromName(arguments[0]);
  }
  let args = Array.map(arguments, function(e) e);
  let id = args.shift();
  return _.strings.formatStringFromName(id, args, args.length);
};

/**
 * Loads the string bundle according to user locale
 * and chrome.manifest.
 *
 * @author Nils Maier
 * @param [string] resource: file name of the l10n resource to load
 * @param [Addon] addon: Addon data from AddonManager
 * @param [function] next: Next function to call
 */
_.init = function _init(resource, addon, next) {
  let manifest = new XMLHttpRequest();
  manifest.onload = function() {
    // get supported locales
    manifest = manifest.responseText
      .split(/\n/g)
      .filter(function(line) /^locale/.test(line))
      .map(function(line) line.split(/\s/g)[2]);

    // get selected locale
    let xr = Cc["@mozilla.org/chrome/chrome-registry;1"]
      .getService(Ci.nsIXULChromeRegistry);
    let locale = xr.getSelectedLocale("global");

    // exact match?
    let idx = manifest.indexOf(locale);

    if (idx < 0) {
      // best match?
      idx = manifest.map(function(l) l.split("-")[0]).indexOf(locale.split("-")[0]);
    }

    // load the string bundle
    let sb = addon.getResourceURI(
      "locale/"
      + manifest[Math.max(0, idx)]
      + '/' + resource).spec;
    _.strings = Services.strings.createBundle(sb);

    // call next
    next && next();
  };
  manifest.overrideMimeType('text/plain');
  manifest.open("GET", addon.getResourceURI("chrome.manifest").spec);
  manifest.send();
}
