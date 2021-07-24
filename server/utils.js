const path = require('path');
const fs = require('fs-extra');
const YAML = require('yaml');
const TLog = require('@tycrek/log');
const log = new TLog({ level: 'debug' })
	.enable.express({ handle404: false, handle500: false }).debug('Plugin enabled', 'Express')
	.enable.process().debug('Plugin enabled', 'Process')
	.debug('Logger ready');

module.exports = {
	log,
	CONFIG: {
		port: 8236,
		icon: joinPath('../client/static/favicon.ico'),
		static: joinPath('../client/static'),
		uploads: joinPath('../client/uploads'),
		images: joinPath('../client/images'),
		fonts: joinPath('../client/static/fonts'),
		views: joinPath('../client/views/pages'),
		spammer: joinPath('../spammer')
	},
	sass: {
		file: joinPath('../client/sass/main.scss'),
		outputStyle: 'compressed'
	},
	http: {
		_404: '<title>404 - Page not found</title><center><br><br><h1>404 - Page not found</h1></center>',
		_500: '<title>500 - Internal server error</title><center><br><br><h1>500 - Internal server error</h1></center>'
	},
	path: joinPath,
	getData: getData
};

function joinPath(file) {
	return path.join(__dirname, file);
}

function getData(page) {
	return new Promise((resolve, reject) => {
		const filepath = joinPath(page ? `../data/${page}.json` : '../data/main.json');
		fs.pathExists(filepath)
			.then((exists) => exists ? fs.readJson(filepath) : yaml(page))
			.then(resolve)
			.catch(reject);
	});

	function yaml(page) {
		return new Promise((resolve, reject) => {
			const filepath = joinPath(page ? `../data/${page}.yaml` : '../data/main.yaml');
			fs.pathExists(filepath)
				.then((exists) => exists ? fs.readFile(filepath) : resolve({}))
				.then((yaml) => YAML.parse(yaml.toString()))
				.then(resolve)
				.catch(reject);
		});
	}
}
