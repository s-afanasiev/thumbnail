//@ 1. Получение информации о видеофайле: ffmpeg -i video.avi
//@ 3. Порезать видео на картинки: ffmpeg -i video.mpg image%d.jpg
//@ 3. Извлечь кадр с определенной секунды с указанным размером: 
//@ ffmpeg -ss 00:00:03 -i out.mp4 -frames: 1 -s 194x108 out1.jpg
//@ ffmpeg -r 1 -ss 00:00:10 -t 00:00:05 -i rx.mp4 -s 640x480 out1%d.jpg
const os = require('os');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const spawn = require('child_process').spawn;

const mysql = require("mysql");
const TTASK = "task";

const checkDiskSpace = require('./checkDiskSpace');
const DISK_LETTER = "C:";

const FFMPEG_PATH = __dirname+'/ffmpeg.exe';
const FFMPEG_LIMIT = 3;
let IMAGES_PATH = "./pic/";

let EXTERNAL_SOCKET = new EventEmitter();

const videous = ['h:/Downloads/[DevOps]2020/00_intro.mkv','h:/Downloads/[DevOps]2020/01_git.mkv','h:/Downloads/[DevOps]2020/02_dev_for_ops.mkv','h:/Downloads/[DevOps]2020/03_cicd.mkv','h:/Downloads/[DevOps]2020/05_IaC_part1.mkv','h:/Downloads/[DevOps]Specialist/KUBER 12.08.2020.mp4','h:/Downloads/[DevOps]Specialist/KUBER 13.08.2020.mp4','h:/Downloads/[DevOps]Specialist/KUBER 14.08.2020.mp4','h:/Downloads/[RxJS]2020/2020-05-30-0859.mp4','h:/Downloads/[RxJS]2020/2020-05-31-0859.mp4']
//const videous = ['./out.mp4','c:/Users/sea/Downloads/detect_simple_objects.mp4','c:/Users/sea/Downloads/VIDEO/stadion_1988.mp4','c:/Users/sea/Downloads/VIDEO/remont_kofewarki_Zelmer.mp4','c:/Users/sea/Downloads/VIDEO/Koloradskiy juk.mp4','c:/Users/sea/Downloads/s dnem rojdeniya.mp4','c:/Users/sea/Downloads/Raspoznavanie dorojnyh znakov part 1.mp4','c:/Users/sea/Downloads/Raspoznavanie dorojnyh znakov part 2.mp4','c:/Users/sea/Downloads/Raspoznavanie dorojnyh znakov part 3.mp4','./out.mp4']

//----IMPLEMENTATION----
main((err, res)=>{
	console.log("main err=", err);
	console.log("main res=", res);
});

//@ call outside like: fu(path_to_mp4, callback((err, res)=>{...}))
// -----------EXPORT---------------------
module.exports = function(mp4_path, cb){
	//TODO: parse mp4_path to divide FFMPEG_INPUT and FFMPEG_INPUT_PATH
	if(!mp4_path){
		const err = new Error('call fu(mp4_path, callback((err, res)=>{...}))')
		return cb(err);
	}
}
//---------------------------------------
//if(!module.parent){}
//---------------------------------------

function main(cb){
	App(
		ListeningSocket(
			EXTERNAL_SOCKET,
			Picturer(
				FrameProcessor(
					OldFrames(),
					FrameLimit(
						ExtractFrame_({own_tree: true}),
						MemDb()
					)
				)
			)
		),
		Db(),
		Logger()
	).run().onRes(res=>{cb(null, res)}).onErr(err=>{cb(err)});
	
	//@ TEST: send several test requests
	test_emitter(1);
}

//-----Test Emitter-----
function test_emitter(test_counter){
	let iteration_counter = 0;
	let iteration_interval = setInterval(()=>{
		if(++iteration_counter > test_counter){
			clearInterval(iteration_interval);
			setTimeout(()=>{console.log("test emitter end!")}, 5000)
		}
		const rand = Math.floor(Math.random() * 10);
		const idRand = Math.floor(Math.random() * 10000);
		EXTERNAL_SOCKET.emit('thumbnail_request', {request_id: idRand.toString(), mp4_path: videous[rand]})
	}, 300);
}


