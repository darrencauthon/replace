var fs = require("fs"),
    path = require("path"),
    colors = require("colors");

module.exports = function(opts) {
    var regex = new RegExp(options.regex, flags),
        canReplace,
        replaceFunc,
        lineCount = 0,
        limit = 400, // chars per line
        flags = "g", // global multiline
        options;

    options = opts;
    if (!options.color) options.color = "cyan";
    if (options.ignoreCase) flags += "i";
    if (options.multiline) flags += "m";

    canReplace = !options.preview && options.replacement !== undefined;

    var includes = getTheIncludes(options);

    var excludes = getTheExcludes(options);

    var listFile = options.excludeList || path.join(__dirname, '/defaultignore');
    var list = fs.readFileSync(listFile, "utf-8").split("\n");

    if (options.funcFile)
       eval('replaceFunc = ' + fs.readFileSync(options.funcFile, "utf-8"));

    for (var i = 0; i < options.path.length; i++) {
        if(options.async)
            replacizeFile(options.path[i], canReplace);
        else
            replacizeFileSync(options.path[i], includes);
    }

    function getTheIncludes(options){
      var includes;
      if (options.include)
          includes = options.include.split(",").map(patternToRegex);
      return includes;
    }

    function getTheExcludes(options){
      excludes = [];
      if (options.exclude)
          excludes = options.exclude.split(",");
      excludes.concat(list)
        .filter(function(line) {
            return line && line.indexOf("#");
        })
        .map(patternToRegex);
      return excludes;
    }

    function patternToRegex(pattern) {
        return new RegExp("^" + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').trim() + "$");
    }

    function includeFile(file, includes) {
        if (includes) {
            for (var i = 0; i < includes.length; i++) {
                if (file.match(includes[i]))
                    return true;
            }
            return false;
        }
        else {
            for (var i = 0; i < excludes.length; i++) {
                if (file.match(excludes[i]))
                    return false;
            }
            return true;
        }
    }

    function replacizeFile(file, canReplace) {
      fs.lstat(file, function(err, stats) {
          if (err) throw err;

          if (stats.isSymbolicLink()) {
              // don't follow symbolic links for now
              return;
          }
          if (stats.isFile()) {
              if (!includeFile(file)) {
                  return;
              }
              fs.readFile(file, "utf-8", function(err, text) {
                  if (err) {
                      if (err.code == 'EMFILE') {
                          console.log('Too many files, try running `replace` without --async');
                          process.exit(1);
                      }
                      throw err;
                  }

                  text = replacizeText(text, file);
                  if(canReplace) {
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

    function replacizeFileSync(file, includes) {
      var stats = fs.lstatSync(file);
      if (stats.isSymbolicLink()) {
          // don't follow symbolic links for now
          return;
      }
      if (stats.isFile()) {
          if (!includeFile(file, includes)) {
              return;
          }
          var text = fs.readFileSync(file, "utf-8");

          text = replacizeText(text, file);
          if (canReplace) {
              fs.writeFileSync(file, text);
          }
      }
      else if (stats.isDirectory() && options.recursive) {
          var files = fs.readdirSync(file);
          for (var i = 0; i < files.length; i++)
              replacizeFileSync(path.join(file, files[i]), includes);
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

