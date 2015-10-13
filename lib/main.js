var app = require('app');
var Menu = require('menu');
var MenuItem = require('menu-item');
var BrowserWindow = require('browser-window');
var ipc = require('ipc');
var smalltalk = require('smalltalk');

var mainWindow = null;
var menu = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  app.quit();
});


app.on('ready', function() {
  app.commandLine.appendSwitch('js-flags', '--harmony_collections');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: true,
    'use-content-size': true,
  });
  mainWindow.loadUrl('file://' + __dirname + '/index.html');

  mainWindow.focus();

  var printer = function(message, level, type) {
    mainWindow.webContents.send('insertRow', message, level, type)
  }

  time = require('./time')(printer)

  var template = [{
    label: "About",
    submenu: [{
      label: "About",
      click: function() {
        mainWindow.webContents.send('about')
      }
    }]
  }, {
    label: 'File',
    submenu: [{
      label: 'Review',
      click: function() {
        time.reviewer(false);
      }
    }, {
      label: 'Approve',
      click: function() {
        time.reviewer(true);
      }
    }, {
      label: 'Close',
      click: function() {
        mainWindow.close();
      }
    }, ]
  }, {
    label: 'View',
    submenu: [{
      label: 'Reload',
      accelerator: 'Ctrl+R',
      click: function() {
        mainWindow.restart();
      }
    }, {
      label: 'Enter Fullscreen',
      click: function() {
        mainWindow.setFullScreen(true);
      }
    }, {
      label: 'Exit Fullscreen',
      click: function() {
        mainWindow.setFullScreen(false);
      }
    }, {
      label: 'Toggle DevTools',
      accelerator: 'Alt+Ctrl+I',
      click: function() {
        mainWindow.toggleDevTools();
      }
    }, ]
  }];

  ipc.on('disapprove', function(event, id, reason) {
    time.disapprover(event, id, reason)
  });

  menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});
