//import MLR from "js/ml.min.js";

function trainmodel(){
	
	const xdata = trdata.time.map((_,i)=>[trdata.time[i],trdata.occ[i],trdata.speed[i],trdata.pvol[i]]);
	const ydata = trdata.pvol.map((_,i)=>[trdata.vol[i],trdata.vol[i]]);
	
	const regression = new ML.MultivariateLinearRegression(xdata, ydata);	
	
	const test = tsdata.time.map((_,i)=>[tsdata.time[i],tsdata.occ[i],tsdata.speed[i],tsdata.pvol[i]]);
	let result = [];
	for (let i=0; i<tsdata.time.length; i++){
		result.push([regression.predict(test[i])[0],(tsdata.vol[i]-regression.predict(test[i])[0])/tsdata.vol[i]]);
	}
	getData(result);	
}

function getData(result){
	const csvContent = "data:text/csv;charset=utf-8," + result.map(e => e.join(",")).join("\n");
	const encodedUri = encodeURI(csvContent);
	window.open(encodedUri);
}

function km(){
	let dvol = [];
	for (let i=1; i<trdata.vol.length; i++){
		dvol[i-1] = [0,(trdata.vol[i] - trdata.vol[i-1])/(trdata.time[i] - trdata.time[i-1])];
	}
	const result = ML.KMeans(dvol,5,{'initialization':'kmeans++'});
	let cntr = [];
	for (let i=0; i<result.centroids.length; i++){
		cntr[i] = result.centroids[i].centroid[1];
	}
	cntr.sort(function(a, b){return a - b});
	return cntr;
}

function predictKM(input){
	var cntr = km();
	var diff = 1000;
	var clstr = 0;
	for (var i=0; i<cntr.length; i++){
		if (Math.abs(input-cntr[i])<diff) {
			diff = Math.abs(input-cntr[i]);
			clstr = i+1;
		}
	}
	return {'cl#':clstr,'err':diff,'cntrs':cntr};
}