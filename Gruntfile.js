module.exports = function(grunt) {
    "use strict";
    // Load all grunt-* modules in package.json
    var touch = require("touch");
    require("load-grunt-tasks")(grunt);
    // Read in local environment variables
    var config = {
        jsdoc: "jsdoc",
        jsdoc_private: false,
        jsdoc_required_version: "3.2.2",
        jsdoc_template_dir: undefined,
        mocha_grep: "",
        rst2html: "rst2html"
    };

    // Set the files that will overwrite or supplement files in the
    // jsdoc template.
    config.jsdoc_custom_template_files =
        grunt.file.expand({filter: "isFile", cwd: "misc/jsdoc_template"}, ["**/*"]);

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

    // Set up a list of strings for excluding files when grunt-copy
    // copies jsdoc template defaults (for correct grunt-newer
    // operation)
    var jsdoc_template_exclude_files = [];
    config.jsdoc_custom_template_files.forEach(
        function (element, index, array) {
            jsdoc_template_exclude_files.push("!" + element);
        });
    // Check that the local version of JSDoc is the same or better
    // than the version deemed required for proper output.
    // This is a callback used by the grunt-shell task.
    function checkJSDocVersion(err, stdout, stderr, callback) {
        function isPositiveInteger(x) {
            // http://stackoverflow.com/a/1019526/11236
            return /^\d+$/.test(x);
        }

        function validateParts(parts) {
            for (var i = 1 ; i < parts.length; i++) {
                if (parts[i] === undefined) {
                    break;
                }
                if (!isPositiveInteger(parts[i])) {
                    return false;
                }
            }
            return true;
        }

        if (err) {
            grunt.fail.warn(err);
        }
        var required_re = /^(\d+)(?:\.(\d+)(?:\.(\d+))?)?$/;
        var req_version_match =
                config.jsdoc_required_version.match(required_re);
        if (!req_version_match ||(!validateParts(req_version_match))) {
            grunt.fail.warn('Incorrect version specification: "' +
                                         config.required_jsdoc_version + '".');
        }

        var version_re = /(\d+)(?:\.(\d+)(?:\.(\d+))?)?/;
        var version_match_list = version_re.exec(stdout);
        if (!version_match_list) {
            grunt.fail.warn("Could not determine local JSDoc version.");
        }

        for (i = 1; i < req_version_match.length; ++i) {
            if (req_version_match[i] === version_match_list[i]) {
                continue;
            }
            if (req_version_match[i] > version_match_list[i]) {
                grunt.fail.warn("Local JSDoc version is too old: " +
                                version_match_list[0] + " < " +
                                req_version_match[0] + ".");
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
            jsdoc_default_template_files: {
                files: [
                    { cwd: config.jsdoc_template_dir,
                      src: ["**/*"].concat(jsdoc_template_exclude_files),
                      dest: "build/jsdoc_template/",
                      expand: true
                    }
                ],
                options: {
                    processContent: function(file) {
                        touch("lib/salve/validate.js");
                        return file;
                    }
                }
            },
            jsdoc_custom_template_files: {
                files: [
                    {   cwd: "misc/jsdoc_template/",
                        src: config.jsdoc_custom_template_files,
                        dest: "build/jsdoc_template/",
                        filter: "isFile",
                        expand: true
                    }
                ],
                options: {
                    processContent: function(file) {
                        touch("lib/salve/validate.js");
                        return file;
                    }
                }
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
                jsdoc: config.jsdoc,
                src: ["lib/**/*.js", "doc/api_intro.md", "package.json"],
                dest: "build/api",
                options: {
//                    destination: "build/api",
                    private: config.jsdoc_private,
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
                command: config.jsdoc + " -v",
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
        if (!config.jsdoc_template_dir ||
            !grunt.file.exists(config.jsdoc_template_dir, "publish.js")) {
            grunt.fail.warn("JSDoc default template directory " +
                                     "invalid or not provided.");
        }
    });
    grunt.registerTask("copy_jsdoc_template",
                       ["jsdoc_template_exists",
                        "newer:copy:jsdoc_default_template_files",
                        "newer:copy:jsdoc_custom_template_files"
                       ]);
    grunt.registerTask("create_jsdocs", ["shell:test_jsdoc",
                                         "copy_jsdoc_template",
                                        "newer:jsdoc:build"]);
    grunt.registerTask("doc", ["create_jsdocs",
                               "newer:shell:readme"]);
    grunt.registerTask("gh-pages-build", ["create_jsdocs",
                                          "newer:copy:gh_pages_build"]);
    grunt.registerTask("test", ["default", "shell:semver", "mochaTest"]);

//  grunt-contrib-clean is its own task: "grunt clean"

};
