//@ 1. Get videofile info: ffmpeg -i video.avi

//@ 2. extract frame from specified second and frame size: ffmpeg -ss 00:00:03 -i out.mp4 -frames: 1 -s 194x108 out1.jpg

//@ TODO: when add new request

const os = require('os');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const mysql = require("mysql");
const spawn = require('child_process').spawn;

const checkDiskSpace = require('./checkDiskSpace');
const { isRegExp } = require('util');
const DISK_LETTER = "C:";

const FFMPEG_PATH = __dirname+'\\ffmpeg.exe';
let IMAGES_PATH = "./pic/";

const EXTERNAL_SOCKET = new EventEmitter();
let is_external_socket_listener_ready = false;

var REQUESTS = [];
//@instant queue, to receive requests before server init
const FlashQueue = [];

var mysql_pool = undefined;

const 	DB_PORT = 3306,
		DB_HOST = "127.0.0.1",
		DB_USER = "root",
		DB_PASSWORD = "rootpwd21<>",
		DB_NAME = "thumbnail";

const TTASK = "task";

const FFMPEG_LIMIT = 3;
let Global_thumbnails_counter = 0;
//const videous = ['h:/Downloads/[DevOps]2020/00_intro.mkv','h:/Downloads/[DevOps]2020/01_git.mkv','h:/Downloads/[DevOps]2020/02_dev_for_ops.mkv','h:/Downloads/[DevOps]2020/03_cicd.mkv','h:/Downloads/[DevOps]2020/05_IaC_part1.mkv','h:/Downloads/[DevOps]Specialist/KUBER 12.08.2020.mp4','h:/Downloads/[DevOps]Specialist/KUBER 13.08.2020.mp4','h:/Downloads/[DevOps]Specialist/KUBER 14.08.2020.mp4','h:/Downloads/[RxJS]2020/2020-05-30-0859.mp4','h:/Downloads/[RxJS]2020/2020-05-31-0859.mp4']
const videous = ['./out.mp4','c:/Users/sea/Downloads/detect_simple_objects.mp4','c:/Users/sea/Downloads/VIDEO/stadion_1988.mp4','c:/Users/sea/Downloads/VIDEO/remont_kofewarki_Zelmer.mp4','c:/Users/sea/Downloads/VIDEO/Koloradskiy juk.mp4','c:/Users/sea/Downloads/s dnem rojdeniya.mp4','c:/Users/sea/Downloads/Raspoznavanie dorojnyh znakov part 1.mp4','c:/Users/sea/Downloads/Raspoznavanie dorojnyh znakov part 2.mp4','c:/Users/sea/Downloads/Raspoznavanie dorojnyh znakov part 3.mp4','./out.mp4']


module.exports = {
	emit: function(event, msg){
		if(event != 'thumbnail_request'){
			return console.log("no such listener: "+event+", use 'thumbnail_request' instead!")
		}
		if(is_external_socket_listener_ready){
			console.log("event is queued");
			EXTERNAL_SOCKET.emit(event, msg);
		}
		else{
			console.log("event is prequeued");
			msg.status = 'pending'; msg.flash = true;
			FlashQueue.push(msg);
		}
	},
	on: function(event, callback){
		if(event != 'thumbnail_response'){
			return callback("no such listener, use 'thumbnail_response' instead!")
		}
		EXTERNAL_SOCKET.on("thumbnail_ready", (args)=>{
			//@ args = {buffer, request_id}
			callback(null, args);
		});
		EXTERNAL_SOCKET.on("thumbnail_error", (err)=>{
			callback(err);
		});
	}
}
//----IMPLEMENTATION----
main();

//@ call outside like: fu(path_to_mp4, callback((err, res)=>{...}))
function get_mp4_name(mp4_path){
	let MP4_NAME;
	let divider = '/'
	let is_slash = mp4_path.indexOf('/') > -1;
	let is_reverse_slash = mp4_path.indexOf('\\') > -1;
	if(is_reverse_slash) divider = '\\';
	if(is_slash || is_reverse_slash) {
		const path_arr = mp4_path.split(divider);
		MP4_NAME = path_arr[path_arr.length-1]
	} else{ MP4_NAME = mp4_path; }
}
// --------------------------------
function main(){
	//---------------------------------
	create_output_images_dir();
	//@ Start logger, db and wait to requests from external socket 
	start_logger().then(res=>{
		return start_db();
	}).then(()=>{	
		//@ if DB had unfinished tasks when the system was restarted
		log("main: calling launch_unfinished_tasks()");
		return launch_unfinished_tasks();
	}).then(()=>{
		//@ listen for new requests from outside
		listen_external_socket();
		
		//@ launch test requests
		/*
		test_emitter(9);
		setTimeout(()=>{
			test_emitter(3);
		}, 120000)
		*/

	}).catch(err=>{ log("ERROR: "+err); })
}