function App(listeningSocket, db, logger){
	return {
		listeningSocket: listeningSocket,
		db: db,
		logger: logger,
		run: function(){
			CallbackProps2(this, undefined);
			
			this.cbDb = function(msg, cb){
				console.log("App: catch cbDb from child:"+msg);
				this.db.query(msg, cb);
			}
			this.cbLog = function(msg){
				this.logger.log(msg);
			}
			console.log('App: calling logger');
			//@ start logger
			this.logger.run(this).onErr(err=>{ console.log("logger error:", err) });
			
			//@ start db
			this.db.run(this).onRes(res=>{
				this.cbLog("db was started"+res);
				//@ listening external socket
				this.listeningSocket.run(this).onErr(err=>{this.cbLog("App: listeningSocket Error:"+err)});
			});

			return this;
		},
		cbErr: function(err){
			console.log("App catch error:"+err);
		}
	}
}

function Db(){
	return {
		mysql_pool: undefined,
		run: function(parent){
			CallbackProps2(this, parent);
			start_db.call(this).then(mysql_pool=>{
				//console.log(">>>db: promise resolved");
				this.mysql_pool = mysql_pool;
				//@ все предыдущие операции были синхронны
				process.nextTick(()=>this.cbRes(true));
			}).catch(err=>{this.cbErr("Db.run Error: "+err)})
			return this;
		},
		query: function(args, cb){
			let query = abstract_query(args);
			this.cbLog("Db query = "+query);
			this.mysql_pool.query(query, (err, rows, fields)=>{
				if(err) return process.nextTick(()=>cb(err));
				return process.nextTick(()=>cb(null, {rows, fields}));
			});
		}
	}
	function abstract_query(msg){
		let q = "";
		if(msg.cmd == "c_story_task"){
			q += "INSERT INTO "+TTASK+" (request_id, mp4_path, status, add_time) VALUES ("+msg.request_id+", '"+msg.mp4_path+"', 'pending', now())";
		}
		else if(msg.cmd == "r_get_limit"){
			q += "SELECT COUNT(*) AS count FROM "+TTASK+" WHERE status = 'pending';"
		}
		else if(msg.cmd == "r_unfinished_tasks"){
			q += "SELECT id, request_id, mp4_path, status FROM "+TTASK+" WHERE status = 'pending' ORDER BY id;"
		}
		else if(msg.cmd == "r_next_pending_task"){
			q += "SELECT MIN(id) AS next_pending_id, request_id, mp4_path FROM task WHERE status = 'pending';"
		}
		else if(msg.cmd == "u_save_task_done"){
			//@ status can be: 1) "pending" 2) "done" 3) "error"
			q += "UPDATE "+TTASK+" SET status = 'done', done_time = now() WHERE request_id = '"+msg.request_id+"';"
		}
		else if(msg.cmd == "u_save_task_error"){
			q += "UPDATE "+TTASK+" SET status = 'error', done_time = now(), details = '"+msg.details+"' WHERE request_id = '"+msg.request_id+"';"
		}
		return q;
	}

	function start_db(){
		//@ 127.0.0.1,3306,root,rootpwd21<>,thumbnails_st
		const self = this;
		const 	DB_PORT = 3306,
			DB_HOST = "127.0.0.1",
			DB_USER = "root",
			DB_PASSWORD = "rootpwd21<>",
			DB_NAME = "thumbnails_st";
		return new Promise((resolve,reject)=>{
			var con;
			try{
				//@  connect MYSQL with the goal to create new Database if not exist
				con = mysql.createConnection({
					host: DB_HOST, port: DB_PORT, user : DB_USER, password: DB_PASSWORD
				});
			} catch(err){ reject("Starting DB ERROR: "+err) }
			//console.log(">>>db: connection created");
			con.connect((err)=>{
				if (err) return reject("DB connect Error:"+err);
				//console.log("Connected!");
				con.query("CREATE DATABASE IF NOT EXISTS "+DB_NAME+";", (err, result)=>{
					if (err) return reject("create db Error:"+err);
					self.cbLog("Database ok");
					//console.log(">>>db: database created");
					mysql_pool  = mysql.createPool({
						connectionLimit: 20,
						host: DB_HOST, port: DB_PORT, user : DB_USER,
						password: DB_PASSWORD, database: DB_NAME
					});
					//console.log(">>>db: pool created");
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
					
					mysql_pool.query(table_query, (err, result)=>{
						if (err) return resolve("create table Error:"+err);
						//console.log(">>>db: table created");
						this.cbLog("Table task ok");
						resolve(mysql_pool);
					});
				});
			});
		});
	}

}


