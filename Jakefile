var rst2html = 'rst2html';
var jsdoc3 = 'jsdoc';

desc('Create relevant directories');
directory('build');
directory('build/lib', ['build']);
directory('build/doc', ['build']);

task('clean', [], function() {
    jake.rmRf('build');
    jake.rmRf('README.html');
    });

desc('Create documentation for the project');
task('doc', ['README.html', 'jsdoc']);

desc('Create documentation for JavaScript scripts');
task('jsdoc', ['build/doc'], {async: true}, function(){
    cmd = jsdoc3 + ' -d build/doc/ -r lib';
    console.log('Compiling documentation for JavaScript scripts');
    jake.exec(cmd, function() {
        console.log('Done');
        complete();
    });
});

desc('Create README.html from README.rst');
file('README.html', ['README.rst'], {async: true}, function(){
    cmd = rst2html + ' README.rst README.html';
    console.log('Compiling README.html from rst');
    jake.exec(cmd, function() {
        console.log('Done');
        complete();
    });
});

task('default', ['doc'], function() {});

//  LocalWords:  html jsdoc README rst
