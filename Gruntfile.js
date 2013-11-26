module.exports = function(grunt) {
    "use strict";
    // Load all grunt-* modules in package.json
    require("load-grunt-tasks")(grunt);
    // Read in local environment variables
    var config = {
        mocha_grep: "",
        rst2html: "rst2html",
        jsdoc3: "jsdoc",
        jsdoc_private: false,
        jsdoc3_template_dir: "./"
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
    // Override defaults with any variables from commandline environment,
    // then from a local.grunt.js configuration file
    for(var i in config) {
        var opt_name = i.replace("_", "-");
        var opt = grunt.option(opt_name);
        if (opt !== undefined) {
            console.log(i + " set from command line to " + opt);
            config[i] = opt;
        }
        else if (local_config[i] !== undefined) {
            console.log(i + " set from local.grunt to " + local_config[i]);
            config[i] = local_config[i];
        }
    }
    grunt.initConfig({
        copy: {
            build: {
                files: [
                    { src: ["lib/**/*.js", "!lib/salve/parse.js"],
                      dest: "build/" }
                ]
            },
            jsdoc_template_defaults: {
                files: [
                    { cwd: config.jsdoc3_template_dir,
                      src: ["**/*"],
                      dest: "build/jsdoc_template/",
                      expand: true
                    }
                ]
            },
            publish_js: {
                files: [
                    { cwd: "misc/jsdoc_template/",
                      src: "publish.js",
                      dest: "build/jsdoc_template/",
                      expand: true
                    }
                ]
            },
            layout_tmpl: {
                files: [
                    { cwd: "misc/jsdoc_template/",
                      src: "layout.tmpl",
                      dest: "build/jsdoc_template/tmpl/",
                      expand: true
                    }
                ]
            },
            mangalam_css: {
                files: [
                    { cwd: "misc/jsdoc_template/",
                      src: "mangalam.css",
                      dest: "build/jsdoc_template/static/styles/",
                      expand: true
                    }
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
                src: ["lib/**/*.js", "doc/api_intro.md", "package.json"],
                dest: "build/api",
                options: { private: config.jsdoc_private,
                         template: "build/jsdoc_template"}
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

    grunt.registerTask("copy_jsdoc_template",
                       ["copy:jsdoc_template_defaults",
                        "copy:publish_js", "copy:layout_tmpl",
                        "copy:mangalam_css"]);
    grunt.registerTask("create_jsdocs", ["copy_jsdoc_template",
                                        "newer:jsdoc:build"]);
    grunt.registerTask("doc", ["create_jsdocs",
                               "newer:shell:readme"]);
    grunt.registerTask("test", ["default", "shell:semver", "mochaTest"]);
//  grunt-contrib-clean is its own task: "grunt clean"
};