function create_output_images_dir(){
	
	if (IMAGES_PATH){
		IMAGES_PATH = IMAGES_PATH.trim();
		if(IMAGES_PATH[IMAGES_PATH.length-1] !='/'){IMAGES_PATH+='/'}
		if (!fs.existsSync(IMAGES_PATH)){
			fs.mkdirSync(IMAGES_PATH);
		}
		
	}
	else {
		IMAGES_PATH = './'
	}
}

function listen_external_socket(){
	EXTERNAL_SOCKET.on('thumbnail_request', (msg)=>{
		log("EXTERNAL_SOCKET: thumbnail_request: "+JSON.stringify(msg));
		//@ msg = {request_id: 25, mp4_path: 'D:/video/file.mp4'}
		if(!msg.mp4_path){ return console.log("ERROR: no mp4 path"); }
		msg.request_id = String(msg.request_id);
		extract_frame_by_request_with_limit(msg).catch((err)=>{console.log("error 11")});
	});
	//@ global variable
	is_external_socket_listener_ready = true;
	FlashQueue.forEach(task=>REQUESTS.push(task));
	const flashes = REQUESTS.filter(task=>task.flash);
	if(flashes.length == REQUESTS.length) {
		extract_frame_by_request_with_limit(flashes[0]).catch((err)=>{console.log("error 12")});
	}

	EXTERNAL_SOCKET.on("thumbnail_ready", (buffer)=>{
		console.log("listen_external_socket(): THUMBNAIL READY!");
		//@ this is buffer of thumbnail !
	});
	EXTERNAL_SOCKET.on("thumbnail_error", (err)=>{
		console.log("listen_external_socket(): THUMBNAIL ERROR:"+err);
		//@ this is buffer of thumbnail !
	});
}

//-----Test Emitter-----
function test_emitter(test_counter){
	let iteration_counter = 0;
	let iteration_interval = setInterval(()=>{
		if(++iteration_counter > test_counter){
			clearInterval(iteration_interval);
			return setTimeout(()=>{console.log("test emitter end!")}, 5000)
		}
		const rand = Math.floor(Math.random() * 10);
		const idRand = Math.floor(Math.random() * 10000);
		EXTERNAL_SOCKET.emit('thumbnail_request', {request_id: idRand.toString(), mp4_path: videous[rand]})
	}, 300);
}

//-----LOGGER--------
function start_logger(){
	return new Promise((resolve,reject)=>{
		var dir = './log';
		if (!fs.existsSync(dir)){
			fs.mkdirSync(dir);
		}

		let date_full = new Date();
		let date_h = date_full.getHours();
		let date_m = date_full.getMinutes();
		let date_s = date_full.getSeconds();
		let fname = path.normalize(dir+"/log_"+date_h+"-"+date_m+"-"+date_s+".txt");
		try{
			fd_log = fs.createWriteStream(fname,{flags:'w'});//fs.openSync(fname, 'w');
			resolve();
		}catch(err){ reject("start_logger Error:"+err) }
	});
}

function log(msg){
	let date = new Date();
	let date_h = date.getHours();
	let date_m = date.getMinutes();
	let date_s = date.getSeconds();
	let date_ms = date.getMilliseconds();
	let date_hms = date_h+'-'+date_m+'-'+date_s+'-'+date_ms+':'
	fd_log.write(os.EOL+date_hms+msg+os.EOL);
}

