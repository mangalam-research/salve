var path = require('path');

// Default values for our configuration parameters
var config = {
    rst2html: "rst2html",
    jsdoc3: "jsdoc",
    semver_sync: "semver-sync",
    mocha: "mocha"
};

// Try to load a local configuration file.
var local_config = {};
try {
    local_config = require('./local.jake');
}
catch (e) {
    if (e.code !== "MODULE_NOT_FOUND")
        throw e;
}

// And override the defaults with what the local file has.
for(var i in config)
    if (local_config[i])
        config[i] = local_config[i];

if (process.env['mocha_params'])
    config.mocha += ' ' + process.env['mocha_params'];

var src_globs = path.join('lib', '**');

var dest_dir = 'build';
var lib_dest_dir = path.join(dest_dir, 'lib');
var doc_dest_dir = path.join(dest_dir, 'doc');

//Tasks that will create build directories when needed
directory(dest_dir);
directory(lib_dest_dir, [dest_dir]);
directory(doc_dest_dir, [dest_dir]);

desc('Remove build directory and all files');
task('clean', [], function() {
    jake.rmRf(dest_dir);
    jake.rmRf('README.html');
});

desc('Create documentation for the project');
namespace('docs', function() {

    desc('Create documentation for JavaScript scripts');
    task('jsdoc', [doc_dest_dir], {async: true}, function(priv) {
        var cmd = config.jsdoc3;
        if (priv)
            cmd += ' -p';
        cmd += ' -d ' + doc_dest_dir + ' -r lib';
        console.log('Compiling documentation for JavaScript scripts\n');
        jake.exec(cmd, function() {
            console.log('Done');
            complete();
        });
    });

    desc('Create README.html from README.rst');
    file('README.html', [doc_dest_dir, 'README.rst'], {async: true}, function(){
        var cmd = config.rst2html + ' README.rst README.html';
        console.log('Compiling README.html from rst\n');
        jake.exec(cmd, function() {
            console.log('Done');
            complete();
        });
    });
});

var src_file_list = new jake.FileList();
src_file_list.include(path.join(src_globs, '*.js'));
src_file_list.include(path.join(src_globs, '*.xsl'));
src_file_list.exclude(/parse.js$/);

// Create the list of files that must be built from the source.
var dst_file_list = [];
src_file_list.forEach(function (x) {
    var dst = path.join("build", x);
    dst_file_list.push(dst);
    file(dst, [x], function () {
        jake.mkdirP(path.dirname(this.name));
        jake.cpR(this.prereqs[0], this.name);
    });
});

desc('Run tests for salve');
namespace('tests', function () {
    task('semver', function () {
        jake.exec(config.semver_sync + ' -v',
                  {printStdout: true, printStderr: true},
                  function () {
            complete();
        });
    });
    task('mocha', dst_file_list, function () {
        jake.exec(config.mocha, {printStdout: true, printStderr: true},
                 function () {
            complete();
        });
    });
});

desc('Run salve tests');
task('test', ['tests:semver', 'tests:mocha']);


task('default', dst_file_list);
task('doc', ['docs:README.html','docs:jsdoc']);
//  LocalWords:  html jsdoc README rst js xsl copysrc LocalWords
