var path = require('path');

var rst2html = 'rst2html';
var jsdoc3 = 'jsdoc';

desc('Create relevant directories');
directory('build');
directory('build/lib', ['build']);
directory('build/doc', ['build']);

var file_list = new jake.FileList();
file_list.include('lib/**/*.js');
file_list.include('lib/**/*.xsl');
file_list.exclude(/parse.js/);

task('clean', [], function() {
    jake.rmRf('build');
    jake.rmRf('README.html');
    });

desc('Create documentation for the project');
task('doc', ['README.html', 'jsdoc']);

desc('Create documentation for JavaScript scripts');
task('jsdoc', ['build/doc'], {async: true}, function(){
    cmd = jsdoc3 + ' -d build/doc/ -r lib';
    console.log('Compiling documentation for JavaScript scripts\n');
    jake.exec(cmd, function() {
        console.log('Done');
        complete();
    });
});

desc('Create README.html from README.rst');
file('README.html', ['README.rst'], {async: true}, function(){
    cmd = rst2html + ' README.rst README.html';
    console.log('Compiling README.html from rst\n');
    jake.exec(cmd, function() {
        console.log('Done');
        complete();
    });
});

desc('Copy javascript source to build directory');
task('buildlib', 'build/lib', {async: true}, function() {
    console.log('Copying to build directory\n');
    file_list.toArray().forEach(function (element, index, array) {
        var out_path = path.join('build', path.dirname(element));
        jake.mkdirP(out_path);
        jake.cpR(element, out_path);
    });
    console.log('\nDone');
    complete();
});
// task('buildlib', ['build/lib'], {async: true}, function() {
//     var filearr = jake.readdirR('lib');
//     function globFiles(element, index, array) {
//         extension = element.substr((~-element.lastIndexOf(".") >>> 0) + 2);
//         if (element != 'lib/salve/parse.js' &&
//             (extension =='js' || extension == 'xsl')) {
//             cmd =
//             console.log(element);
//             jake.exec( element);
//             }
//         }
//     filearr.forEach(globFiles);
//     complete();
//     });


task('default', ['buildlib'], function() {});

//  LocalWords:  html jsdoc README rst