//--------DB---------
function start_db(){
	//@ 127.0.0.1,3306,root,rootpwd21<>,thumbnails_mp4
	return new Promise((resolve,reject)=>{
		try{
			//@  connect MYSQL with the goal to create new Database if not exist
			var con = mysql.createConnection({
				host: DB_HOST,
				port: DB_PORT,
				user : DB_USER,
				password: DB_PASSWORD
			});
			  
			con.connect(function(err) {
				if (err) return reject("DB connect Error:"+err);
				//console.log("Connected!");
				con.query("CREATE DATABASE IF NOT EXISTS thumbnail;", function (err, result) {
					if (err) return reject("create db Error:"+err);
					log("Database ok");

					mysql_pool  = mysql.createPool({
					connectionLimit: 20,
					host: DB_HOST,
					port: DB_PORT,
					user : DB_USER,
					password: DB_PASSWORD,
					database: DB_NAME
					});

					const table_query = 
					`CREATE TABLE IF NOT EXISTS ${TTASK} (
						id INT(11) unsigned NOT NULL AUTO_INCREMENT,
						request_id VARCHAR(300) NOT NULL,
						mp4_path VARCHAR(1000) NOT NULL,
						status VARCHAR(30),
						details VARCHAR(2000),
						add_time TIMESTAMP,
						done_time TIMESTAMP,
						PRIMARY KEY (id)
					) ENGINE=InnoDB DEFAULT CHARSET=utf8;`;
					
					mysql_pool.query(table_query, function (err, result) {
						if (err) return resolve("create table Error:"+err);
						log("Table task ok");
						resolve();
					});
				});
			});
			
		} catch(err){ reject("Starting DB ERROR: "+err) }
	});
}

function mysql_query(q){
	//todo checked security
	return new Promise((resolve,reject) => {
		log("MYSQL QUERY: "+q);
		mysql_pool.query(q, function(error, rows, fields){
			if (error){ reject(error); }
			else { resolve({rows, fields}); }
		});
	});
}

function db(cmd, msg){
	return new Promise((resolve, reject)=>{
		let q = "";
		if(cmd == "c_story_task"){
			q += "INSERT INTO "+TTASK+" (request_id, mp4_path, status, add_time) VALUES ("+msg.request_id+", '"+msg.mp4_path+"', 'pending', now())";
		}
		else if(cmd == "r_get_limit"){
			q += "SELECT COUNT(*) AS count FROM "+TTASK+" WHERE status = 'pending';"
		}
		else if(cmd == "r_unfinished_tasks"){
			q += "SELECT id, request_id, mp4_path, status FROM "+TTASK+" WHERE status = 'pending' ORDER BY id;"
		}
		else if(cmd == "r_next_pending_task"){
			q += "SELECT MIN(id) AS next_pending_id, request_id, mp4_path FROM task WHERE status = 'pending';"
		}
		else if(cmd == "u_save_task_done"){
			//@ status can be: 1) "pending" 2) "done" 3) "error"
			q += "UPDATE "+TTASK+" SET status = 'done', done_time = now() WHERE request_id = '"+msg.request_id+"';"
		}
		else if(cmd == "u_save_task_error"){
			q += "UPDATE "+TTASK+" SET status = 'error', done_time = now(), details = '"+msg.details+"' WHERE request_id = '"+msg.request_id+"';"
		}
		mysql_query(q).then((res)=>{
			//log('db(): success: '+q);
			resolve(res); 
		}).catch((err)=>{ 
			log('db() error: '+err);
			reject("db Error: "+err); 
		});
	})
}
//@-----REQUESTS structure functions-------------
function lb_ru_next_pending(){
	let next_pending_task;
	for(let i=0; i<REQUESTS.length; i++){
		if(REQUESTS[i].status == 'pending'){
			REQUESTS[i].status = 'work';
			next_pending_task = REQUESTS[i];
			break;
		}
	}
	return next_pending_task;
}

function lb_r_get_limit(){
	let temp = [];
	REQUESTS.forEach(task=>{
		if(task.status == 'work'){
			temp.push(task);
		}
	})
	//const temp = REQUESTS.filter(task=>task.status == 'work');	
	return temp.length;
}

function lb_d_task_done(task){
	//@ task = {id: 1000, "request_id":4547, "mp4_path":"c:/user/video.mp4", status:'work'}, where id - is uniq autoincremented id from database, and 'request_id' - id from external user, which potentially can be repeated
	if(task.id){
		REQUESTS = REQUESTS.filter(req=>req.id != task.id);	
	} else if(task.request_id){
		REQUESTS = REQUESTS.filter(req=>req.request_id != task.request_id);
	} else{ log("lb_d_task_done() ERROR: "+JSON.stringify(task)) }

}

