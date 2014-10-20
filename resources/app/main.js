var app = require('app');
var Menu = require('menu');
var MenuItem = require('menu-item');
var BrowserWindow = require('browser-window');
var ipc = require('ipc');

var query = require('./query.js');

var mainWindow = null;
var menu = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  app.quit();
});

app.on('ready', function() {
  app.commandLine.appendSwitch('js-flags', '--harmony_collections');

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: true,
    'use-content-size': true,
  });
  mainWindow.loadUrl('file://' + __dirname + '/index.html');

  var printer = function(message){
    mainWindow.webContents.send('printer', message)
  }

  mainWindow.focus();


     var template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Review',
            click: function() { query(false, printer); }
          },          
          {
            label: 'Approve',
            click: function() { query(true, printer); }
          },
          {
            label: 'Close',
            click: function() { mainWindow.close(); }
          },
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Reload',
            accelerator: 'Ctrl+R',
            click: function() { mainWindow.restart(); }
          },
          {
            label: 'Enter Fullscreen',
            click: function() { mainWindow.setFullScreen(true); }
          },
          {
            label: 'Toggle DevTools',
            accelerator: 'Alt+Ctrl+I',
            click: function() { mainWindow.toggleDevTools(); }
          },
        ]
      }
    ];

    menu = Menu.buildFromTemplate(template);
    mainWindow.setMenu(menu);
  
});
