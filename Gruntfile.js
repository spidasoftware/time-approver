module.exports = function(grunt) {

  grunt.initConfig({
    clean: ["build", "tmp", "dist"],
    'build-electron-app': {
      options: {
        platforms: ["darwin", "win32"],
        app_dir: "tmp"
      }
    },
    'copy': {
      'app': {
        files: [{
          expand: true,
          src: ['lib/**'],
          dest: "tmp"
        }, {
          expand: true,
          src: ['package.json'],
          dest: "tmp"
        }]
      }
    },
    'exec': {
      'install': {
        cmd: 'cd tmp; npm install --production; cd ..'
      },
      'copyIcon':{
        cmd: 'cp "lib/img/watch.icns" "build/darwin/Electron.app/Contents/Resources/atom.icns"'
      },
      'renameApp':{
        cmd: 'mv "build/darwin/Electron.app" "build/darwin/Time Approver.app"'
      },
      'renameExe':{
        cmd: 'mv "build/win32/electron.exe" "build/win32/time-approver.exe"'
      },
      'zipWin' : {
        cmd: 'cd build/win32;zip -r windows-time-approver.zip .;mkdir ../../dist;mv windows-time-approver.zip ../../dist/windows-time-approver.zip'
      },
      'zipOsx' : {
        cmd: 'cd build/darwin;tar -zcvf osx-time-approver.tar.gz .;mv osx-time-approver.tar.gz ../../dist/osx-time-approver.tar.gz'
      }
    },
  });

  grunt.loadNpmTasks('grunt-electron-app-builder');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-exec');

  grunt.registerTask('rename', ['exec:copyIcon', 'exec:renameApp', 'exec:renameExe']);
  grunt.registerTask('zip', ['exec:zipWin', 'exec:zipOsx']);
  grunt.registerTask('default', ['clean', 'copy', 'exec:install', 'build-electron-app', 'rename', 'zip']);
};