function lb_u_status_work(msg){
	log("lb_u_status_work(msg): REQUESTS.length="+REQUESTS.length);
	for(let i=0; i<REQUESTS.length; i++){
		log("REQUESTS["+i+"].request_id="+REQUESTS[i].request_id+", msg.request_id="+msg.request_id);
		if(REQUESTS[i].request_id == msg.request_id){
			REQUESTS[i].status = 'work';
		}
	}
	return msg;
}

//@------Frame limit------

//@ When App Start - it ask DB if exist unfinished tasks and launch them
function launch_unfinished_tasks(){
	return new Promise((resolve,reject)=>{
		db("r_unfinished_tasks").then(res=>{
			if(res.rows.length == 0) {
				log("no unfinished tasks on App restart...");
				return resolve();
			}
			//@ res.rows[i] = {id, request_id, mp4_path, status}
			//@ save to local array all pending tasks from db
			REQUESTS = res.rows;			
			log(REQUESTS.length+" unresolved tasks on App restart");
			
			//@ launch several self-cycled extract loops, but no more than FFMPEG_LIMIT and no more than count of unfinished tasks in DB on App restart. NOTE, in condition below its important to compare 'lim_ctr' exactly with res.rows.length! NOT with REQUESTS.length! Because REQUESTS array will be updated with new entries later by EXTERNAL_SOCKET. Here we aim to process only unfinished tasks in database after APP was restarted.
			let lim_ctr = 0;
			while(lim_ctr<=FFMPEG_LIMIT && lim_ctr<res.rows.length){
				// @ res.rows[lim_ctr] = {"request_id":4853,"mp4_path":"./out.mp4"}
				log("limit counter = "+lim_ctr);
				let next_pending = lb_ru_next_pending();
				if(next_pending) { 
					make_tasks_in_cycled_pipe(next_pending, "recursive"); } 
				else{ log("launch_unfinished_tasks(): wtf? next_pending = "+JSON.stringify(next_pending)) }
				lim_ctr++;
			}
			//@ our service is now open for new external requests
			resolve();
		}).catch(err=>{ 
			const err_msg = "db(): r_unfinished_tasks Error:"+err;
			reject(err_msg);
		})
	})
}

//@ This action happens, when a request from EXTERNAL_SOCKET is received
function extract_frame_by_request_with_limit(task_msg){
	return new Promise((resolve, reject)=>{
		//@ 1) put request to global REQUESTS array
		task_msg.status = 'pending';
		REQUESTS.push(task_msg);

		//@ 2) write to database record about new request
		db("c_story_task", task_msg).then(res=>{
			log('task writen in db');
			if(typeof res.rows == "object"){
				if(res.rows.insertId){
					task_msg.id = res.rows.insertId;
				}
			}
			//@ 3) look, can we launch new ffmpeg or limit is reached
			const limit = lb_r_get_limit();
			if (limit >= FFMPEG_LIMIT){
				return log("limit has reached!");
			}
			//@ 4) if limit has not reached when change status to 'work'
			log("limit = "+ limit);
			lb_u_status_work(task_msg);
			//@ 5) and start extracting thumbnails
			make_tasks_in_cycled_pipe(task_msg, "external socket");
		}).catch(err=>{console.log("db.c_story_task Error: "+err)})
	});


}

