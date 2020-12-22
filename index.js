//@ Requirements:
//@ in this directory must be 'ffmpeg.exe' file

const thumbnail = require('./thumbnail.js');

//@ full path to video file
let path_to_mp4 = 'c:/Users/sea/Downloads/detect_simple_objects.mp4';
//@ or video in this dir
//path_to_mp4 = 'out.mp4';

thumbnail.emit("thumbnail_request", {request_id: 25, path_to_mp4: path_to_mp4}});

thumbnail.on("thumbnail_ready", (buffer)=>{
	//@ this is buffer of thumbnail !
	console.log("THUMBNAIL READY!");
})

thumbnail.on("thumbnail_error", (err)=>{
	console.log("THUMBNAIL ERROR:"+err);
})