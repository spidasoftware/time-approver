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
    resizable: false,
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
      }
    ];

    menu = Menu.buildFromTemplate(template);
    mainWindow.setMenu(menu);
  
});