function Logger(){
	return {
		is_ready: false,
		descriptor: undefined,
		run: function(){
			CallbackProps2(this, undefined);
			openFileDescriptor((err, descriptor)=>{
				this.descriptor = descriptor;
				this.is_ready = true;
				process.nextTick(()=>{this.cbRes(true)});
			});
			return this;
		},
		log: function(msg){
			if(this.descriptor){
				let date = new Date();
				let date_h = date.getHours();
				let date_m = date.getMinutes();
				let date_s = date.getSeconds();
				let date_ms = date.getMilliseconds();
				let date_hms = date_h+'-'+date_m+'-'+date_s+'-'+date_ms+':'
				this.descriptor.write(os.EOL+date_hms+msg+os.EOL);
			}else{
				console.log(">>>logger:", msg);
			}
		}
	}
	function openFileDescriptor(cb){
		var dir = './log_st';
		if (!fs.existsSync(dir)){
			fs.mkdirSync(dir);
		}
		let date_full = new Date();
		let date_h = date_full.getHours();
		let date_m = date_full.getMinutes();
		let date_s = date_full.getSeconds();
		let fname = path.normalize(dir+"/log_"+date_h+"-"+date_m+"-"+date_s+".txt");
		try{
			const fd_log = fs.createWriteStream(fname,{flags:'w'});//fs.openSync(fname, 'w');
			fd_log.write("logger ok");
			cb(null, fd_log);
		}catch(err){ cb(err) }
	}
}

function ListeningSocket(EXTERNAL_SOCKET, picturer){
	return {
		picturer: picturer,
		ext_socket: EXTERNAL_SOCKET,
		run: function(parent){
			CallbackProps2(this, parent);
			
			this.cbLog("listeningSocket: calling picturer");
			//@ Здесь RUN читай как INIT, а onRes как onInit
			this.picturer.run(this);
			this.picturer.onRes(res=>{
				this.cbLog("ListeningSocket: picturer answers:"+res);
				this.ext_socket.on('thumbnail_request', (msg)=>{
					this.cbLog("ListeningSocket: EXT_SOCKET request:"+JSON.stringify(msg));
					this.picturer.add(msg);
				})
			})
			this.picturer.onData(pic=>{
				//@ pic = {id, buffer}
				return this.ext_socket.emit('thumbnail_ok', pic);
			});
			this.picturer.onErr(err=>{
				return this.ext_socket.emit('thumbnail_error', err);
			});
			return this;
		}
	}
}

function Picturer(frameProcessor){
	return {
		frameProcessor: frameProcessor,
		run: function(parent){
			CallbackProps2(this, parent);

			this.frameProcessor.run(this);
			//@ сюда приходит сигнал о завершении извлечения кадра, его путь и ID !
			this.frameProcessor.onData(res=>{
				this.cbLog("Picturer: Data from frameProcessor!")
				//@ TODO: get pisture from FS and convert to Buffer
				const picPath = formThumbnailPathFromMp4Path(res.mp4_path);
				if(!picPath){return this.cbErr("frameProcessor.onFrame Error: no picPath "+picPath)}
				this.cbLog("Picturer: bufferingPictureFile()")
				bufferingPictureFile(picPath, (err, picBuf)=>{
					if(err){return this.cbErr("frameProcessor.onFrame Error:"+err)}
					process.nextTick(()=>{this.cbData(picBuf)});
				});
			});
			return this;
		}
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

	function formThumbnailPathFromMp4Path(mp4_path){
		let mp4_name = mp4_name_without_ext(mp4_path);
		let thumbnail_file_path = IMAGES_PATH+mp4_name+"_thumbnail.jpg";
		return thumbnail_file_path;
	}
	
	function bufferingPictureFile(picPath, cb){
		
		fs.access(picPath, fs.constants.R_OK, err => {
			if(err){ return log("no such file: "+picPath); }
			
			//@ if file Exists:		
			const readStream = fs.createReadStream(picPath);
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
				const buffer = Buffer.concat(chunks);
				cb(buffer);
			});
		});
	}
}

