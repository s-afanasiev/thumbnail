//cb_test.js
const util = require('util')

FrameLimit(
	MemDb()
).run()

function FrameLimit(memDb){
	return {
		limit: undefined,
		run: function(parent){
			//@ initialization
			CallbackProps2(this, parent);
			memDb.run(this).onRes(res=>{
				console.log("frameLimit:", res);
				memDb.getLimit((err,limit)=>{
					console.log("frameLimit: limit =", limit)
					//@ returns 0 or more
					this.limit = limit;
					this.cbRes('ok');
				})
			})

			return this;
		},
		start: function(payload, cb){
			if(this.limit>20){
				return 
			}
			this.limit = this.limit + 1;
			extractFrame.run(this, payload).onRes(res=>{
				this.finish();
				cb(null, res)
			}).onErr(err=>{
				this.finish();
				cb(err);
			})
		},
		finish: function(payload){
			this.limit = this.limit - 1;
		}
	}
}

function MemDb(){
	return Object.assign(CallbackProps(),{
		limit: 0,
		run: function(parent){
			//CallbackProps2(this, parent);
			//this.cbRes("i am memDb");
			process.nextTick(()=>{this.cbRes("i am memDb")});
			return this;
		},
		getLimit: function(cb){
			cb(null, this.limit);
			//process.nextTick(()=>{cb(null, this.limit)});
		}
	})
}

function CallbackProps2(self, parent){
	self.cbRes = function(){if(parent) parent.cbRes(...arguments); 	},
	self.cbErr = function(){if(parent) parent.cbErr(...arguments); 	},
	self.cbEnd = function(){if(parent) parent.cbEnd(...arguments); 	},
	self.cbLog = function(){if(parent) parent.cbLog(...arguments); 	},
	self.cbDb  = function(){if(parent) parent.cbDb(...arguments); return this;	},
	self.onRes = function(cbRes){this.cbRes = cbRes; return this;	},
	self.onErr = function(cbErr){this.cbErr = cbErr; return this;	},
	self.onEnd = function(cbEnd){this.cbEnd = cbEnd; return this;	}
	self.onLog = function(cbLog){this.cbLog = cbLog; return this;	}
	self.onDb  = function(cbDb){this.cbDb = cbDb; return this;	}
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