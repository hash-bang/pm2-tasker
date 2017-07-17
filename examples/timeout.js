/**
* Sample task which waits a default 5 seconds then finishes
* @param {Object} task The task details
* @param {number} [task.delay=5000] How long to wait until returning
* @param {function} finish The callback to fire when finished. Called as (err, details)
*/
module.exports = function(task, finish) {
	var delay = task.delay || 5000;

	setTimeout(function() {
		finish(null, {waited: delay});
	}, delay);
};
