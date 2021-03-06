var fs = require("fs"),
    path = require("path"),
    colors = require("colors"),
    minimatch = require("minimatch");

module.exports = function(options) {
    var lineCount = 0,
        limit = 400; // chars per line

    if (!options.color) {
        options.color = "cyan";
    }

    var flags = "g"; // global multiline
    if (options.ignoreCase) {
        flags += "i";
    }
    if (options.multiline) {
        flags += "m";
    }

    var regex;
    if (options.regex instanceof RegExp) {
        regex = options.regex;
    }
    else {
        regex = new RegExp(options.regex, flags);
    }
    var canReplace = !options.preview && options.replacement !== undefined;

    var includes;
    if (options.include) {
        includes = options.include.split(",").map(patternToRegex);
    }
    var excludes = [];
    if (options.exclude) {
        excludes = options.exclude.split(",");
    }
    var ignoreFile = options.excludeList || path.join(__dirname, '/defaultignore');
    var ignores = fs.readFileSync(ignoreFile, "utf-8").split("\n");
    excludes = excludes.concat(ignores);

    var replaceFunc;
    if (options.funcFile) {
        eval('replaceFunc = ' + fs.readFileSync(options.funcFile, "utf-8"));
    }

    for (var i = 0; i < options.paths.length; i++) {
        if (options.async) {
            replacizeFile(options.paths[i]);
        }
        else {
            replacizeFileSync(options.paths[i]);
        }
    }

    function canSearch(file) {
      var inIncludes = includes && includes.some(function(include) {
          return minimatch(file, include, { matchBase: true });
      })
      var inExcludes = excludes && excludes.some(function(exclude) {
          return minimatch(file, exclude, { matchBase: true });
      })

      return ((!includes || inIncludes) && (!excludes || !inExcludes));
    }

    function replacizeFile(file) {
      fs.lstat(file, function(err, stats) {
          if (err) throw err;

          if (stats.isSymbolicLink()) {
              // don't follow symbolic links for now
              return;
          }
          if (!canSearch(file)) {
              return;
          }
          if (stats.isFile()) {
              fs.readFile(file, "utf-8", function(err, text) {
                  if (err) {
                      if (err.code == 'EMFILE') {
                          console.log('Too many files, try running `replace` without --async');
                          process.exit(1);
                      }
                      throw err;
                  }

                  text = replacizeText(text, file);
                  if (canReplace) {
                      fs.writeFile(file, text, function(err) {
                          if (err) throw err;
                      });
                  }
              });
          }
          else if (stats.isDirectory() && options.recursive) {
              fs.readdir(file, function(err, files) {
                  if (err) throw err;
                  for (var i = 0; i < files.length; i++) {
                      replacizeFile(path.join(file, files[i]));
                  }
              });
          }
       });
    }

    function replacizeFileSync(file) {
      var stats = fs.lstatSync(file);
      if (stats.isSymbolicLink()) {
          // don't follow symbolic links for now
          return;
      }
      if (!canSearch(file)) {
          return;
      }
      if (stats.isFile()) {
          var text = fs.readFileSync(file, "utf-8");

          text = replacizeText(text, file);
          if (canReplace) {
              fs.writeFileSync(file, text);
          }
      }
      else if (stats.isDirectory() && options.recursive) {
          var files = fs.readdirSync(file);
          for (var i = 0; i < files.length; i++) {
              replacizeFileSync(path.join(file, files[i]));
          }
      }
    }

    function replacizeText(text, file) {
        var match = text.match(regex);
        if (!match) {
            return text;
        }

        if (!options.silent) {
            var printout = "  " + file;
            if (options.count) {
                printout += (" (" + match.length + ")").grey;
            }
            console.log(printout);
        }
        if (!options.silent && !options.quiet
           && !(lineCount > options.maxLines)
           && options.multiline) {
            var lines = text.split("\n");
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (line.match(regex)) {
                    if (++lineCount > options.maxLines) {
                        break;
                    }
                    var replacement = options.replacement || "$&";
                    line = line.replace(regex, replaceFunc || replacement[options.color]);
                    console.log("     " + (i + 1) + ": " + line.slice(0, limit));
                }
            }
        }
        if (canReplace) {
            return text.replace(regex, replaceFunc || options.replacement);
        }
    }
}