//------Extract frame------
//@ can called from: 1) launch_unfinished_tasks(); 2)extract_frame_by_request_with_limit(); 3) self recursion
function make_tasks_in_cycled_pipe(task, who){
	//@ task = {id: 1000, "request_id":4547, "mp4_path":"c:/user/video.mp4", status:'work'}
	log("make_tasks_in_cycled_pipe(): task from "+who);
	//@ 1) extract thumbnail from video file. It means that thumbnail will appear in the root dir or in the 'IMAGES_PATH' dir
	extract_one_frame(task).then(()=>{
		//@Each 10-th success thumbnail ask disk if disk space is enouth:
		if(++Global_thumbnails_counter % 10 == 0){
			checkDiskSpace(DISK_LETTER).then(res=>{
				//@ res = {"diskPath":"C:","free":2415955968,"size":109441970176}
				console.log("checkDiskSpace = "+JSON.stringify(res));
				//@ less than 2 Gb
				if(res.free < 2000111000){
					log("AHTUNG! disk "+DISK_LETTER+" space is running out!");
					console.log("AHTUNG! disk "+DISK_LETTER+" space is running out!");
				}
			}).catch(err=>{
				console.log("checkDiskSpace error = "+err);
			});
		}

		log("make_tasks_in_cycled_pipe(): extract_one_frame() ok");
		//@ 2) delete task from global REQUESTS array
		lb_d_task_done(task);
		//@ 3) write in database that file was done!
		db("u_save_task_done",task).catch(err=>{log("db 'u_save_task_done' Error:", err)});
		//@ 4) get thumbnail picture from file system and send to external socket like Buffer type
		send_picture_file_to_external_socket(task).catch(err=>{log("send_picture_file_to_external_socket Error:", err)});

		//@ 5) if there is exist one more pending request, then repeat actions from (1) to (5)
		const  lb_next = lb_ru_next_pending();
		if(lb_next){make_tasks_in_cycled_pipe(lb_next);}
	}).catch(err=>{
		task.details = err;
		//@ 1) drop failed task from requests array
		lb_d_task_done(task);
		//@ 2) update db about task error
		db("u_save_task_error", task).catch(err=>{log("db 'u_save_task_error' Error:", err)});
		//@ 3) send to user msg about getting thumbnail error
		EXTERNAL_SOCKET.emit("thumbnail_error", "there is an error while getting thumbnail: "+err)
		console.log("make_tasks_in_cycled_pipe(): Error: "+err)
	})
}

//@ called only from make_tasks_in_cycled_pipe()
function extract_one_frame(msg){
	return new Promise((resolve, reject)=>{
		//@ start ffmpeg.exe to get file info (fps and duration)
		ffmpeg_file_info(msg.mp4_path).then(ffmpeg_answer=>{
			//@ convert info to json
			let json_info = ffmpeg_file_info_json(ffmpeg_answer);
			if(json_info instanceof Error){ throw new Error("ffmpeg_file_info_json Error: "+json_info) }
			//@ json_info = {"duration":{"hour":0,"min":16,"sec":42,"msec":6},"bitrate":524,"fps":25}
			json_info = calc_frames_amount(json_info);
			const extract_query = prepare_extract_query(json_info, msg);
			return ffmpeg_get_frame(extract_query);
		}).then(()=>{
				resolve(msg);
		}).catch(err=>{reject("extract_one_frame Error:"+err);})
	});
}



function send_picture_file_to_external_socket(msg){
	return new Promise((resolve, reject)=>{
		const picture_path = get_thumbnail_file_path(msg.mp4_path);
		//@ look, if such file exists
		fs.access(picture_path, fs.constants.R_OK, err => {
			if(err){ return log("no such file: "+picture_path); }
			
			//@ if file Exists:		
			const readStream = fs.createReadStream(picture_path);
			const chunks = [];
			//@ This will wait until we know the readable stream is actually valid before piping
			readStream.on('open', function () {
				log(' readStream opened');
			});
			// This catches any errors that happen while creating the readable stream (usually invalid names)
			readStream.on('error', function(err) {
				reject("readstream Error: "+err);
			});
			readStream.on('readable', () => {
				const chunk = readStream.read();
				if (chunk) {chunks.push(chunk);	}
			});
			readStream.on('end', () => {
				log(' readStream end');
				var buffer = Buffer.concat(chunks);
				
				EXTERNAL_SOCKET.emit("thumbnail_ready", {buffer:buffer, request_id: msg.request_id})
				resolve(buffer);
				//write_buffer_to_file(buffer, 'buffer.jpg')
			});
		});
	})
}


function write_buffer_to_file(buf, paf){
	return new Promise((resolve, reject)=>{
		
		//console.log(buf)
		
		paf = paf||'buffer.jpg';
		fs.open(paf, 'a', function(err, fd) {
			if(err) { 
				console.log('Cant open file'); 
			}else {
				fs.write(fd, buf, 0, buf.length, null, function(err,writtenbytes) { 
					if(err) { 
						console.log('Cant write to file'); 
					}else { 
						console.log(writtenbytes + ' characters added to file'); 
					} 
				});
			}
		});
	});
}




