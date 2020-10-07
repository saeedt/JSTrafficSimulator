//window.onload = alert(localStorage.getItem("storageName"));
const data = JSON.parse(localStorage.getItem("result"));
var config = {
  toImageButtonOptions: {
    format: 'png', // one of png, svg, jpeg, webp
    filename: 'graph',
    height: 700,
    width: 1800,
    scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
  }
};
//console.log(data);
Plotly.newPlot('div1',[data[0],data[1]],{legend:{x:1,xanchor:'right',y:1.1,orientation:'h',font:{size:20}},title:{text:'Traffic Flow',font:{size:32}},xaxis:{title:{text:'Time (hour)',font:{size:24}},dtick:1},yaxis:{title:{text:'Flow (veh/hr)',font:{size:24}}}},config);
Plotly.newPlot('div2',[data[2]],{title:{text:'Downstream Speed',font:{size:32}},xaxis:{title:{text:'Time (hour)',font:{size:24}},dtick:1,},yaxis:{title:{text:'Speed (km/hr)',font:{size:24}}}},config);
Plotly.newPlot('div3',[data[3],data[4]],{legend:{x:1,xanchor:'right',y:1.1,orientation:'h',font:{size:20}},title:{text:'Green Phase Duration and Ramp Queue Length',font:{size:32}},xaxis:{title:{text:'Time (hour)',font:{size:24}},dtick:1,},yaxis:{title:{text:'Green Phase (s), Ramp Queue',font:{size:18}}}},config);
Plotly.newPlot('div4',[data[5]],{title:{text:'Downstream Occupancy',font:{size:32}},xaxis:{title:{text:'Time (hour)',font:{size:32}},dtick:1,},yaxis:{title:{text:'Occupancy (%)',font:{size:24}}}},config);
Plotly.newPlot('div5',[data[6]],{title:{text:'Ramp Meter Status',font:{size:32}},xaxis:{title:{text:'Time (hour)',font:{size:24}},dtick:1,},yaxis:{title:{text:'Status',font:{size:24}}}},config);
document.getElementById('div6').innerHTML=Object.entries(data[data.length-1]).join("\n");