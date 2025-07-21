#! /usr/bin/env node

"use strict";

// const Memcached = require("memcached"); // Disabled for GCP deployment

module.exports = class Utility {
	static isBlank = (obj) => {
		return (!obj || obj === "");
	}

	static getCachedResult = async (strKey) => {
		// Caching disabled for simplified GCP deployment
		return Promise.resolve(null);
	}

	static setCachedResult = async (strKey, data) => {
		// Caching disabled for simplified GCP deployment
		return Promise.resolve(false);
	}

	static delay = (timeout) => {
		return new Promise((resolve) => {
			setTimeout(resolve, timeout);
		});
	}
}