//----------------------------------
//@ start ffmpeg binary, listen data and extract file info
function ffmpeg_file_info(mp4_path){
	return new Promise((resolve, reject)=>{
		const params = ['-i', mp4_path];
		let result = "";
		let ffmpeg_exe;
		let f1 = false, f2 = false;
		try{ ffmpeg_exe = spawn(FFMPEG_PATH, params); } 
		catch(err){ reject("ffmpeg_file_info(): spawn Error: "+err) }
		//@ listen data on 'stdout' stream
		ffmpeg_exe.stdout.on('data', (chunk)=>{
			result += chunk.toString('utf8');
		})
		//@ listen data on 'stderr' stream
		ffmpeg_exe.stderr.on('data', (chunk)=>{
			result += chunk.toString('utf8');
		});
		ffmpeg_exe.stdout.on('close', (code)=> {
			f1 = true;
			if(f1&&f2) return resolve(result);
		});
		ffmpeg_exe.stderr.on('close', (code)=> {
			f2 = true;
			if(f1&&f2) return resolve(result);
		});
	})
}

//@ convert ffmpeg string stdout answer to json
function ffmpeg_file_info_json(res){
	const arr = res.split(os.EOL).map(el=> el.trim());
	if(arr[arr.length-2].indexOf('No such file or directory') > -1){
		return new Error(arr[arr.length-2]);
	}
	
	const json = MainRes(
		DurationAndBitrate(
			DurationString(arr)
		),
		ResolutionAndFps(
			StreamString(arr)
		)
	)
	return json;

	function MainRes(durationAndBitrate, resolutionAndFps){
		return Object.assign(durationAndBitrate, resolutionAndFps)
	}
	function DurationAndBitrate(durationString){
		//console.log("durationString ="+durationString)
		const res = {};
		//@ durationString = "Duration: 00:00:05:17, start: 0.00000, bitrate: 188 kb/s"
		let durationArr;
		try{
			durationArr = durationString.split(',').map(el=>el.trim());
		} catch(err){console.log('durationArr Error: '+err)}
		//console.log("durationArr="+durationArr);
		const [durationPart, startPart, bitratePart] = durationArr;
		//@ duration_time = '00:00:05.17'
		const duration_time = durationPart.split(': ').map(el=>el.trim())[1];
		const [durHour, durMin, durSecPart] = duration_time.split(':');
		const [durSec, durMSec] = durSecPart.split('.');
		res.duration = {hour:Number(durHour), min:Number(durMin), sec: Number(durSec), msec: Number(durMSec)};
		res.bitrate = bitratePart.split(':').map(el=>el.trim())[1].split(' ')[0];
		res.bitrate = Number(res.bitrate);
		return res;
	}
	function DurationString(fileInfoArray){
		//log("fileInfoArray="+fileInfoArray);
		const [res] = fileInfoArray.filter(str=>str.startsWith('Duration'))
		return res;
	}
	function ResolutionAndFps(streamString){
		const res = {};
		const streamArr = streamString.split(',').map(el=>el.trim());
		const [fpsPart] = streamArr.filter(el=>el.indexOf('fps')>-1);
		res.fps = fpsPart.split(' ').map(el=>el.trim())[0];
		res.fps = Number(res.fps);
		return res;
	}
	function StreamString(fileInfoArray){
		const [res] = fileInfoArray.filter(str=>str.startsWith('Stream'));
		return res;
	}
}

//@ calculate is it need to get first frame or 10%-frame of mp4 length from json info
function calc_frames_amount(res){
	let is_more_10_frames;
	if(!res) {
		res.is_more_10_frames = false;
		return res;
	}
	if(!res.duration || !res.fps){
		res.is_more_10_frames = false;
		return res;
	}
	const dur = res.duration;
	if(dur.hour == 0 && dur.min == 0 && dur.sec == 0) {res.is_more_10_frames = false}
	else {res.is_more_10_frames = true}
	return res;
}

