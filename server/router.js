const { sass, http, log, path, getData } = require('./utils');
const fs = require('fs-extra');
const Sass = require('node-sass');
const minify = require('@node-minify/core');
const uglify = require('@node-minify/uglify-es');
const AdmZip = require('adm-zip');
const uuid = require('uuid').v4;
const router = require('express').Router();

var TEMP_DOWNLOADS = {};

module.exports = router;

router.use(require('express-fileupload')());

// Compile and compress Sass
router.get('/css', (_req, res, next) => {
	Sass.render(sass, (err, result) => {
		err ? next(err) : res.type('css').send(result.css);
	});
});

// Compress all JavaScript files using Uglify-ES
router.get('*.js', (req, res, next) => {
	fs.readFile(path(`../client/javascript${req.url}`))
		.then((bytes) => bytes.toString())
		.then((javascript) => minify({ compressor: uglify, content: javascript }))
		.then((minified) => res.type('js').send(minified))
		.catch((err) => next(err));
});

// All other routes
router.get('*', (req, res, next) => {
	let url = req.url, mainData, page;
	if (url !== '/' && !url.endsWith('/')) return res.redirect(301, `${url}/`);

	getData()
		.then((data) => mainData = data)
		.then(() => page = url === '/' ? 'index' : url.substring(1, url.length - 1))
		.then(() => fs.pathExists(path(`../client/views/pages/${page}.pug`)))
		.then((exists) => {
			if (!exists) throw Error(`Pug path for '${page}' does not exist`);
			else return getData(page);
		})
		.catch((_err) => fs.pathExists(path(`../client/views/pages/${page}/index.pug`)))
		.then((exists) => {
			if (typeof (exists) !== 'boolean') return exists;
			if (!exists) throw Error(`Pug path for '${page}' does not exist`);
			else {
				page += '/index';
				return getData(page);
			};
		})
		.then((pageData) => ({
			headTitle: headData(pageData, 'title'),
			headDescription: headData(pageData, 'description'),
			isProd: process.env.NODE_ENV === 'production',
			main: mainData,
			data: pageData
		}))
		.then((data) => res.render(page, data))
		.catch((_err) => next());

	function headData(data, meta) {
		return data && data[meta] ? data[meta] : mainData[`${meta}s`][page];
	}
});

/*
router.post('/upload', (req, res, _next) => {
	if (!req.files || Object.keys(req.files).length === 0) return res.status(400).send('No files were uploaded');

	let file = req.files.file;
	let savePath = path(`../client/uploads/${file.name}`);
	fs.pathExists(savePath)
		.then((exists) => { if (exists) throw Error('File with same name already exists.'); })
		.then(() => file.mv(savePath))
		.then(() => res.send(`Uploaded to: <a href="/files/${file.name}" download>https://meg.one/files/${file.name}</a>`))
		.catch((err) => res.type('html').send(err.message));
});
*/

router.get('/pack', (req, res, next) => {
	let assets = req.query.assets.split(',');

	let zip = new AdmZip();
	let did = uuid();
	let short = did.split('-')[0];
	let archivePath = path(`../downloads/MEG-${short}.zip`);

	fs.mkdir(path(`../downloads/${short}`))
		.then(() => fs.copy(path('../client/images/pack/pack.png'), path(`../downloads/${short}/pack.png`)))
		.then(() => getData('designer'))
		.then((assetData) => buildPack(assetData, assets, short))
		.then(() => fs.writeJson(path(`../downloads/${short}/pack.mcmeta`), { 'pack': { 'pack_format': 3, 'description': '\u00a7c\u00a7l\u00a7nMotorway\u00a7f \u00a76\u00a7l\u00a7nExtension\u00a7f \u00a7b\u00a7l\u00a7nGurus\u00a7r\n\u00a78\u27a1 https:\/\/\u00a77meg.one\u00a78\/' } }))
		.then(() => zip.addLocalFolder(path(`../downloads/${short}/`)))
		.then(() => zip.writeZip(archivePath))
		.then(() => TEMP_DOWNLOADS[did] = archivePath)
		.then(() => res.type('json').send({ success: true, message: did }))
		.then(() => fs.remove(path(`../downloads/${short}`)))
		.catch((err) => {
			log.error(err);
			res.type('json').send({ success: false, message: err })
		});
});

function buildPack(assetsData, assets, short) {
	const pack = {
		blocks: ['bedrock', 'netherrack', 'quartz_ore', 'obsidian'],
		items: ['totem', 'diamond_pickaxe']
	};

	let total = assets.length;
	let count = 0;

	return new Promise((resolve, reject) => {
		assets.forEach((asset) => {
			let assetId = asset.split('~~~')[0].replace(/\/|\\/g, '');
			let assetClass = asset.split('~~~')[1].replace(/\/|\\/g, '');
			let assetData = assetsData.pack.textures[assetClass][assetId];

			let assetCategory = pack.blocks.some(block => assetClass.includes(block)) ? 'blocks' : 'items';

			if (!assetData.files) {
				let assetFile = assetData.url.split('/')[1];

				let src = path(`../client/images/pack/assets/minecraft/textures/${assetCategory}/${assetFile}`).replace(/\/|\\/g, '/');
				let dest = path(`../downloads/${short}/assets/minecraft/textures/${assetCategory}/${assetClass}.png`).replace(/\/|\\/g, '/');

				fs.copy(src, dest)
					.then(() => count++)
					.then(() => count == total && resolve())
					.catch((err) => reject(err));
			} else {
				transferBulk(assetData.files, short)
					.then(() => resolve())
					.catch((err) => reject(err));
			}
		});
	});
}

function transferBulk(files, short) {
	return new Promise((resolve, reject) => {
		let gifTotal = files.length;
		let gitCount = 0;
		files.forEach((file) => {
			let src = path(`../client/images/pack/assets/minecraft/textures/${file[0]}`).replace(/\/|\\/g, '/');
			let dest = path(`../downloads/${short}/assets/minecraft/textures/${file[1]}`).replace(/\/|\\/g, '/');

			fs.copy(src, dest)
				.then(() => gitCount++)
				.then(() => gitCount == gifTotal && resolve())
				.catch((err) => reject(err));
		});
	});
}

router.get('/download/:did', (req, res, _next) => {
	res.download(TEMP_DOWNLOADS[req.params.did], (err) => {
		err != null && log.warn(err);
		if (res.headersSent) fs.remove(TEMP_DOWNLOADS[req.params.did]);
	});
});

// Redirects
fs.readJsonSync(path('../data/redirects.json')).forEach((redirect) => {
	router.get(`/${redirect.path}`, (_req, res, _next) => {
		res.redirect(301, redirect.url);
	});
});

// HTTP 404
router.use((_req, res) => res.status(404).send(http._404));

// HTTP 500
router.use((err, _req, res, _next) => {
	log.error(err.stack);
	res.status(500).send(http._500);
});
