module.exports = function (grunt) {

    grunt.initConfig({
        clean: ["build", "tmp" ],
        'build-electron-app': {
            options: {
               platforms: ["darwin", "win32"],
                app_dir: "tmp"
            }
        },
        'copy': {
            main: {
                files: [
                    {expand: true, src: ['lib/**'], dest: "tmp"},
                    {expand: true, src: ['package.json'], dest: "tmp"}
                ]
            }
        },
        'exec':{
          install:{
            cmd:'pushd tmp; npm install --production; popd'
          }
        }
    });

    grunt.loadNpmTasks('grunt-electron-app-builder');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-exec');

    grunt.registerTask('default', ['clean', 'copy', 'exec', 'build-electron-app']);
};
