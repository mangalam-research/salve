var path = require('path');

var rst2html = 'rst2html';
var jsdoc3 = 'jsdoc';

var src_globs = path.join('lib', '**');
var dest_globs = path.join('build', src_globs);

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
task('doc', ['README.html', 'jsdoc']);

//Perhaps add a namespace so that doc tasks are grouped together

desc('Create documentation for JavaScript scripts');
task('jsdoc', [doc_dest_dir], {async: true}, function(){
    cmd = jsdoc3 + ' -d ' + doc_dest_dir + ' -r lib';
    console.log('Compiling documentation for JavaScript scripts\n');
    jake.exec(cmd, function() {
        console.log('Done');
        complete();
    });
});

desc('Create README.html from README.rst');
file('README.html', [doc_dest_dir, 'README.rst'], {async: true}, function(){
    cmd = rst2html + ' README.rst README.html';
    console.log('Compiling README.html from rst\n');
    jake.exec(cmd, function() {
        console.log('Done');
        complete();
    });
});



var src_file_list = new jake.FileList();
src_file_list.include(path.join(src_globs, '*.js'));
src_file_list.include(path.join(src_globs, '*.xsl'));
src_file_list.exclude(/parse.js/);

// var dest_file_list = new jake.FileList();
// src_file_list.toArray().forEach(function (element, index, array) {
//     dest_file_list.include(path.join(dest_dir, element));
//  });

// Not totally convinced that I can't make jake check
// to see if files have been modified
// Have to use "file", which would require getting all of the
// files to be built in one file task
desc('Copy JavaScript source to build directory');
task('copysrc', lib_dest_dir, {async: true}, function() {
    console.log('Copying to build directory\n');
    src_file_list.toArray().forEach(function (element, index, array) {
        var out_path = path.join(dest_dir, path.dirname(element));
        jake.mkdirP(out_path);
        jake.cpR(element, out_path);
    });
    console.log('\nDone');
    complete();
});

task('default', ['copysrc'], function() {});

//  LocalWords:  html jsdoc README rst js xsl copysrc LocalWords
