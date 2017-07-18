var expect = require('chai').expect;
var mlog = require('mocha-logger');
var tasker = require('..');

describe('Run basic task (primes)', function() {

	var resultTask;

	it('should calculate all primes 1 - 100', function(done) {
		this.timeout(5 * 1000);

		tasker
			.set('exec.mode', 'inline')
			.set('cycle.autoInstall', true) // Enable this here as some other tests disable it
			.setup()
			.create({
				id: 'test-primes',
				file: __dirname + '/../examples/primes.js',
				min: 1,
				max: 100,
			})
			.on('created', taskID => mlog.log('task created -', taskID))
			.on('started', taskID => mlog.log('task started -', taskID))
			.on('output', data => data.split('\n').forEach(l => mlog.log('>', l)))
			.on('finished', task => {
				if (task.id != 'test-primes') return;
				resultTask = task;
				done();
			})
	});

	it('should have returned the correct result', function() {
		expect(resultTask).to.have.property('results');
		expect(resultTask.results).to.deep.equal([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]);
	});

});
