module.exports = (grunt) ->
    require('load-grunt-tasks') grunt, pattern: ['grunt-contrib-*', 'grunt-karma']
    fs = require('fs')

    grunt.initConfig
        watch:
          concat:
            tasks: 'concat'
            files: ['src/*.js']
          less:
            tasks: 'less'
            files: ['src/less/*.less']

        concat:
          dist:
            options:
              process: (src, filepath) ->
                if filepath != 'src/head.js' && filepath != 'src/tail.js'
                  lines = []
                  src.split('\n').forEach (line) ->
                    lines.push( (if line.length > 0 then '    ' else '') + line)
                  src = lines.join('\n')
                return src
            src: [
              'src/head.js',
              'src/core.js',
              'src/config.js',
              'src/scale.js',
              'src/domain.js',
              'src/data.js',
              'src/json.js',
              'src/data.convert.js',
              'src/data.load.js',
              'src/category.js',
              'src/interaction.js',
              'src/size.js',
              'src/shape.js',
              'src/shape.line.js',
              'src/shape.bar.js',
              'src/text.js',
              'src/type.js',
              'src/grid.js',
              'src/tooltip.js',
              'src/legend.js',
              'src/title.js',
              'src/header.js',
              'src/footer.js',
              'src/axis.js',
              'src/clip.js',
              'src/arc.js',
              'src/region.js',
              'src/drag.js',
              'src/selection.js',
              'src/subchart.js',
              'src/zoom.js',
              'src/color.js',
              'src/format.js',
              'src/cache.js',
              'src/class.js',
              'src/util.js',
              'src/api.focus.js',
              'src/api.show.js',
              'src/api.zoom.js',
              'src/api.load.js',
              'src/api.flow.js',
              'src/api.selection.js',
              'src/api.transform.js',
              'src/api.group.js',
              'src/api.grid.js',
              'src/api.region.js',
              'src/api.data.js',
              'src/api.category.js',
              'src/api.color.js',
              'src/api.x.js',
              'src/api.axis.js',
              'src/api.legend.js',
              'src/api.chart.js',
              'src/api.tooltip.js',
              'src/api.json.js',
              'src/c3.axis.js',
              'src/ua.js',
              'src/polyfill.js',
              'src/tail.js'
            ]
            dest: 'c3.js'

        jshint:
          c3: 'c3.js'
          spec: 'spec/*.js'
          options:
            reporter: require('jshint-stylish')
            jshintrc: '.jshintrc'

        patch:
          examples:
            chunk: 'htdocs/js/init_chunk_4_examples.js'
            index: 'htdocs/index.html'
            src: ['htdocs/samples/*.html']

        jasmine:
          c3:
            src: 'c3.js'
            options:
              specs: 'spec/*-spec.js'
              helpers: 'spec/*-helper.js'
              styles: 'c3.css'
              vendor: 'htdocs/js/d3.latest.js'

        karma:
          unit:
            configFile: 'karma.conf.js'

        uglify:
          c3:
            files:
              'c3.min.js': 'c3.js'

        cssmin:
          c3:
            src: 'c3.css'
            dest: 'c3.min.css'

        sass:
          options:
            sourcemap: 'none'
          c3:
            files:
              'c3.css': 'src/scss/main.scss'

        less:
          options:
            sourcemap: 'none'
          c3:
            files:
              'c3.css': 'src/less/main.less'

        copy:
          web:
            files: [
              {expand: true, src: 'c3.js', dest: 'htdocs/js/', filter: 'isFile'},
              {expand: true, src: 'c3.css', dest: 'htdocs/css/', filter: 'isFile'},

              {expand: true, cwd: 'extensions/js/', src: ['**'], dest: 'htdocs/js/extensions/'},
              {expand: true, cwd: 'extensions/chart-bubble/', src: ['*.js'], dest: 'htdocs/js/extensions/'},
            ]


    grunt.registerMultiTask 'patch', () ->
      # load the chunk to inject/replace:
      chunk_file = this.data.chunk
      chunk_data = fs.readFileSync chunk_file

      # load the index file to check if every example has been linked up (this is a secondary task here)
      index_file = this.data.index
      index_data = fs.readFileSync index_file
      index_data = String(index_data)

      # iterate over all 'source' files and modify them buggers
      file_list = this.files[0].src
      file_list.forEach( (file) ->
        # grunt.log.writeln(JSON.stringify(file, null, 2));
        file_in_index = file.replace(/htdocs\//, '');
        pos = index_data.indexOf(file_in_index)
        if (pos < 0)
          grunt.log.writeln('WARNING: example ' + file_in_index + ' has not been included in the INDEX!')

        content = fs.readFileSync file
        content = String(content)
        content = content.replace(/<script id="profile_code_chunk">[\s\S]+?<\/script>/, '<script id="profile_code_chunk">\n' + chunk_data + '    </script>');
        fs.writeFileSync(file, content)
      )


    grunt.registerTask 'lint', ['jshint']
    grunt.registerTask 'test', ['karma']
    grunt.registerTask 'build', ['concat', 'less']
    grunt.registerTask 'minify', ['cssmin', 'uglify']
    grunt.registerTask 'default', ['concat', 'lint', 'update_web', 'test', 'minify']
    grunt.registerTask 'update_web', ['build', 'copy:web']
    grunt.registerTask 'quickbuild', ['update_web', 'minify']