function FrameProcessor(oldFrames, frameLimit){
	return {
		oldFrames: oldFrames,
		frameLimit: frameLimit,
		isFrameLimitReady: false,
		
		run: function(parent){
			CallbackProps2(this, parent);
			//@ Вызывается один раз на Рестарте всего приложения
			this.oldFrames.run(this).onRes(unfinished=>{
				//@ здесь res равен массиву незавершенных задач из БД или []
				this.cbLog("FrameProcessor: "+unfinished.length+" unfinished tasks on App Restart");
				this.frameLimit.run(this).onRes(res=>{
					this.frameLimit.process_old(unfinished_tasks);
					this.isFrameLimitReady = true;
				});
				//@ сюда получаем сигнал о завершении извлечения кадра
				this.frameLimit.onData(res=>{
					this.cbData(res);
				});
			});
		},
		add: function(task){
			//@ Сервер пока не доступен, это всё ещё момент инициализации
			//@ По сути это нужно только для того, чтобы сначала пошли в работу незавершенные работы с прошлого старта системы.
			if(this.isFrameLimitReady) {
				this.frameLimit.add(task);
			}
		}
	}
}

function OldFrames(){
	return {
		run(parent){
			CallbackProps2(this, parent);
			const args = {cmd: "r_unfinished_tasks"};
			this.cbDb(args, (err, res)=>{
				if(err){
					console.log("OldFrames err:"+JSON.stringify(err));
					this.cbErr("OldFrames: db Error: "+err);
					//@ типа, несмотря на ошибку, продолжаем работать
					this.cbRes([]);
				}
				//@ CHECK
				this.cbRes(res.rows);
			});
			return this;
		}
	}
}

function FrameLimit(extractFrame, memDb){
	return {
		extractFrame: extractFrame,
		memDb: memDb,
		ffmpeg_units: [],
		run: function(parent){
			//@ initialization
			CallbackProps2(this, parent);
			this.cbLog("FrameLimit: calling memDb");
			this.memDb.run(this).onRes(res=>{
				//@ 1) ask Database about unfinished tasks.
				process.nextTick(()=>{this.cbRes(true)})
			})
			return this;
		},
		process_old: function(unfinished_tasks){
			let lim_ctr = 0;
			while(lim_ctr<=FFMPEG_LIMIT && lim_ctr<unfinished_tasks.length){
				this.start(unfinished_tasks[lim_ctr]);
				lim_ctr++;
			}
		},
		add: function(payload){
			this.memDb.storyTask(payload);
			this.cbLog("FrameLimit: add(): limit="+this.limit);
			//@ Если Лимит позволяет, то отправить задание на исполнение немедленно
			if(this.memDb.isAllowLimit()){
				this.start(payload);
			}
			//@ Case, when stack is overloaded
			else{
				//@ Do nothing
				this.cbLog("FrameLimit: max stack reached!");
			}
		},
		start: function(payload){
			this.cbLog("FrameLimit: start(): payload="+JSON.stringify(payload));
			//@ new instance of ffmpeg unit
			this.extractFrame = this.extractFrame.create();
			this.ffmpeg_units.push(this.extractFrame);
			//@ go extract thumbnail
			this.extractFrame.run(this, payload.path).onRes((res)=>{
				this.saveAndSearchNext(payload, {done:true, res:res.frameInfo});
			}).onErr(err=>{
				this.saveAndSearchNext(payload,{done:false, err:err});
			})
		},
		saveAndSearchNext: function(payload, resOrErr){
			//@ Sync: ask memDb about pending tasks to process them first. MemDb in turn should make two operations: a) decrement limit counter and return pending task or nothing(false)
			this.memDb.saveTask(payload.id, resOrErr.done);
			const pendingTask = this.memDb.nextPendingTask();
			if(pendingTask){ this.start(pendingTask); }
		}
	}
}

function MemDb(){
	return{
		limit: undefined,
		stack: undefined,
		run: function(parent){
			CallbackProps2(this, parent);
			this.stack = this.initStackOnAppRestart();
			this.limit = this.initLimitOnAppRestart();
			process.nextTick(()=>{this.cbRes('ok')})
			return this;
		},
		storyTask: function(payload){
			this.stack.push(payload);
			this.limit = this.limit + 1;
			const db_args = Object.assign(payload, {cmd:"c_story_task"});
			this.cbDb(db_args, (err, res)=>{
				
			});
		},
		isAllowLimit: function(){ return (this.limit<FFMPEG_LIMIT)?true:false; },
		//@ delete tasks with specified id
		nextPendingTask: function(taskId, isSuccess){
			//@ delete finished tasks
			this.stack = this.stack.filter(task=>task.id != taskId);
			//@ if: take first element of stack (fifo)
			if(this.stack.length>0){return this.stack.shift()}
			//@ else: decrement limit
			this.limit = this.limit - 1;
			return false;
		},
		curLimitSync: function(){ return this.limit; },
		curStackSync: function(){ return this.stack; },
		completeTaskInStack: function(){},
		//@ TODO: later we will query to DB for unfinished tasks and assign it to this memDb stack variable;
		initStackOnAppRestart: function(){ 
			this.db()
		},
		//@ TODO... its related with getStackOnAppRestart() function
		initLimitOnAppRestart: function(){ return 0; }
	}
}



