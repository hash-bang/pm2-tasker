/**
* Simple task which calculates all prime numbers in a given range
* @param {Object} task The task details
* @param {number} [task.min=1] The minimum boundry of the range
* @param {number} [task.max=1000] The maximum boundry of the range
* @param {function} finish The callback to fire when finished. Called as (err, primes)
*/

var async = require('async-chainable');

module.exports = function(task, finish) {

	var isPrime = no => {
		var i = 2;
		while (i <= Math.sqrt(no)) {
			if (no % i++ < 1) return false;
		}
		return no > 1
	};

	async()
		.set('primes', [])
		.forEach(task.min || 1, task.max || 1000, function(next, no) {
			if (isPrime(no)) this.primes.push(no);
			next();
		})
		.end(function(err) {
			if (err) return finish(err);
			finish(null, this.primes);
		});

};
