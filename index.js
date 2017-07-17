var _ = require('lodash');
var async = require('async-chainable');
var asyncExec = require('async-chainable-exec');
var duration = require('duration-js');
var events = require('events');
var pm2 = require('pm2');
var util = require('util');

function Tasker() {
	var tasker = this;
	/**
	* Default settings for tasker
	* Can be overridden during tasker.setup() or tasker.set()
	* @see tasker.setup()
	* @see tasker.set()
	* @var {Object}
	*/
	tasker.settings = {
		clean: {
			enabled: true,
			expiry: '10m',
		},
		cycle: {
			autoInstall: false,
			duration: '2m',
		},
		exec: {
			mode: 'inline', // ENUM: pm2, inline
			transferSettings: ['storage'], // Array (dotted notation) of settings to pass to children. This usually only needs to be 'storage'
			pm2Options: {
				autorestart: false,
			},
			wrapper: __dirname + '/runner.js',
		},
		naming: {
			prefix: 'task-',
			suffix: '',
			offset: 1,
			namer: function(task, cb) {
				var t = settings.naming.offset;
				var tasks = tasker.storage.list(function(err, list) {
					var tryName;
					do {
						tryName = settings.naming.prefix + t + settings.naming.suffix;
						console.log('TRY', tryName);
						t++;
					} while (list.includes(tryName));
					namer(null, tryName);
				});
			},
		},
		storage: {
			driver: 'tempFile',

			// All the below should be overridden by the relevent driver file
			list: (cb) => cb(null, []),
			get: (task, cb) => cb('Not found'),
			set: (task, cb) => cb('Cant write'),
			create: (task, cb) => cb('Cant create'),
		},
	};


	/**
	* Set tasker settings either by passing an object or the key/val (dotted notation is ok)
	* @param {Object|string} key Either the object to merge or the path of the setting to set
	* @param {*} value The value if key is a string
	* @returns {Object} This chainable object
	*/
	tasker.set = function(key, value) {
		if (_.isObject(key)) {
			_.merge(tasker.settings, options);
		} else if (_.isString(key)) {
			_.set(tasker.settings, key, value);
		} else {
			throw new Error('Unknown key type during tasker.set');
		}
		return tasker;
	};


	/**
	* Restore process status if the main thread failed
	* @returns {Object} This chainable object
	*/
	tasker.setup = function(options) {
		_.merge(tasker.settings, options);
		if (tasker.settings.storage.driver) tasker.use('storageDrivers/' +  tasker.settings.storage.driver);
		if (tasker.cycle.autoInstall) tasker.cycleStatus(true);

		return tasker;
	};


	/**
	* Return a list of all task IDs
	* @param {function} cb The callback to fire when ready
	* @returns {Object} This chainable object
	*/
	tasker.list = function(cb) {
		tasker.settings.storage.list(function(err, tasks) {
			if (err) return cb(err);
			cb(null, tasks);
		});

		return tasker;
	};


	/**
	* Return a task
	* This function uses lazy loading to return an event emitter immediately which gets populated when the storage system is ready
	* @param {string} task The task ID
	* @param {function} cb The callback to fire when the task has been retrieved
	* @returns {Object} This chainable object
	*/
	tasker.get = function(task, cb) {
		tasker.settings.storage.get(task, function(err, props) {
			if (err) return tasker.emit('error', err);
			cb(null, props);
		});

		return tasker;
	};


	/**
	* Create a new task
	* @param {Object} task The task settings (all are passed to the task process)
	* @param {string} [task.id] The task ID to run. If omitted an automatic one will be generated
	* @param {string} task.file The actual JS file to execute as the task. This file should contain a single function which takes ({task, cb})
	* @param {string} [task.status=wait] The initial status of the task. ENUM: wait, paused
	* @param {function} [cb] Callback function to be fired when the task has been created (but not necessarily run)
	* @returns {Object} This chainable object
	* @see tasker.get()
	*/
	tasker.create = function(task, cb) {
		if (!cb) cb = _.noop;
		if (!_.isObject(task)) throw new Error('Task must be an object');
		if (!task.status) task.status = 'wait';

		async()
			// Allocate an ID if it doesn't already have one {{{
			.then(function(next) {
				if (task.id) return next();

				tasker.settings.taskNamer(task, function(err, taskId) {
					if (err) return next(err);
					task.id = taskId;
					next();
				});
			})
			// }}}
			// Build + store the task {{{
			.then(function(next) {
				tasker.settings.storage.create(task, next);
			})
			// }}}
			// Emit the created event {{{
			.then(function(next) {
				tasker.emit('created', task.id);
				next();
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) return cb(err);
				cb();
			});
			// }}}

		return tasker;
	};


	/**
	* Set a tasks status
	* @param {Object|string} task Either the Task ID or the task object to set the status of, if its an ID it will be retrived automatically
	* @param {string} status The new status to set. ENUM: wait, paused
	* @param {function} cb Callback to fire as ({err}) when finished
	* @returns {Object} This chainable object
	*/
	tasker.setStatus = function(task, status, cb) {
		async()
			.then('task', function(next) {
				if (_.isObject(task)) return next(null, task); // Already an object
				tasker.get(task, next); // Go fetch the task
			})
			.then(function(next) {
				if (status == 'wait') {
					this.task.status = 'wait';
					tasker.settings.storage.set(this.task, next);
				} else if (status == 'paused') {
					// FIXME: Check if the task is running and error if it is
					return next();
				} else {
					next('Unknown task status: ' + status);
				}
			})
			.end(function(err) {
				if (!cb) return;
				if (err) return cb(err);
				cb();
			});

		return tasker;
	};


	/**
	* Invoke a 3rd party module within the tasker context
	* @param {String} module The module to be invoked
	* @returns {Object} This chainable object
	*/
	tasker.use = function(module) {
		if (_.isString(module)) { // Invoke as relative path to this module
			var mod = require(__dirname + '/' + module);
			mod.call(this, tasker);
		} else {
			throw new Error('Unknown parameter type passed to tasker.use()');
		}

		return tasker;
	};


	/**
	* Holder handle for the cycle timer
	* @var {Object}
	*/
	tasker.cycleTimerHandle;

	/**
	* Set the status of the cycle runner
	* @param {boolean} [running=true] If the tasker.cycle() function should run based on the duration in tasker.settings.cycle.duration
	* @returns {Object} This chainable object
	* @emits cycleStarted Emitted when the cycle is installed
	* @emits cycleStopped Emitted when the cycle is uninstalled
	*/
	tasker.cycleStatus = function(status) {
		if (status && !tasker.cycleTimerHandle) { // Starting
			var cycleRun = function() {
				tasker.cycle(function() {
					tasker.cycleTimerHandle = setTimeout(cycleRun, new duration(tasker.cycle.duration));
				});
			};
			cycleRun();
			tasker.emit('cycleStarted');
		} else if (!status && tasker.cycleTimerHandle) { // Stopping
			clearTimeout(tasker.cycleTimerHandle);
			tasker.emit('cycleStopped');
		}

		return tasker;
	};


	/**
	* Execute one execute / check cycle
	* @param {function} [cb] The callback to be emitted on finish
	* @emits clean Emitted as (taskID) when a task is cleaned up (having stopped in PM2) after the expiry amount
	* @emits cleanPending Emitted as (taskID) when a task has stopped but is not yet old enough for automatic cleaning
	* @emits checkin Emitted as (taskID) when a task is still running
	* @emits run Emitted as (taskID) when a task is executed
	* @emits started Emitted as (taskID) when PM2 actually starts the process
	* @returns {Object} This chainable object
	*/
	tasker.cycle = function(cb) {
		async()
			// Fetch all tasks we should be watching {{{
			.then('tasks', function(next) {
				tasker.settings.storage.list(next);
			})
			// }}}
			// Clean up PM2 tasks {{{
			.then(function(next) {
				if (tasker.settings.exec.mode != 'pm2') return next();
				if (!tasker.settings.clean.enabled) return next();

				async()
					.set('tasks', this.tasks)
					.set('expiry', new Date(new Date() + new duration(tasker.settings.clean.expiry)))
					.then('pm2', function(next) {
						pm2.connect(next);
					})
					.then('pm2Procs', function(next) {
						pm2.list(next);
					})
					.forEach('pm2Procs', function(next, pm2Proc) {
						if (!this.tasks.includes(pm2Proc.name)) return next(); // Not a task we are watching
						if (pm2Proc.pm2_env.status == 'stopped') {
							if (new Date(pm2Proc.pm2_env.created_at) > this.expiry) {
								tasker.emit('clean', pm2Proc.name);
								pm2.delete(pm2Proc.name, ()=> next());
							} else {
								tasker.emit('cleanPending', pm2Proc.name);
								next();
							}
						} else {
							tasker.emit('checkin', pm2Proc.name);
							next();
						}
					})
					.end(function(err) {
						if (err) {
							pm2.disconnect(function() {
								tasker.emit('error', 'PM2 cleanup err: ' + err.toString());
							});
						} else {
							pm2.disconnect(next);
						}
					});
			})
			// }}}
			// Error out if we have nothing to do {{{
			.then(function(next) {
				if (!this.tasks.length) return next('Nothing to do');
				next();
			})
			// }}}
			// Connect to PM2 if we need to {{{
			.then(function(next) {
				if (tasker.settings.exec.mode != 'pm2') return next();
				pm2.connect(next);
			})
			// }}}
			.forEach('tasks', function(nextTask, taskId) {
				async()
					// Fetch the task {{{
					.then('task', function(next) {
						tasker.settings.storage.get(taskId, next);
					})
					// }}}
					// Ignore all non-waiting tasks {{{
					.then(function(next) {
						if (this.task.status != 'wait') return next('NOT-WAITING');
						next();
					})
					// }}}
					// Emit the run signal {{{
					.then(function(next) {
						tasker.emit('run', taskId);
						next();
					})
					// }}}
					// Run the task {{{
					.then(function(next) {
						var transferSettings = _(tasker.settings.exec.transferSettings)
							.map(s => _.get(tasker.settings, s))
							.thru(o => JSON.stringify(o))
							.value();

						switch (tasker.settings.exec.mode) {
							case 'pm2':
								pm2.start(_.merge({
									name: this.task.id,
									script: tasker.settings.exec.wrapper,
									args: [this.task.id, transferSettings],
								}, tasker.settings.exec.pm2Options), (err, proc) => {
									tasker.emit('started', this.task.id);
									nextTask(); // Start next task immediately - let PM2 manage the PID in the background
								});
								break;
							case 'inline':
								async()
									.use(asyncExec)
									.set('task', this.task)
									.execDefaults({
										log: cmd => console.log('[Tasker]', 'RUN', cmd.cmd + ' ' + cmd.params.join(' ')),
										out: data => console.log('[Tasker]', '-->', data),
									})
									.exec([
										'node',
										tasker.settings.exec.wrapper,
										this.task.id,
										transferSettings,
									])
									.then(function(next) {
										tasker.emit('started', this.task.id);
										next();
									})
									.end(nextTask);
								break;
						}
					})
					// }}}
					// End - deal with PM2 errors {{{
					.end(function(err) {
						if (err && err == 'NOT-WAITING') { // Task wasn't waiting and should silently fail
							nextTask();
						} else if (err) {
							nextTask(err);
						} else {
							nextTask();
						}
					});
					// }}}
			})
			// End - Clean up and emit any errors {{{
			.end(function(err) {
				if (tasker.settings.exec.mode == 'pm2') pm2.disconnect();
				if (err) self.emit('err', err);

				if (_.isFunction(cb)) cb();
			});
			// }}}

		return tasker;
	};

	return tasker;
};

util.inherits(Tasker, events.EventEmitter);
module.exports = new Tasker();