//@ with own tree
function ExtractFrame_(){
	return ExtractFrame(
		ExtractFrameStream(
			FrameExtractQuery(
				FileInfoFramesAmount(
					FileInfoJSON(
						FileInfoArray(
							FileFullInfo(
								FileStreamInfo(FFMPEG_PATH)
							)
						)
					)
				)
			)
		)
	)
}

function ExtractFrame(extractFrameStream){
	const self = {};
	self.extractFrameStream = extractFrameStream;
	self.frameInfo = "";
	self.args = [...arguments];
	self.create = function(){ return ExtractFrame(...self.args); }
	//self.is_stream_end = false;
	self.run = function(parent, mp4_path){
		this.extractFrameStream = this.extractFrameStream.create();
		//@ we wait, from ffmpeg, two events about stdout and stderr ENDING
		CallbackProps2(this, parent);
		this.stdio_end_counter = 0;
		this.is_not_ffmpeg_done = true;
		console.log("frame extracting... ", mp4_path);
		this.extractFrameStream.run(this, mp4_path).onRes(res=>{
			this.frameInfo += res;
		}).onEnd(std=>{
			this.stdio_end_counter = this.stdio_end_counter + 1;
			console.log("this.stdio_end_counter =", this.stdio_end_counter);
			//@ Больше одного, значит должны закрыться stdout и stderr
			//@ А может быть сделать == 1, т.е. любой первый завершающий
			//if(this.stdio_end_counter > 1){
			if(this.stdio_end_counter > 1){
				//this.is_not_ffmpeg_done = false;
				this.cbLog('=====ffmpeg stdio closed====');
				//@ CHANGES v13: возвращаем этот объект, а не пересоздаваемый
				//this.cbRes(ExtractFrame(this.extractFrameStream));
				//@ TEST: искуственно задерживаем выполнение
				setTimeout(()=>{
					this.cbRes(this);
				},10000);
			}
		}).onErr(err=>{ this.cbErr(err); });
		return this;
	}
	return self;
}

