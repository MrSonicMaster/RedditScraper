const { createWriteStream, mkdirSync, existsSync } = require('fs');
const request = require('request');

const baseURL = 'http://old.reddit.com';

// -=-=-=- ONLY CHANGE THIS -=-=-=-
const subURL = '/r/<SubredditHere>';
// -=-=-=- ONLY CHANGE THIS -=-=-=-

const saveDir = `./${subURL.replace('/r/', '')}`;
if (!existsSync(saveDir)) mkdirSync(saveDir);

const nextRegex = new RegExp(`<span class="next-button"><a href="(https://old\\.reddit\\.com${subURL}/\\?count=\\d+.+after=\\w+)"`, 'g');
const commentRegex = new RegExp(`data-permalink="(${subURL}/comments/\\w+/\\w+/)" data-domain="(\\w+?\\.?\\w+\\.\\w+)"`, 'g');

const fullURL = `${baseURL}${subURL}`;

let timesForceExited = 0;
let stop = false;

if (subURL == '/r/<SubredditHere>') {
	console.log(
		`Hey! You didn't change the subreddit in the code. Without changing that, the scraper won't know which subreddit to scrape. Open the RedditBot.js file and change the indicated line.`
	);
	process.exit(0);
}

class RedditScraper {
	static init() {
		this.finishedDownloads = 0;
		this.startedDownloads = 0;
		this.deadLinks = 0;

		this.verbosity = 0; // 0 = only important, 1 = some info, 2 = max info

		this.deadDomains = new Set(['eroshare.com', 'vid.me']);
		this.unsupportedDomains = new Set(['youtu.be', 'youtube.com', 'streamable.com']);

		this.delay = 1000;
	}

	static scrape(page) {
		const opts = this.getOpts(page);

		request(opts, (err, res, body) => {
			if (!this.checkSuccess(err, res, body)) return setTimeout(() => this.scrape(page), this.delay);

			this.handleNextPage(body);

			this.handleComments(body);
		});
	}

	static handleNextPage(body) {
		const nextPageMatches = this.getMatches(nextRegex, body, 0);

		if (nextPageMatches.length > 0) {
			const nextPage = nextPageMatches[0].replace('amp;', '');
			this.scrape(nextPage);

			this.log(`Scrape next page ${nextPage}`, 1);
		}
	}

	static handleComments(body) {
		const comments = this.getMatches(commentRegex, body, 0);
		const urls = this.getMatches(commentRegex, body, 1);

		this.log(`comments on page: ${comments.length}::${urls.length}`, 2);

		let commentIndex = 0;
		comments.forEach(commentURL => {
			const opts = this.getOpts(`${baseURL}${commentURL}`);

			const fileName = commentURL.split('/')[5];

			const imageDomain = urls[commentIndex++];

			if (this.deadDomains.has(imageDomain) || this.unsupportedDomains.has(imageDomain)) return this.deadLinks++;

			const imageRegex = new RegExp(`href="(https://${imageDomain}/\\w+\\.?(jpg|png|jpeg|gif)?)" tabindex="1"`, 'g');

			this.loadCommentPage(opts, imageRegex, imageDomain, fileName);
		});
	}

	static loadCommentPage(opts, imageRegex, imageDomain, fileName) {
		request(opts, (err, res, body) => {
			if (!this.checkSuccess(err, res, body)) return setTimeout(() => this.loadCommentPage(opts, imageRegex, fileName), this.delay);

			const imageURLs = this.getMatches(imageRegex, body, 0);
			const imgTypes = this.getMatches(imageRegex, body, 1);

			this.log(`images on comment page: ${imageURLs.length}`, 2);

			let imageIndex = 0;
			imageURLs.forEach(url => {
				if (imageDomain == 'gfycat.com') return this.handleGfyCat(url, fileName);

				const fileExtention = imgTypes[imageIndex++];

				const opts = this.getOpts(url);

				this.download(opts, fileName, fileExtention);
			});
		});
	}

	static handleGfyCat(url, fileName) {
		const gifID = url.split('gfycat.com/')[1];

		request(url, (err, res, body) => {
			if (!this.checkSuccess(err, res, body)) return setTimeout(() => this.handleGfyCat(url, fileName), this.delay);

			const regex = new RegExp(`src="(https://\\w+\\.gfycat\\.com/${gifID}\\.mp4)"`, 'g');

			const rawVideoURLs = this.getMatches(regex, body, 0);

			if (rawVideoURLs.length > 0) {
				const opts = this.getOpts(rawVideoURLs[0]);

				this.download(opts, fileName, 'mp4');
			}
		});
	}

	static download(opts, fileName, fileExtention) {
		if (!fileExtention) this.deadLinks++; // TODO: Implement better fix

		const dir = `${saveDir}/${fileName}.${fileExtention}`;

		this.log(`Downloading ${opts.url} to file ${dir}`, 0);

		this.startedDownloads++;

		request(opts)
			.pipe(createWriteStream(dir))
			.on('error', () => setTimeout(() => download(opts), 1000))
			.on('close', () => {
				this.finishedDownloads++;

				const runningDownloads = this.startedDownloads - this.finishedDownloads;

				const total = this.finishedDownloads + runningDownloads + this.deadLinks;

				const msg = `Downloaded ${this.finishedDownloads} total so far, ${this.startedDownloads} started, ${runningDownloads} still running. Total ${total} hits.`;

				this.log(msg, 0);

				if (runningDownloads == 0 && stop) process.exit(0);
			});
	}

	// Utils
	static checkSuccess(err, res, body) {
		if (err || !res || res.statusCode != 200 || stop) return false; // Unsuccessful

		return true; // Successful
	}

	static getMatches(regex, input, index) {
		const matches = [];

		let match;
		while ((match = regex.exec(input)) != null) {
			matches.push(match[index + 1]);
		}

		return matches;
	}

	static getOpts(url) {
		// Returns request options
		const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36';
		const cookie = 'over18=1;';
		const method = 'GET';

		const headers = {
			'User-Agent': userAgent,
			Cookie: cookie
		};

		return { url, method, headers };
	}

	static log(message, level) {
		if (this.verbosity >= level) console.log(message);
	}
}

RedditScraper.init();

RedditScraper.scrape(fullURL);

process.on('SIGINT', () => {
	console.log('!=!=!=!=!=!=!=!=!=!=!=!=!=!=!=!');
	console.log('!=!=!=!=!=!=!=!=!=!=!=!=!=!=!=!');

	switch (timesForceExited) {
		case 0:
			console.log('EXIT REGISTERED. WAITING FOR CURRENT DOWNLOADS TO COMPLETE. NO NEW DOWNLOADS WILL BE STARTED.');
			stop = true;
			break;
		case 1:
			console.log('EXIT ALREADY REGISTERED. PRESS 1 MORE TIME FOR FORCEFUL EXIT. THIS WILL RESULT IN CORRUPTED FILES!');
			break;
		case 2:
			process.exit();
	}

	timesForceExited++;

	console.log('!=!=!=!=!=!=!=!=!=!=!=!=!=!=!=!');
	console.log('!=!=!=!=!=!=!=!=!=!=!=!=!=!=!=!');
});

// process.on('uncaughtException', () =>
// 	console.log('PREVENTED SCRIPT EXIT - POSSIBLE SKIPPED RESOURCE! (Link down? Internet lagging? Site lagging?)')
// );
