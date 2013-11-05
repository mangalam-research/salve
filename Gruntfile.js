module.exports = function(grunt) {
    "use strict";

    // Load all grunt-* modules in package.json
    require("load-grunt-tasks")(grunt);

    // Read in local environment variables
    var config = {
        mocha_grep: "",
        rst2html: "rst2html",
        jsdoc3: "jsdoc",
        jsdoc_private: false
    };

    // Try to load a local configuration file.
    var local_config = {};
    try {
        local_config = require('./local.grunt');
    }
    catch (e) {
        if (e.code !== "MODULE_NOT_FOUND")
            throw e;
    }

    // Override the defaults with what the local file has and the
    // environment
    for(var i in config) {
        if (local_config[i] !== undefined)
            config[i] = local_config[i];
        var opt_name = i.replace("_", "-");
        var opt = grunt.option(opt_name);
        if (opt !== undefined)
            config[i] = opt;
    }

    grunt.initConfig({
        copy: {
            build: {
                files: [
                    { src: "lib/**/*.js", dest: "build/" },
                    { src: "lib/**/*.xsl", dest: "build/" }
                ]
            }
        },
        clean: {
            build: ["build/"],
            readme: ["README.html"]
        },
        jsdoc: {
            build: {
                jsdoc: config.jsdoc3,
                src: "lib/**/*.js",
                dest: "build/doc",
                options: { private: config.jsdoc_private}
            }
        },
        shell: {
            readme: {
                src: "README.rst",
                dest: "README.html",
                options: {
                    stdout: true,
                    stderr: true,
                    failOnError: true
                },
                command: config.rst2html + " README.rst README.html"
            },
            semver: {
                options: {
                    stdout: true,
                    stderr: true,
                    failOnError: true
                },
                command: "semver-sync -v"
            }
        },
        mochaTest: {
            options:  {
                grep: config.mocha_grep
            },
            src: ["test/*.js"]
        }
    });
    grunt.registerTask("default", ["newer:copy:build"]);
    grunt.registerTask("doc", ["any-newer:jsdoc:build",
                               "any-newer:shell:readme"]);
    grunt.registerTask("test", ["default", "shell:semver", "mochaTest"]);
//  grunt-contrib-clean is its own task: "grunt clean"
};