function ExtractFrameStream(frameExtractQuery){
	const self = {};
	self.frameExtractQuery = frameExtractQuery;
	self.args = [...arguments];
	self.create = function(){ return ExtractFrameStream(...self.args); }
	self.flag_against_double_end = true;
	self.run = function(parent, mp4_path){
		this.frameExtractQuery = this.frameExtractQuery.create();
		CallbackProps2(this, parent);
		this.cbLog("ExtractFrameStream: run():"+mp4_path);
		this.frameExtractQuery.run(this, mp4_path).onRes(query=>{
			this.frameExtractQuery = query;
			this.ffmpeg_exe = spawn(FFMPEG_PATH, this.frameExtractQuery.result);
			this.chunks = [];
			this.timelapse = 0;
			
			//@we both the same time listen ffmpeg and keep an eye out if he suddenly stops talking. When we suppose, it probably ask us for rewriting an exiting file and we say him to rewrite
			ffmpeg_talk_countdown(this);
			
			this.ffmpeg_exe.stdout.on('data', (chunk)=>{
				//@ если не было запроса на перезапись файла, то скорее всего поток будет литься сюда в stdout
				this.timelapse = 0;
				this.chunks.push(chunk);
				//console.log("-----STDOUT:"+chunk.toString());
			})
			this.ffmpeg_exe.stderr.on('data', (chunk)=>{
				//@ если уже был запрос на перезапись файла и мы ответили 'y', то сокрее всего остаток информации будет лить сюда в stderr
				this.timelapse =0;
				this.chunks.push(chunk);
			});
			this.ffmpeg_exe.stdout.on('close', (code)=> {
				console.log('---stdout close event');
				//this.ffmpeg_exe.stdout.removeAllListeners();
				this.cbEnd('stdout');
				//setTimeout(()=>{ this.cbEnd('stdout') }, 0)
				//process.nextTick(()=>{this.cbEnd('stdout')});
			});
			this.ffmpeg_exe.stderr.on('close', (code)=> {
				console.log('---stderr close event');
				//this.ffmpeg_exe.stderr.removeAllListeners();
				this.cbEnd('stderr');
				//setTimeout(()=>{ this.cbEnd('stderr') }, 0)
				//process.nextTick(()=>{this.cbEnd('stderr')});
			});
		}).onErr(err=>{this.cbErr(err)});
		
		return this;
	}
	
	
	function ffmpeg_talk_countdown(EFS){
		//console.log('---ffmpeg_talk_countdown()'+this.timelapse)
		if(EFS.timelapse<500) {
			EFS.timelapse = EFS.timelapse +50;
			setTimeout(()=>{ffmpeg_talk_countdown(EFS)}, 50);
		}else{
			if(EFS.flag_against_double_end){
				EFS.flag_against_double_end = false;
				EFS.timelapse = 0;
				console.log("---ffmpeg_talk_countdown(): recurse end:"+EFS.timelapse)
				const big_chunk = EFS.chunks.join('').toString();
				if(big_chunk.indexOf('already exists. Overwrite ? [y/N]')>-1){
					//console.log("---already exists: "+typeof this.ffmpeg_exe.stdin.end)
					EFS.ffmpeg_exe.stdin.write('y\r\n', 'utf8', ()=>{});
				} 
			}
		}
	}
	function bin_maybe_need(){
		/*
		//@ this is snippet for interaction with user by command line
		process.stdin.setEncoding('utf8');
		process.stdin.on('readable', (nothing) => {
			let chunk;
			while (null !== (chunk = process.stdin.read())) {
				console.log(`Read ${chunk.length} bytes of data.`);
			}
			process.stdin.removeAllListeners('readable');
		});
		*/
	}
	
	return self;
}

function FrameExtractQuery(fileInfoFramesAmount){
	return {
		args: [...arguments],
		create: function(){ return FrameExtractQuery(...this.args); },
		fileInfoFramesAmount: fileInfoFramesAmount,
		result: [],
		run: function(parent, mp4_path){
			this.fileInfoFramesAmount = this.fileInfoFramesAmount.create();
			CallbackProps2(this, parent);
			this.cbLog("FrameExtractQuery: run()")
			this.fileInfoFramesAmount.run(this, mp4_path).onRes(res=>{
				const thumbnail_out_file_path = mp4_name_without_ext(mp4_path);
				let time_start_str = "00:00:00";
				if(res.is_more_10_frames){
					//@ return 10% frame
					const time_start_str = calculate_time(res);
				}
				this.result.push("-i", mp4_path, "-ss", time_start_str, "-frames:", "1", "-s", "194x108", thumbnail_out_file_path)
				
				//this.cbRes(FrameExtractQuery({result:self.resultNext}, this.fileInfoFramesAmount))
				this.cbRes(this);
			});
			
			return this;
		}
	}
	//------------------------------------
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
	//------------------------------------
}


