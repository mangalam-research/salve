var rst2html = 'rst2html';

desc('Create documentation for the project');
    file('README.html', ['README.rst'], function(){
        cmd = rst2html + ' README.rst README.html';
        jake.exec(cmd, function() {
            console.log('Compiling README.html from rst');
            complete();
        });
    });

task('default', ['README.html'], function() {});
