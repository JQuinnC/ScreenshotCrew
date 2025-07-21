#! /usr/bin/env node

"use strict";

// External Packages
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { URL } = require("url");
const { Storage } = require("@google-cloud/storage");
const _ = require("underscore");

// Internal Modules
const winston = require("./logger").winston;
const util = require("./utility.js");

module.exports = class ShotBot {
	defaultOptions = {
		"fileFormat": "image",	//"image", "pdf"
		"pageSize": "A4",
		"width": 1440,
		"height": 1024,
		"isMobile": false
	}

	//Default Constructor
	constructor(strURL, options) {
		var me = this;

		me.options = _.extend({}, me.defaultOptions, options);
		me.logger = winston(process.env.LOG_LEVEL);

		if (!util.isBlank(strURL)) {
			this.objURL = new URL(strURL);
		}
		else {
			this.objURL = null;
		}
		
		this.dimensions = {
			width: 0,
			height: 0
		};

		//Default Values
		this.requestId = uuidv4();
		this.screenshotPath = path.join(path.dirname(fs.realpathSync(__filename)), "../screenshots/");
		this.appServerURL = process.env.APP_SERVER;
	}

	getScreenshot = async () => {
		var me = this;

		me.logger.info("getScreenshot : " + this.objURL);

		const args = ["--disable-setuid-sandbox", "--no-sandbox", "--disable-extensions"];
		const options = {
			args,
			headless: true
		};
		const browser = await puppeteer.launch(options);

		try {
			//Puppeteer Page
			const page = await browser.newPage();

			//Setup Page
			await this.setup(page);

			let imageName = await this.takeScrenshot(page);
			let imageCloudFrontURL = await this.uploadScreenshot(imageName);

			//Close Browser Object
			browser.close();

			if (!util.isBlank(imageCloudFrontURL)) {
				return _.extend({
					"screenshotPath": imageCloudFrontURL["FilePath"]
				}, me.options);
			}
			else {
				return _.extend({
					"screenshotPath": this.appServerURL + "/api/screenshot/" + imageName
				}, me.options);
			}
		}
		catch(ex) {
			browser.close();

			throw ex;
		}
	}
	
	setup = async (page) => {
		var me = this;

		me.logger.info("Setup : " + this.objURL);

		try {
			//Set Viewport
			page.setViewport({
				width: me.options.width,
				height: me.options.height,
				deviceScaleFactor: 1,
				isMobile: me.options.isMobile
			});

			//Setup UserAgent
			const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.54 Safari/537.36";
			await page.setUserAgent(userAgent);

			await page.goto(me.objURL, {
				waitUntil: "networkidle2",
				timeout: (90 * 1000)	//1.5 minutes
			});

			//Delay 1s
			await util.delay(1000);

			//Scroll to Bottom of the Page to unvail all the lazy/animated content of the page
			await me.scrollToBottom(page);
			await me.scrollToTop(page);

			//Delay 1s
			await util.delay(1000);

			// Get Page's Width and Height to debug wrong section data
			me.dimensions = await page.evaluate(() => {
				return {
					width: Math.max(
						1280,
						Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
						Math.max(document.body.offsetWidth, document.documentElement.offsetWidth),
						Math.max(document.body.clientWidth, document.documentElement.clientWidth)
					),
					height: Math.max(
						Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
						Math.max(document.body.offsetHeight, document.documentElement.offsetHeight),
						Math.max(document.body.clientHeight, document.documentElement.clientHeight)
					)
				};
			});

			me.options.document = {
				"width": me.dimensions.width,
				"height": me.dimensions.height
			};


			//TODO
			//me.options.height = me.dimensions.height;
		}
		catch(ex) {
			me.logger.error(ex);
		}
	}

	scrollToTop = async (page) => {
		var me = this;

		me.logger.info("scrollToTop : " + this.objURL);

		await page.evaluate(function() {
			window.setTimeout(function () {
				window.scrollTo(0, 0);	//Back to x = 0, y = 0
			}, 250);
		});

		await util.delay(500);
	}

	scrollToBottom = async(page) =>  {
		var me = this;

		me.logger.info("scrollToBottom : " + this.objURL);

		// Scrolling to bottom to load all the lazy loading contents
		await page.evaluate(function() {
			//Figure out Max Height
			var maxHeight = Math.max(
				Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
				Math.max(document.body.offsetHeight, document.documentElement.offsetHeight),
				Math.max(document.body.clientHeight, document.documentElement.clientHeight)
			);

			function scrollToBottom(x, iInc, callBack) {
				if (maxHeight > x) {
					window.setTimeout(function () {
						window.scrollTo(0, x + iInc);
						scrollToBottom(x + iInc, iInc, callBack);
					}, 250);
				}
				else {
					if (callBack) {
						callBack();
					}
				}
			}

			scrollToBottom(0, Math.ceil(maxHeight / 10), function () {
				//TODO: Nothing
			});
		});

		//10 Iteration Only each of them will be 250 ms so, 2500 total
		await util.delay(2500);
	}

	takeScrenshot = async (page) => {
		var me = this;

		me.logger.info("takeScrenshot : " + this.objURL);

		//Create Screenshot Directory if doesn't exist?
		if (!fs.existsSync(this.screenshotPath)){
			fs.mkdirSync(this.screenshotPath);
			me.logger.info("takeScrenshot - Making Directory at " + this.screenshotPath);
		}

		if (me.options.fileFormat == "pdf") {
			let imageName = this.requestId + ".pdf";
			let screenshotPath = this.screenshotPath + imageName;

			//FullPage is causing webpage to scale so, adding clip screenshot correctly!
			let pdfOptions = {
				path: screenshotPath,
				scale: 1,
				displayHeaderFooter: false,
				printBackground: true,
				landscape: false,
				preferCSSPageSize: false,
				omitBackground: false,
				timeout: (45 * 1000)
			};

			if (util.isBlank(me.options.width) && util.isBlank(me.options.height)) {
				if (!_.contains(["Letter", "Legal", "Tabloid", "Ledger", "A0", "A1", "A2", "A3", "A4", "A5", "A6"], me.options.pageSize)) {
					pdfOptions["format"] = "A4";
				}
				else {
					pdfOptions["format"] = me.options.pageSize;
				}
			}
			else {
				pdfOptions["width"] = me.options.width;
				pdfOptions["height"] = me.options.height;
			}

			await page.pdf(pdfOptions);

			return imageName;
		}
		else {
			let imageName = this.requestId + ".webp";
			let screenshotPath = this.screenshotPath + imageName;

			//FullPage is causing webpage to scale so, adding clip screenshot correctly!
			await page.screenshot({
				path: screenshotPath,
				type: "webp",	// jpeg, png or webp
				quality: 100,
				fullPage: true,
				omitBackground: false,
				encoding: "binary",	//	base64 or binary
				captureBeyondViewport: true,
			});

			return imageName;
		}
	}

	uploadScreenshot = async (imageName) => {
		var me = this;

		if (!util.isBlank(process.env.GCP_PROJECT_ID) && 
			!util.isBlank(process.env.GCS_BUCKET_NAME)) {

			me.logger.info("uploadScreenshot : " + this.objURL);

			let screenshotPath = this.screenshotPath + imageName;

			// Initialize Google Cloud Storage
			const storage = new Storage({
				projectId: process.env.GCP_PROJECT_ID
			});

			const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
			
			// Generate unique filename
			let screenshotName = uuidv4();
			let fileExtension = imageName.includes('.pdf') ? '.pdf' : '.webp';
			let cloudFileName = screenshotName + fileExtension;
			
			const file = bucket.file(cloudFileName);

			try {
				// Upload file to GCS
				await bucket.upload(screenshotPath, {
					destination: cloudFileName,
					metadata: {
						cacheControl: 'public, max-age=31536000',
					},
				});

				me.logger.info("File uploaded successfully: " + cloudFileName);

				// Return data in format similar to AWS response
				return {
					Location: `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${cloudFileName}`,
					FilePath: `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${cloudFileName}`,
					Key: cloudFileName,
					Bucket: process.env.GCS_BUCKET_NAME
				};

			} catch (error) {
				me.logger.error("Upload error:", error);
				throw error;
			}
		}
		else {
			me.logger.info("GCP credentials not configured, storing locally only");
			return Promise.resolve(null);
		}
	}

	fetchScreenshot = (req, res, imageName) => {
		var me = this;

		me.logger.info("fetchScreenshot: imageName = " + imageName);

		let imagePath = this.screenshotPath + imageName;
	
		//Check if the image exists
		fs.stat(imagePath, function(errOutter, stat) {
			if(errOutter) {
				res.writeHead(500, {"Content-Type": "application/json"});
				res.write(JSON.stringify({
					"Status": "ERROR",
					"Message": "File Not Found",
					"Detail": errOutter
				}));
				res.end();
			}
			else {
				me.logger.info("File Size: " + stat.size);

				fs.readFile(imagePath, function(errInner, data) {
					if(errInner) {
						res.writeHead(500, {"Content-Type": "application/json"});
						res.write(JSON.stringify({
							"Status": "ERROR",
							"Message": "File Not Found",
							"Detail": errInner
						}));
						res.end();
					}
					else {
						if (imageName.endsWith(".pdf")) {
							res.writeHead(200, { "Content-Type": "application/pdf" });
							res.end(data);
						}
						else {
							res.writeHead(200, { "Content-Type": "image/webp" });
							res.end(data);
						}
					}
				});
			}
		});
	}
}