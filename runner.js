#!/usr/bin/node

/**
* Main process runner - all sub-tasks should be enclosed within this shell
*/

var async = require('async-chainable');
var tasker = require('.');

var settings = process.argv.pop();
var taskId = process.argv.pop();

async()
	// Merge settings from upstream parent - will populate storage settings at least {{{
	.then(function(next) {
		tasker
			.set(settings)
			.set('cycle.autoInstall', false) // Disable the cycle processor as we're a stand alone task
			.setup()

		next();
	})
	// }}}
	// Retrieve the task we're going to be working on {{{
	.then('task', function(next) {
		tasker.get(taskId, next);
	})
	// }}}
	// Execute the task {{{
	.then(function(next) {
		console.log('RUN', taskId);
		next();
	})
	// }}}
	// Mark the task as completed and return the result {{{
	.then(function(next) {
		console.log('MARK', this.task.id, 'AS COMPLETE');
		this.task.status = 'complete';
		tasker.settings.storage.set(this.task, next);
	})
	// }}}
	// End {{{
	.end(function(err) {
		if (err) {
			console.log('Task error', err.toString());
			process.exit(1);
		} else {
			process.exit(0);
		}
	})
	// }}}
