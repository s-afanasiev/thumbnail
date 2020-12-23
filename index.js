//@ Requirements:
//@ in this directory must be 'ffmpeg.exe' file

const fs = require('fs');

const thumbnail = require('./thumbnail_imp.js');

//@ its checked that possible to write full path to video file
let mp4_path = 'c:/Users/sea/Downloads/detect_simple_objects.mp4';
//@ or video in same dir like this
let mp4_path_2 = 'out.mp4';

//@ when you send request to make thumbnail> there are two necessary params
//@ request_id - can be any number or string
//@ mp4_path - path to video file
thumbnail.emit("thumbnail_request", {request_id: 25, mp4_path: mp4_path});
setTimeout(()=>{
	thumbnail.emit("thumbnail_request", {request_id: "wesdcxvhhkj", mp4_path: mp4_path_2});
}, 3000);
//@ Here thumbnail responses comes, 'arg' param contain next fileds:
//@ arg.buffer - this is picture data in Buffer type. 
//@ arg.request_id - request_id of file, so that we can recognize, which request was answered 
thumbnail.on("thumbnail_response", (err, arg)=>{
	if(err) { return console.log("index: THUMBNAIL ERROR:"+err); }
	console.log("index: THUMBNAIL READY! buffer length ="+arg.buffer.length);
	
	//@ for example we can save buffer to jpg file:
	write_buffer_to_file_2(arg.buffer, arg.request_id+'.jpg').then(res=>console.log("file saved")).catch(err=>console.log("file saved eror:"+err));
});


function write_buffer_to_file_2(buf, paf){
	return new Promise((resolve, reject)=>{
		paf = paf || "test.jpg";
		fs.writeFile(paf, buf,  "binary",function(err) {
			if(err){ reject(err); }
			else{ resolve(); }
		});
	});
}