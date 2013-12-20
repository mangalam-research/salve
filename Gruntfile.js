module.exports = function(grunt) {
    var fs = require("fs");
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
                    { src: ["package.json",
                            "bin/*",
                            "lib/**/*.js",
                            "lib/**/*.xsl",
                            "!lib/salve/parse.js"],
                      dest: "build/dist/" }
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
        mkdir: {
            build: {
                options: {
                    create: ['build/tmp']
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
            }
        },
        mochaTest: {
            options:  {
                grep: config.mocha_grep
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
    grunt.registerTask("default", ["newer:copy:build", "mkdir:build",
                                   "newer:shell:regexp",
                                   "newer:fix_jison:regexp",
                                   "chmod"]);

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
