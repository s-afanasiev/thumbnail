const arr = [{id:5},{id:6},{id:7},{id:8}]
arr.push({id:9})

function mapper(taskId){
	return arr.filter(task=> task.id != taskId);
}

const arr2 = mapper(5);
console.log("arr2=", arr2)
const shifted = arr2.shift();
console.log("shifted=", shifted)
console.log("arr2=", arr2)


const checkDiskSpace = require('./checkDiskSpace');
const DISK_LETTER = "C:";

checkDiskSpace(DISK_LETTER).then(res=>{
	//@ {"diskPath":"C:","free":2415955968,"size":109441970176}
	console.log("checkDiskSpace = "+JSON.stringify(res));
}).catch(err=>{
	console.log("checkDiskSpace error = "+err);
});