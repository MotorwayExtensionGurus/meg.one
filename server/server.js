const { CONFIG, log } = require('./utils');
const cluster = require('cluster');
const express = require('express');
const app = express();

// Only allow paths ending in trailing slash (/) (except for direct file paths)
app.enable('strict routing');

// Allow cases in paths (used for uploads/static files with capitalization)
app.enable('case sensitive routing');

/*  Compress any eligible traffic;
	security enhancements;
	logging for Express functions;
	modern Favicon serving */
app.use(require('compression')());
app.use(require('helmet')({ frameguard: false }));
app.use(log.express(true));
app.use(require('serve-favicon')(CONFIG.icon));

// Static Express routes (for JavaScript, images, robots.txt, manifests, etc.)
app.use(express.static(CONFIG.static));
app.use('/fonts', express.static(CONFIG.fonts));
app.use('/images', express.static(CONFIG.images));
app.use('/files', express.static(CONFIG.uploads));
app.use('/spammer', express.static(CONFIG.spammer));

// Route handler
app.use(require('./router'));

// Pug.js renderer
app.set('views', CONFIG.views);
app.set('view engine', 'pug');

// Call proper task for multithreading
cluster.isMaster ? masterThread() : workerThread();

// Thread for master (only runs at launch, possibly after a crash or server reboot)
function masterThread() {
	// One thread per CPU
	const cpus = require('os').cpus().length;
	log.info(log.chalk.bold(`Forking ${cpus} worker threads`));

	// Create new threads for each CPU core
	for (let cpu = 0; cpu < cpus; cpu++) cluster.fork();

	cluster.on('online', (worker) => log.info('Worker online', worker.id));
	cluster.on('exit', (worker, code, signal) => log.warn('Worker exited', signal || code, `${worker.id}`).callback(cluster.fork));
}

// Thread for worker (spawned by master thread at launch or after another thread crashed)
function workerThread() {
	log.comment(`Worker ID: ${cluster.worker.id}`).express().Host(app, CONFIG.port, '0.0.0.0');
}
