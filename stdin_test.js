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


let f = false;
let t = true;

//f?foo():undefined;
f?undefined:foo();
t?bar():undefined;
//t?undefined:bar();

function foo(){
	console.log("foo")
}

function bar(){
	console.log("bar")
}