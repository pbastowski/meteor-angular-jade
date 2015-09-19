var minify = Npm.require('html-minifier').minify;
var jade = Npm.require('jade');
var jadeOpts = {pretty: true, compileDebug: false};

Plugin.registerSourceHandler('ng.jade', {
  isTemplate:   true,
  archMatching: 'web'
}, function (compileStep) {
  var contents = compileStep.read().toString('utf8');
  var cacheTemplate = !/^\/\/ templateCache off/i.test(contents);
  
  // Remove the cacheTemplate comment fro the output
  if (!cacheTemplate)
    contents = contents.replace(/^\/\/ templateCache off/i, '');

  jadeOpts.filename = compileStep.inputPath;
  contents = jade.compile(contents, jadeOpts)();

  var newPath = compileStep.inputPath;
  newPath = newPath.replace(/\\/g, "/");
  newPath = newPath.replace(".ng.jade", ".html");

  // Don't write to the Angular $templateCache if the user has
  // turned that feature off with "$templateCache off".
  if (cacheTemplate) {
    var results = 'angular.module(\'angular-meteor\').run([\'$templateCache\', function($templateCache) {' +
      '$templateCache.put(\'' + newPath + '\', \'' +
      minify(contents.replace(/'/g, "\\'"), {
        collapseWhitespace:   true,
        conservativeCollapse: true,
        removeComments:       true,
        minifyJS:             true,
        minifyCSS:            true,
        processScripts:       ['text/ng-template']
      }) + '\');' +
      '}]);';

    compileStep.addJavaScript({
      path:       newPath,
      data:       results.replace(/\n/g, '\\n'),
      sourcePath: compileStep.inputPath
    });
  }
  else {
    // Extract any head contents and add it to the "head" section, because that's how the API wants it.
    var hasHead = /<head[\s\S]*?>/i.test(contents);
    if (hasHead) {
      var head = (contents.match(/<head[\s\S]*?>([\s\S]*)<\/head>/i) || [])[1];
      console.log('\n\n', head, '\n\n');

      compileStep.addHtml({
        section: 'head',
        data:    head
      });
      
      // Remove the head section completely, in case there is another non-body section after it
      contents = contents.replace(/<head[\s\S]*?>([\s\S]*)<\/head>/i, '');
    }

    // If the body is enclosed in a "body" tag then extract just the contents of the body.
    if (/<body[\s\S]*?>/i.test(contents)) {
      var body = (contents.match(/<body[\s\S]*?>([\s\S]*)<\/body>/i) || [])[1];
      contents = contents.replace(/<body[\s\S]*?>([\s\S]*)<\/body>/i, body);
      console.log('\n\n', contents, '\n\n');
    }
    
    // Add the remaining contents to the body section, thus ensuring any non-body 
    // sections remain intact.
    if (contents)
      compileStep.addHtml({
        section: 'body',
        data:    contents
      });
  }


});
