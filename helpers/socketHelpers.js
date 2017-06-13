var fs = require('fs');
var lbryApi = require('../helpers/lbryApi.js');
var config = require('config');
var ua = require('universal-analytics');

var walledAddress = config.get('WalletConfig.lbryAddress');
var googleAnalyticsId = config.get('AnalyticsConfig.googleId');
var visitor = ua(googleAnalyticsId, {https: true});

function handlePublishError(error) {
	if (error.code === "ECONNREFUSED"){
		return "Connection refused.  The daemon may not be running.";
	} else if (error.response.data.error) {
		return error.response.data.error;
	} else {
		return error;
	};
}

function createPublishParams(name, filepath, license, nsfw) {
	var publishParams = {
		"name": name,
		"file_path": filepath,
		"bid": 0.01,
		"metadata":  {
			"description": name + " published via spee.ch",
			"title": name,
			"author": "spee.ch",
			"language": "en",
			"license": license,
			"nsfw": (nsfw.toLowerCase() === "true")
		},
		"claim_address": walledAddress,
		"change_address": walledAddress //requires daemon 0.12.2rc1 or above
	};
	return publishParams;
}

function deleteTemporaryFile(filepath) {
	fs.unlink(filepath, function(err) {
		if (err) throw err;
		console.log('successfully deleted ' + filepath);
	});
}

module.exports = {
	publish: function(name, filepath, license, nsfw, socket) {
		// update the client
		socket.emit("publish-status", "Your image is being published (this might take a second)...");
		visitor.event("Publish", "Publish Request", name, {filepath, license, nsfw}).send();
		// create the publish object
		var publishParams = createPublishParams(name, filepath, license, nsfw);
		// get a promise to publish
		lbryApi.publishClaim(publishParams)
		.then(function(data){
			visitor.event("Publish", "Publish Success", name, {filepath, license, nsfw}).send();
			console.log("publish promise success. Tx info:", data)
			socket.emit("publish-complete", {name: name, result: data.result});
			deleteTemporaryFile(filepath);
		})
		.catch(function(error){
			visitor.event("Publish", "Publish Failure", name, {filepath, license, nsfw}).send();
			console.log("error:", error);
			socket.emit("publish-failure", handlePublishError(error));
			deleteTemporaryFile(filepath);
		});
	}
}