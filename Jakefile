var path = require('path');

var localconfig = require('local.jake');


var rst2htmlcmd = (localconfig.rst2htmlcmd) ? localconfig.rst2htmlcmd : 'rst2html';
var jsdoc3cmd = (localconfig.jsdoc3cmd) ? localconfig.jsdoc3cmd : 'jsdoc';
var semvercmd = (localconfig.semvercmd) ? localconfig.semvercmd :'semver-sync';
var mochacmd = (localconfig.mochacmd) ? localconfig.mochacmd : 'mocha';
if (process.env['mocha_params']) mochacmd += ' ' + process.env['mocha_params'];

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
    task('jsdoc', [doc_dest_dir], {async: true}, function(){
        var cmd = jsdoc3cmd + ' -d ' + doc_dest_dir + ' -r lib';
        console.log('Compiling documentation for JavaScript scripts\n');
        jake.exec(cmd, function() {
            console.log('Done');
            complete();
        });
    });

    desc('Create documentation for JavaScript scripts including private methods' +
         'and objects');
    task('jsdoc_priv', [doc_dest_dir], {async: true}, function(){
        var cmd = jsdoc3cmd + ' -p -d ' + doc_dest_dir + ' -r lib';
        console.log(cmd);
        console.log('Compiling private documentation for JavaScript scripts\n');
        jake.exec(cmd, function() {
            console.log('Done');
            complete();
        });
    });

    desc('Create README.html from README.rst');
    file('README.html', [doc_dest_dir, 'README.rst'], {async: true}, function(){
        var cmd = rst2htmlcmd + ' README.rst README.html';
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
src_file_list.exclude(/parse.js/);

var dst_file_list = [];
src_file_list.forEach(function (x) {
    var dst = path.join("build", x);
    dst_file_list.push(dst);
    file(dst, [x], function () {
        jake.mkdirP(path.dirname(this.name));
        jake.cpR(this.prereqs[0], this.name);
    });
});

// desc('Copy JavaScript source to build directory');
// task('copysrc', lib_dest_dir, {async: true}, function() {
//     console.log('Copying to build directory\n');
//     src_file_list.toArray().forEach(function (element, index, array) {
//         var out_path = path.join(dest_dir, path.dirname(element));
//         jake.mkdirP(out_path);
//         jake.cpR(element, out_path);
//     });
//     console.log('\nDone');
//     complete();
// });

desc('Run tests for salve');
namespace('tests', function () {
    task('semver', function () {
        jake.exec(semvercmd + ' -v', {printStdout: true, printStderr: true});
        complete();
    });
    task('mocha', function () {
        jake.exec(mochacmd, {printStdout: true, printStderr: true});
        complete();
    });
});

desc('Run salve tests');
task('test', dst_file_list.concat(['tests:semver', 'tests:mocha']));


task('default', dst_file_list);
task('doc', ['docs:README.html','docs:jsdoc']);
//  LocalWords:  html jsdoc README rst js xsl copysrc LocalWords
