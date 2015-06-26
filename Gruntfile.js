"use strict";
module.exports = function(grunt) {
    var fs = require("fs");
    // Load all grunt-* modules in package.json
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

    // Set the files that will overwrite or supplement files in the
    // jsdoc template.
    var jsdoc_custom_template_files =
            grunt.file.expand({filter: "isFile", cwd: "misc/jsdoc_template"},
                              ["**/*"]);

    // Set up a list of strings for excluding files when grunt-copy
    // copies jsdoc template defaults (for correct grunt-newer
    // operation)
    var jsdoc_template_exclude_files = jsdoc_custom_template_files.map(
        function (element) {
        return "!" + element;
    });

    // Check that the local version of JSDoc is the same or better
    // than the version deemed required for proper output.
    // This is a callback used by the grunt-shell task.
    var version_re = /(\d+)(?:\.(\d+)(?:\.(\d+))?)?/;
    var required_re = new RegExp("^" + version_re.source + "$");
    function checkJSDocVersion(err, stdout, stderr, callback) {
        if (err)
            grunt.fail.warn(err);

        var req_version_match =
                config.jsdoc_required_version.match(required_re);
        if (!req_version_match)
            grunt.fail.warn('Incorrect version specification: "' +
                            config.required_jsdoc_version + '".');

        var version_match_list = version_re.exec(stdout);
        if (!version_match_list)
            grunt.fail.warn("Could not determine local JSDoc version.");

        for (i = 1; i < req_version_match.length; ++i) {
            var req = Number(req_version_match[i]);
            var actual = Number(version_match_list[i]);
            if (req > actual)
                grunt.fail.warn("Local JSDoc version is too old: " +
                                version_match_list[0] + " < " +
                                req_version_match[0] + ".");
            else if (actual > req)
                break;
        }
        callback();
    }

    var meta_jsdoc = {
            src: ["lib/**/*.js", "doc/api_intro.md", "package.json"],
            template_src: ["build/jsdoc_template/**"],
            dest: "build/api"
    };

    grunt.initConfig({
        copy: {
            build: {
                files: [
                    { expand: true,
                      src: ["package.json",
                            "bin/*",
                            "lib/**/*.js",
                            "lib/**/*.xsl"],
                      dest: "build/dist/"
                    },
                    { src: "NPM_README.md",
                      dest:"build/dist/README.md"}
                ]
            },
            jsdoc_default_template_files: {
                files: [
                    { cwd: config.jsdoc_template_dir,
                      src: ["**/*"].concat(jsdoc_template_exclude_files),
                      dest: "build/jsdoc_template/",
                      expand: true
                    }
                ]
            },
            jsdoc_custom_template_files: {
                files: [
                    {   cwd: "misc/jsdoc_template/",
                        src: jsdoc_custom_template_files,
                        dest: "build/jsdoc_template/",
                        filter: "isFile",
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
        mkdir: {
            build: {
                options: {
                    create: ['build/tmp']
                }
            },
            install_test: {
                options: {
                    create: ["build/install_test"]
                }
            }
        },
        // When grunt 0.4.3 is released, verify that it can preserve
        // permissions when copying and get rid of this.
        chmod: {
            src: "build/dist/bin/*",
            options: {
                mode: "755"
            }
        },
        clean: {
            build: ["build/"],
            readme: ["README.html"],
            install_test: ["build/install_test/"]
        },
        // This is a task created purely for the sake of running jsdoc
        // if either of the following is true: the files composing the
        // source of the documentation changed, or the template
        // changed.
        meta_jsdoc_task: {
            build: {
                src: meta_jsdoc.src.concat(meta_jsdoc.template_src)
            }
        },
        jsdoc: {
            build: {
                jsdoc: config.jsdoc,
                src: meta_jsdoc.src,
                dest: meta_jsdoc.dest,
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
            },
            regexp: {
                src: "lib/salve/datatypes/regexp.jison",
                dest: "build/tmp/regexp.js",
                options: {
                    stdout: true,
                    stderr: true,
                    failOnError: true
                },
                command:
                "node_modules/.bin/jison " +
                    "-m amd -o build/tmp/regexp.js " +
                    "lib/salve/datatypes/regexp.jison"
            },
            pack: {
                options: {
                    stdout: false,
                    stderr: true,
                    failOnError: true,
                    execOptions: {
                        cwd: "build"
                    },
                    callback: function (err, stdout, stderr, cb) {
                        if (err)
                            grunt.fail.warn(err);

                        grunt.config.set("pack_name", stdout.trim());
                        cb();
                    }
                },
                command: "npm pack dist"
            },
            install_test: {
                options: {
                    stderr: true,
                    failOnError: true,
                    execOptions: {
                        cwd: "build/install_test"
                    }
                },
                command: "npm install ../<%= pack_name %>"
            },
            publish: {
                options: {
                    stderr: true,
                    failOnError: true,
                    execOptions: {
                        cwd: "build"
                    }
                },
                command: "npm publish <%= pack_name %>"
            }
        },
        mochaTest: {
            options:  {
                reporter: 'dot',
                grep: new RegExp(config.mocha_grep)
            },
            src: ["test/*.js"]
        },
        fix_jison: {
            regexp: {
                src: "build/tmp/regexp.js",
                dest: "build/dist/lib/salve/datatypes/regexp.js"
            }
        }
    });
    grunt.registerTask("jsdoc_template_exists", function() {
        if (!config.jsdoc_template_dir ||
            !grunt.file.exists(config.jsdoc_template_dir, "publish.js")) {
            grunt.fail.warn("JSDoc default template directory " +
                                     "invalid or not provided.");
        }
    });
    grunt.registerTask("default", ["newer:copy:build", "mkdir:build",
                                   "newer:shell:regexp",
                                   "newer:fix_jison:regexp",
                                   "npmignore",
                                   "chmod"]);

    grunt.registerTask("install_test", ["default",
                                        "shell:pack",
                                        "clean:install_test",
                                        "mkdir:install_test",
                                        "shell:install_test",
                                        "clean:install_test"]);

    grunt.registerTask("publish", ["install_test", "shell:publish"]);

    grunt.registerMultiTask("fix_jison", function () {
        if (this.files.length !== 1 || this.files[0].src.length !== 1) {
            grunt.log.error("needs exactly one source file.");
            return false;
        }

        var src = this.files[0].src[0];
        var dest = this.files[0].dest;
        var data = fs.readFileSync(src).toString();

        // This is enough to trigger RequireJS's CommonJS sugar handling.
        data = data.replace(/^\s*define\(\[\], function\s*\(\s*\)\s*\{/m,
                            "define(function (require) {");
        fs.writeFileSync(dest, data);
        return undefined;
    });

    grunt.registerTask("npmignore", function () {
        var data = "bin/parse.js";
        fs.writeFileSync("build/dist/.npmignore", data);
    });


    grunt.registerTask("copy_jsdoc_template",
                       ["jsdoc_template_exists",
                        "newer:copy:jsdoc_default_template_files",
                        "newer:copy:jsdoc_custom_template_files"
                       ]);
    grunt.registerTask("create_jsdocs", ["shell:test_jsdoc",
                                         "copy_jsdoc_template",
                                         "newer:meta_jsdoc_task:build"]);

    grunt.registerMultiTask("meta_jsdoc_task", function () {
        grunt.task.run("jsdoc:build");
    });

    grunt.registerTask("doc", ["create_jsdocs",
                               "newer:shell:readme"]);
    grunt.registerTask("gh-pages-build", ["create_jsdocs",
                                          "newer:copy:gh_pages_build"]);
    grunt.registerTask("test", ["default", "shell:semver", "mochaTest"]);
    //  grunt-contrib-clean is its own task: "grunt clean"
};
