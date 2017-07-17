PM2-Tasker
==========
Backend task queueing, allocation and oversight module that uses PM2.


```javascript
var tasker = require('pm2-tasker');

tasker.setup(); // Initial launch + restoring of tasks if this process stopped

tasker.create({ // Create a new task and return its event-emitter
	id: 'myTask', // Optional ID
	foo: 'Foo', // Optional parameters to pass to the task
})
	.on('finish', task => console.log('Task completed: ', task.id))
```
