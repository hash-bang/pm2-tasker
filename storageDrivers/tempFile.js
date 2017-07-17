var _ = require('lodash');
var async = require('async-chainable');
var fs = require('fs');
var os = require('os');

module.exports = function(tasker) {
	var tasksPath = os.tmpdir() + '/pm2Tasker.json';

	function readTasks(cb) {
		async()
			.then('tempContents', function(next) {
				fs.readFile(tasksPath, 'utf-8', function(err, contents) {
					if (err && err.errno == -2) {
						cb(null, {}); // No tasks exist because the file doesn't exist
						next('ERRHANDLED');
					} else if (err) {
						next(err);
					} else {
						next(null, contents);
					}
				});
			})
			.then('json', function(next) {
				try {
					next(null, JSON.parse(this.tempContents));
				} catch (e) {
					next('Error reading JSON - ' + e.toString());
				}
			})
			.end(function(err) {
				if (err && err == 'ERRHANDLED') {
					// Pass
				} else if (err) {
					return cb(err);
				} else {
					cb(null, this.json);
				}
			})
	};

	function writeTasks(tasks, cb) {
		fs.writeFile(tasksPath, JSON.stringify(tasks), 'utf-8', function(err) {
			if (err) cb(err);
			cb();
		});
	};


	tasker
		.set('storage.list', function(cb) {
			readTasks(function(err, tasks) {
				if (err) return cb(err);
				cb(null, _.keys(tasks));
			});
		})
		.set('storage.get', function(task, cb) {
			var tasks = readTasks(function(err, tasks) {
				if (err) return cb(err);
				if (!tasks[task]) return cb('Not found');
				cb(null, tasks[task]);
			});
		})
		.set('storage.set', function(task, cb) {
			var tasks = readTasks(function(err, tasks) {
				if (err) return cb(err);
				tasks[task.id] = task;
				writeTasks(tasks, cb);
			});
		})
		.set('storage.create', function(task, cb) {
			var tasks = readTasks(function(err, tasks) {
				if (err) return cb(err);
				tasks[task.id] = task;
				writeTasks(tasks, cb);
			});
		})
};
