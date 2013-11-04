module.exports = function(grunt) {
    "use strict";

    // Load all grunt-* modules in package.json
    require("load-grunt-tasks")(grunt);

    // Read in local environment variables
    var path = require("path"),
        os = require("os"),
        fs = require("fs");

    var content = "",
        lines = null,
        eol = os.platform == "windows" ? "\r\n" : "\n";

    var mocha_grep = "",
        rst2html = "rst2html";

    //Read from a local file, "grunt.local"
    try {
    content = fs.readFileSync(path.join(process.cwd(), "grunt.local"), "utf8");
    } catch(e) {
    }

    if (content) {
        lines = content.split(eol);
        for (var i = 0, len = lines.length; i < len; i++) {
            try {
                eval(lines[i]);
            } catch(e) {
                console.log("\n" + e + "\nContinuing...\n");
            }
        }
    }
    // Override with any options from the process environment
    if (process.env["rst2html"]) {
        rst2html = process.env["rst2html"];
    }

    if (process.env["mocha_grep"]) {
        mocha_grep = process.env["mocha_grep"];
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
                src: "lib/**/*.js",
                options: { destination: "build/doc",
                           private: false }
                },
            private: {
                src: "lib/**/*.js",
                options: { destination: "build/doc"}
                }
        },
        shell: {
            readme: {
                options: {
                    stdout: true,
                    stderr: true,
                    failOnError: true
                    },
                command: rst2html + " README.rst README.html"
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
                grep: mocha_grep
            },
            src: ["test/*.js"]
        }
    });
    grunt.registerTask("default", ["newer:copy:build"]);
    grunt.registerTask("doc", ["newer:jsdoc:build","newer:shell:readme"]);
    grunt.registerTask("private_doc", ["newer:jsdoc:private",
                                       "newer:shell:readme"]);
    grunt.registerTask("test", ["shell:semver", "mochaTest"]);
//  grunt-contrib-clean is its own task: "grunt clean"

};