//@ -----prepare extract frame query and launch ffmpeg to save picture on disk
function prepare_extract_query(json_info, msg){
	//const MP4_NAME = mp4_name_without_ext(msg.mp4_path);
	const thumbnail_file_full_path = get_thumbnail_file_path(msg.mp4_path);
	let result = [];
	let time_start_str = "00:00:00";
	if(json_info.is_more_10_frames){
		//@ return 10% frame
		time_start_str = calculate_time(json_info);
	}
	result.push("-i", msg.mp4_path, "-ss", time_start_str, "-frames:", "1", "-s", "194x108", thumbnail_file_full_path);
	return result;
}

function calculate_time(res){
	const dur = res.duration;
	const sec_amount = dur.sec + (dur.min*60) + (dur.hour*3600);
	const all_sec_10_percent = Math.floor(sec_amount / 10);
	const frame_10_percent = Math.floor(all_sec_10_percent * res.fps);
	let hour_10_percent = Math.floor(all_sec_10_percent/3600);
	if(Math.floor(hour_10_percent/10) == 0) hour_10_percent = "0"+hour_10_percent;
	let min_10_percent = Math.floor((all_sec_10_percent-(hour_10_percent*3600))/60);
	if(Math.floor(min_10_percent/10) == 0) min_10_percent = "0"+min_10_percent;
	let sec_10_percent = all_sec_10_percent - (hour_10_percent*3600) - (min_10_percent*60);
	if(Math.floor(sec_10_percent/10) == 0) sec_10_percent = "0"+sec_10_percent;
	
	return hour_10_percent+':'+min_10_percent+':'+sec_10_percent;
}

function mp4_name_without_ext(mp4_path){
	let MP4_NAME;
	let divider = '/'
	let is_slash = mp4_path.indexOf('/') > -1;
	let is_reverse_slash = mp4_path.indexOf('\\') > -1;
	if(is_reverse_slash) divider = '\\';
	if(is_slash || is_reverse_slash) {
		const path_arr = mp4_path.split(divider);
		MP4_NAME = path_arr[path_arr.length-1]
	} else{ MP4_NAME = mp4_path; }
	MP4_NAME = MP4_NAME.split('.')[0];
	return MP4_NAME;
}

function get_thumbnail_file_path(mp4_path){
	let mp4_name = mp4_name_without_ext(mp4_path);
	//let ext_index = mp4_path.lastIndexOf('.mp4');
	//let path_without_extension = mp4_path.slice(0,ext_index);
	let thumbnail_file_path = IMAGES_PATH+mp4_name+"_thumbnail.jpg";
	return thumbnail_file_path;
}
//@ ----------start ffmpeg.exe and get command to extract frame
function ffmpeg_get_frame(extract_query){
	return new Promise((resolve, reject)=>{
		let ffmpeg_exe;
		try{
			ffmpeg_exe = spawn(FFMPEG_PATH, extract_query);
		} catch(err){reject("ffmpeg_get_frame Eror:"+err)}
		let timelapse = 0;
		const chunks = [];
		let f1 = false, f2 = false;
		ffmpeg_wait_rewrite_query();
		ffmpeg_exe.stdout.on('data', (chunk)=>{
			timelapse = 0;
			chunks.push(chunk);
		})
		ffmpeg_exe.stderr.on('data', (chunk)=>{
			timelapse =0;
			chunks.push(chunk);
		});
		ffmpeg_exe.stdout.on('close', (code)=> {
			f1 = true;
			if(f1&&f2)resolve(true);
		});
		ffmpeg_exe.stderr.on('close', (code)=> {
			f2 = true;
			if(f1&&f2)resolve(true);
		});
		
		function ffmpeg_wait_rewrite_query(){
			if(timelapse<500) {
				timelapse = timelapse +50;
				setTimeout(()=>{
					ffmpeg_wait_rewrite_query()
					}, 50);
			}else{
				timelapse = 0;
				//console.log("---ffmpeg_talk_countdown(): recurse end:"+timelapse)
				const big_chunk = chunks.join('').toString();
				if(big_chunk.indexOf('already exists. Overwrite ? [y/N]')>-1){
					log("ffmpeg_wait_rewrite_query: file already exists - auto rewrite")
					ffmpeg_exe.stdin.write('y\r\n', 'utf8', ()=>{});
				} 
			}
		}
	});
}