function FrameExtractQueryWorther(mut, fileInfoFramesAmount){
	const self = {};
	self.args = [...arguments];
	self.create = function(){ return FrameExtractQuery(...self.args); }
	self.fileInfoFramesAmount = fileInfoFramesAmount;
	if(mut){
		if(mut.result){
			self.result = mut.result;
		}
	}
	self.resultNext = [];
	self.run = function(parent, mp4_path){
		this.fileInfoFramesAmount = this.fileInfoFramesAmount.create();
		CallbackProps2(this, parent);
		this.cbLog("FrameExtractQuery: run()")
		this.fileInfoFramesAmount.run(this, mp4_path).onRes(res=>{
			const MP4_NAME = mp4_name_without_ext(mp4_path);
			let time_start_str = "00:00:00";
			if(res.is_more_10_frames){
				//@ return 10% frame
				const time_start_str = calculate_time(res);
			}
			self.resultNext.push("-i", mp4_path, "-ss", time_start_str, "-frames:", "1", "-s", "194x108", MP4_NAME+"_thumbnail.jpg")
			
			this.cbRes(FrameExtractQuery({result:self.resultNext}, this.fileInfoFramesAmount))
		}).onErr(err=>{this.cbErr(err)})
		
		return this;
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
	
	//------------------------------------
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
	//------------------------------------
	return self;
}

function FileInfoFramesAmount(fileInfoJson){
	const self = {};
	self.args = [...arguments];
	self.create = function(){ return FileInfoFramesAmount(...self.args); }
	self.fileInfoJson = fileInfoJson;
	self.run = function(parent, mp4_path){
		this.fileInfoJson = this.fileInfoJson.create();
		CallbackProps2(this, parent);
		this.cbLog("FileInfoFramesAmount: run()");
		this.fileInfoJson.run(this, mp4_path).onRes(res=>{
			if(!res) return cbErr('FramesLot: no res')
			if(!res.duration) return cbErr('FramesLot: no res.duration')
			if(!res.fps) return cbErr('FramesLot: no res.fps')
			const dur = res.duration;
			if(dur.hour == 0 && dur.min == 0 && dur.sec == 0) {res.is_more_10_frames = false}
			else {res.is_more_10_frames = true}
			this.result = res;
			return this.cbRes(res);
		}).onErr(err=>{this.cbErr(err)});
		return this;
	}
	return self;
}

function FileInfoJSON(fileInfoArray){
	const self = {};
	self.args = [...arguments];
	self.create = function(){ return FileInfoJSON(...self.args); }
	self.fileInfoArray = fileInfoArray,
	self.run = function(parent, mp4_path){
		this.fileInfoArray = this.fileInfoArray.create();
		CallbackProps2(this, parent);
		this.cbLog("FileInfoJSON: run()");
		this.fileInfoArray.run(this, mp4_path).onRes(res=>{
			this.self = MainRes(
				DurationAndBitrate(
					DurationString(res)
				),
				ResolutionAndFps(
					StreamString(res)
				)
			)
			process.nextTick(()=>{this.cbRes(this.self);});
		}).onErr(err=>{ this.cbErr(err) })
		return this;
	}
	self.getRes = function(){ return this.self; }
	return self;

	function MainRes(durationAndBitrate, resolutionAndFps){
		return Object.assign(durationAndBitrate, resolutionAndFps)
	}
	function DurationAndBitrate(durationString){
		console.log("durationString ="+durationString)
		const res = {};
		//@ durationString = "Duration: 00:00:05:17, start: 0.00000, bitrate: 188 kb/s"
		const durationArr = durationString.split(',').map(el=>el.trim());

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

function FileInfoArray(m_fileFullInfo){
	const self = {};
	self.args = [...arguments];
	self.create = function(){ return FileInfoArray(...self.args); }
	self.m_fileFullInfo = m_fileFullInfo;
	
	self.run = function(parent, mp4_path){
		this.m_fileFullInfo = this.m_fileFullInfo.create();
		CallbackProps2(this, parent);
		this.cbLog("FileInfoArray: run()");
		this.m_fileFullInfo.run(this, mp4_path).onRes(m_obj=>{
			this.m_fileFullInfo = m_obj;
			const res = this.m_fileFullInfo.result.split(os.EOL).map(el=> el.trim());
			return this.cbRes(res);
		}).onErr(err=>{ this.cbErr(err); });
		return this;
	}
	return self;
}

function FileFullInfo(fileStreamInfo){
	//console.log("now in FileInfo", arguments)
	return {
		args: [...arguments],
		create: function(){ return M_FileFullInfo(...self.args); },
		fileStreamInfo: fileStreamInfo,
		isDataEmpty: true,
		result: "",
		run: function(parent, mp4_path){
			this.fileStreamInfo = this.fileStreamInfo.create();
			CallbackProps2(this, parent);
			this.cbLog("M_FileFullInfo: run()");
			this.fileStreamInfo.run(this, mp4_path).onRes(res=>{
				this.result += res;
			}).onEnd(res=>{
				//@ Отдаём накопленные данные
				if(this.isDataEmpty) {
					//@ Чтобы не передавать дважды
					this.isDataEmpty = false;
					this.cbRes(this);
				}
			}).onErr(err=>{ this.cbErr(err); });
			return this;
		}
	}
}

//@ Накапливает инфу из FileStreamInfo в одну пачку
function M_FileFullInfo(mut, fileStreamInfo){
	//console.log("now in FileInfo", arguments)
	let self = {};
	self.args = [...arguments];
	self.create = function(){ return M_FileFullInfo(...self.args); }
	self.fileStreamInfo = fileStreamInfo;
	if(mut) { 
		self.result = mut.result;
	}
	self.isDataEmpty = true;

	self.next_result = "";

	//@ У НАС БУДУТ ДЕФОЛТНЫЕ ЗНАЧЕНИЕ, КОТОРЫЕ БУДУТ СБРАСЫВАТЬСЯ В ДЕФОЛТ, ЕСЛИ ИНОЕ НЕ УКАЗАНО ЯВНО В ПАРАМЕТРЕ MUT КОНСТРУКТОРА!
	self.run = function(parent, mp4_path){
		this.fileStreamInfo = this.fileStreamInfo.create();
		CallbackProps2(this, parent);
		this.cbLog("M_FileFullInfo: run()");
		this.fileStreamInfo.run(this, mp4_path).onRes(res=>{
			this.next_result += res;
		}).onEnd(res=>{
			//@ Отдаём накопленные данные
			if(this.isDataEmpty) {
				//@ Чтобы не передавать дважды
				this.isDataEmpty = false;
				//@ НА РЕЗУЛЬТАТЕ ВОЗВРАЩАЕМ КОПИЮ ОБЪЕКТА С ИЗМЕНЕННЫМ СОСТОЯНИЕМ И РЕЗУЛЬТАТОМ
				process.nextTick(()=>{
					this.cbRes(M_FileFullInfo({result: this.next_result}, this.fileStreamInfo));
				});
			}
		}).onErr(err=>{ this.cbErr(err); });
		return this;
	};
	
	return self;
}

//@ отдаёт в Колбэк данные частями, также как и получает через spawn
function FileStreamInfo(ffmpegModule){
	let self = {};
	self.args = [...arguments];
	self.create = function(){ return FileStreamInfo(...self.args); }
	//@ 1. incapsulate
	self.ffmpegModule = ffmpegModule;

	self.run = function(parent, mp4_path){
		CallbackProps2(this, parent);
		this.cbLog("FileStreamInfo: run()");
		self.params = ['-i', mp4_path];

		this.ffmpeg_exe = spawn(this.ffmpegModule, self.params);
		//@ listen data on 'stdout' stream
		this.ffmpeg_exe.stdout.on('data', (chunk)=>{
			this.cbRes(chunk.toString('utf8'));
		})
		//@ listen data on 'stderr' stream
		this.ffmpeg_exe.stderr.on('data', (chunk)=>{
			this.cbRes(chunk.toString('utf8'));
		});
		this.ffmpeg_exe.stdout.on('close', (code)=> {
			this.ffmpeg_exe.stdout.removeAllListeners();
			this.cbEnd('stdout')
			this.cbLog('closing stdout on file:' + mp4_path)
		});
		this.ffmpeg_exe.stderr.on('close', (code)=> {
			this.ffmpeg_exe.stderr.removeAllListeners();
			this.cbEnd('stderr');
			this.cbLog('closing stderr on file:' + mp4_path)
		})
		
		return this;
	};
	
	
	return self;
}




function CallbackProps(){
	return {
		cbRes: function(){},
		cbErr: function(){},
		cbEnd: function(){},
		onRes: function(cbRes){	this.cbRes = cbRes; return this;	},
		onErr: function(cbErr){	this.cbErr = cbErr; return this;	},
		onEnd: function(cbEnd){	this.cbEnd = cbEnd; return this;	}
	}
}

function CallbackProps2(self, parent){
	self.cbRes = function(){if(parent) parent.cbRes(...arguments); 	},
	self.cbErr = function(){if(parent) parent.cbErr(...arguments); 	},
	self.cbData = function(){if(parent) parent.cbData(...arguments); 	},
	self.cbEnd = function(){if(parent) parent.cbEnd(...arguments); 	},
	self.cbLog = function(){if(parent) parent.cbLog(...arguments); 	},
	self.cbDb  = function(){if(parent) parent.cbDb(...arguments); return this;	},
	self.onRes = function(fun){this.cbRes = fun; return this;	},
	self.onErr = function(fun){this.cbErr = fun; return this;	},
	self.onData = function(fun){this.cbData = fun; return this;	},
	self.onEnd = function(fun){this.cbEnd = fun; return this;	}
	self.onLog = function(fun){this.cbLog = fun; return this;	}
	self.onDb  = function(fun){this.cbDb = fun; return this;	}
}