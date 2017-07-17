var expect = require('chai').expect;
var tasker = require('..');

describe('Run basic task', function() {
	var newTask = {
		id: 'testTask',
		foo: 'foo!',
		bar: [1, 2, 3],
	};

	before('tasker.setup()', ()=> tasker.setup());

	it('should setup a simple task', function(done) {
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

});
