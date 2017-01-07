var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var gutil = require('gulp-util');
var pump = require('pump');

/** Config **/
var srcFiles =
[
	'src/MidiPiano.js', 
	'js/shim/Base64.js',
	'js/shim/Base64binary.js',
	'js/util/dom_request_xhr.js',
	'js/util/dom_request_script.js',
	'js/jasmid/stream.js',
	'js/jasmid/midifile.js',
	'js/jasmid/replayer.js',
	'js/midi/MIDI.js',
	'js/Tween.js'
];

gulp.task('compress', compress);

gulp.task('watch', function() 
{
	gulp.watch(srcFiles, gulp.series('compress'));
});

function compress(done) 
{
	pump([
  
		gulp.src(srcFiles),
		uglify(),
		concat('MidiPiano.min.js'),
		gulp.dest('dist')
		
    ], done);
}
