var expect = require('chai').expect;
var tasker = require('..');

describe('Run basic task (timeout)', function() {
	var newTask = {
		id: 'test-timeout',
		file: __dirname + '/../examples/timeout.js',
		status: 'paused',
		delay: 3000,
		foo: 'foo!',
		bar: [1, 2, 3],
	};

	before('tasker.setup()', ()=> tasker
		.set('cycle.autoInstall', false)
		.setup()
	);

	it('should setup the task', function(done) {
		tasker.create(newTask)
			.on('created', function(task) {
				expect(task).to.equal('testTask');
				done();
			})
	});

	it('should have the task listed', function(done) {
		tasker.list(function(err, tasks) {
			expect(err).to.not.be.ok;
			expect(tasks).to.include('testTask');
			done();
		});
	});

	it('should be able to retrieve the task', function(done) {
		tasker.get('testTask', function(err, task) {
			expect(err).to.not.be.ok;
			expect(task).to.be.deep.equal(newTask);
			done();
		});
	});

	it('should set the task to waiting', function(done) {
		tasker.setStatus(newTask.id, 'wait', ()=> done())
	})

	it('should run one cycle and execute the task', function(done) {
		tasker
			.cycle()
			.on('run', function(taskID) {
				expect(taskID).to.equal(newTask.id);
			})
			.on('started', function(taskID) {
				expect(taskID).to.equal(newTask.id);
				done();
			})
	});

	it('should pause while the task runs', function(done) {
		this.timeout(5 * 1000);
		setTimeout(done, 4000);
	});

	it('should have marked the task as complete', function(done) {
		tasker.get(newTask.id, function(err, task) {
			expect(err).to.not.be.ok;
			expect(task).to.have.property('status', 'complete');
			done();
		});
	});

	it('should clean up expired tasks', function(done) {
		tasker
			.set('clean.expiry', '0')
			.cycle()
			.on('cleanPending', ()=> done('Didnt clean the task (status=cleanPending)'))
			.on('checkin', ()=> done('Didnt clean the task (checkin)'))
			.on('clean', function(taskID) {
				expect(taskID).to.equal(newTask.id);
				done();
			})
	});

});
