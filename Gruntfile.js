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
        jsdoc3_template_dir: undefined,
        required_jsdoc_version: "3.2.2"
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

    // Check that the local version of JSDoc is the same or better
    // than the version deemed required for proper output.
    // This is a callback used by the grunt-shell task.
    function checkJSDocVersion(err, stdout, stderr, callback) {
        function isPositiveInteger(x) {
            // http://stackoverflow.com/a/1019526/11236
            return /^\d+$/.test(x);
        }

        function validateParts(parts) {
            for (var i = 0 ; i < parts.length; i++) {
                if (!isPositiveInteger(parts[i])) {
                    return false;
                }
            }
            return true;
        }

        if (err) {
            grunt.fail.warn(err);
        }

        var req_version_list = config.required_jsdoc_version.split(".");
        if (!validateParts(req_version_list)) {
            grunt.fail.warn("Incorrect version specification: " +
                                         config.required_jsdoc_version + ".");
        }

        var re = /\s(\d+\.\d[\d\.]*)\s/;
        var version_match_list = re.exec(stdout);
        if (!version_match_list) {
            grunt.fail.warn("Could not determine local JSDoc version.");
        }

        var local_version_list = version_match_list[1].split(".");
        for (i = 0; i < req_version_list.length; ++i) {
            if (req_version_list[i] === local_version_list[i]) {
                continue;
            }
            if (req_version_list[i] > local_version_list[i]) {
                grunt.fail.warn("Local JSDoc version is too old: " +
                                             version_match_list[1] + ".");
            }
        }
        callback();
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
            },
            gh_pages_build: {
                files: [
                    { cwd: "build/api/",
                      src: ["**/*"],
                      dest: "gh-pages-build",
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
                           config: "jsdoc.conf.json"
                         }
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
            },
            test_jsdoc: {
                command: config.jsdoc3 + " -v",
                options: {
                    failOnError: true,
                    callback: checkJSDocVersion

                }
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
    grunt.registerTask("jsdoc_template_exists", function() {
        if (!config.jsdoc3_template_dir ||
            !grunt.file.exists(config.jsdoc3_template_dir, "publish.js")) {
            grunt.fail.warn("JSDoc default template directory " +
                                     "invalid or not provided.");
        }
    });
    grunt.registerTask("copy_jsdoc_template",
                       ["jsdoc_template_exists",
                        "copy:jsdoc_template_defaults",
                        "copy:publish_js", "copy:layout_tmpl",
                        "copy:mangalam_css"]);
    grunt.registerTask("create_jsdocs", ["shell:test_jsdoc","copy_jsdoc_template",
                                        "newer:jsdoc:build"]);
    grunt.registerTask("doc", ["create_jsdocs",
                               "newer:shell:readme"]);
    grunt.registerTask("gh-pages-build", ["create_jsdocs",
                                          "newer:copy:gh_pages_build"]);
    grunt.registerTask("test", ["default", "shell:semver", "mochaTest"]);

//  grunt-contrib-clean is its own task: "grunt clean"

};
