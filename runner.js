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
	.then('result', function(next) {
		console.log('[pm2-tasker] RUN TASK', "'" + this.task.id + "'", '(file = "' + this.task.file + '")');
		var taskFunc = require(this.task.file);
		if (typeof taskFunc != 'function') return next('Task file "' + this.task.file + '" did not export a function');
		taskFunc.call(this.task, this.task, next);
	})
	// }}}
	// Mark the task as completed and return the result {{{
	.then(function(next) {
		this.task.status = 'complete';
		if (this.result !== undefined) this.task.results = this.result; // Glue task.results if the task returned something
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
