/* Creating reproducible versions for debugging purposes:

(1) include <script src="js/seedrandom.min.js"></script> in html file
    (from https://github.com/davidbau/seedrandom, copied locally)

(2) apply Math.seedrandom(42) or Math.seedrandom("hello") or similar
    in all files containing Math.random commands
    => at present, only road.js

!! only use inside functions/methods, e.g., in road constructor;
  otherwise, DOS in some browsers at first, but not subsequent, calls (stop-start)

console.log(Math.random());          // Always 0.0016341939679719736 with 42
console.log(Math.random());          // Always 0.9364577392619949 with 42
 Math.seedrandom(42);                // undo side effects of console commands
*/

// following in control_gui.js; call bash/eng2ger.bash to propagate it to ger
//function formd0(x){return parseFloat(x).toFixed(0);}
//function formd(x){return parseFloat(x).toFixed(2);}

var userCanDistortRoads=false;
var userCanDropObjects=false;

nLanesMin=1;
nLanesMax=4;

//#############################################################
// adapt standard IDM and MOBIL model parameters from control_gui.js
// since no sliders for that.
// Values are distributed in updateModels() => truck model derivatives
// and (as deep copies) in road.updateModelsOfAllVehicles
//#############################################################

IDM_T=1.4;
IDM_a=1;
IDM_b=2.5; // low for more anticipation
IDM_s0=2;
speedL=88.51/3.6; //55mph = 88.51 km/h
speedL_truck=88.51/3.6;

MOBIL_bBiasRigh_car=0.1;
MOBIL_bBiasRight_truck=8;
MOBIL_mandat_bSafe=18;
MOBIL_mandat_bThr=0.5;   // >0
MOBIL_mandat_bias=1.5;

MOBIL_bSafe=5;
MOBIL_bSafeMax=17;

//############################################
// run-time specification and functions
//############################################

var time=25200; //start time, set to 7:00 AM
var itime=0;
const fps=150; // frames per second (unchanged during runtime): dtermines how fast the simulation is updated
timeStep = 3;
var dt=timeStep;
const endTime = 28800; //8:00 AM
const reportInt = 60; //report aggregation interval
var dataIndex = 0;
var detIndex = 0;
const iDet = 1; //detector id used for light control
const ALINEA_RM = true; //Enable ALINEA ramp metering
const PROP_RM = false; //Enable proposed ramp metering
const flow_mltpr = 24.0;

//#############################################################
// initialize sliders differently from standard
//  (qIn etc defined in control_gui.js)
//#############################################################

density=0; // Determines initial number of cars on the road density per lane (0.02)

IDM_v0=88.51/3.6; //converts km/h to m/s: 1000/6300 = 1/3.6
slider_IDM_v0.value=3.6*IDM_v0;
slider_IDM_v0Val.innerHTML=3.6*IDM_v0+" km/h";

let mainFlow = data.totalflow[dataIndex]-data.rampflow[dataIndex];
mainFlow = (mainFlow>0) ? mainFlow : 0;
qIn=mainFlow*flow_mltpr/3600.; // inflow 4400./3600; convers flow per hour to flow per second
slider_qIn.value=3600*qIn;
slider_qInVal.innerHTML=formd0(3600*qIn)+" V/h";

fracTruck=0.06;
slider_fracTruck.value=100*fracTruck;
slider_fracTruckVal.innerHTML=100*fracTruck+"%";

qOn=data.rampflow[dataIndex]*flow_mltpr/3600.; //total onramp flow of onramp scenario
if(!(typeof uOffset === 'undefined')){
  slider_qOn.value=3600*qOn;
  slider_qOnVal.innerHTML=formd0(3600*qOn)+" V/h";
}

/*######################################################
 Global overall scenario settings and graphics objects

 refSizePhys  => reference size in m (generally smaller side of canvas)
 refSizePix   => reference size in pixel (generally smaller side of canvas)
 scale = refSizePix/refSizePhys
       => roads have full canvas regardless of refSizePhys, refSizePix

 (1) refSizePix=Math.min(canvas.width, canvas.height) determined during run

 (2) refSizePhys smaller  => all phys roadlengths smaller
  => vehicles and road widths appear bigger for a given screen size
  => chose smaller for mobile,

  Example: refSizePhys propto sqrt(refSizePix) => roads get more compact
  and vehicles get smaller, both on a sqrt basis

  Or jump at trigger refSizePix<canvasSizeCrit propto clientSize
  => css cntrl normal/mobile with 2 fixed settings

  NOTICE: canvas has strange initialization of width=300 in firefox
  and DOS when try sizing in css (see there) only

  document.getElementById("contents").clientWidth; .clientHeight;

  always works!

######################################################*
*/


var scenarioString="OnRamp_BaWue";
console.log("\n\nstart main: scenarioString=",scenarioString);


var simDivWindow=document.getElementById("contents");
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d"); // graphics context
canvas.width  = simDivWindow.clientWidth;
canvas.height  = simDivWindow.clientHeight;
var aspectRatio=canvas.width/canvas.height;


console.log("before addTouchListeners()");
addTouchListeners();
console.log("after addTouchListeners()");


//##################################################################
// overall scaling (critAspectRatio should be consistent with
// width/height in css.#contents)
//##################################################################

var isSmartphone=false;
var critAspectRatio=16./9.; // optimized for 16:9 corresp. css.#contents
var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);


//##################################################################
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updateDimensions();
//##################################################################

var mainroadLen=1000; //!!


// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.47;
var center_yRel=-0.505;
var arcRadiusRel=0.36;
var rampLenRel=1.80;


// constant  refSizePhys calculated by requirement fixed mainroadLen!!

var refSizePhys=mainroadLen/(Math.PI*arcRadiusRel
			     +2*(critAspectRatio-center_xRel));
var scale=refSizePix/refSizePhys;

var center_xPhys, center_yPhys;
var arcRadius, arcLen, straightLen;
var rampLen, mergeLen, mainRampOffset, taperLen, rampRadius;

updateDimensions();

// the following remains constant
// => road becomes more compact for smaller screens

var laneWidth=7; // remains constant => road becomes more compact for smaller
var nLanes_main=2;
var nLanes_rmp=1;


var car_length=7; // car length in m: 7m deafult
var car_width=5; // car width in m
var truck_length=15; // trucks: 15m deafault
var truck_width=7;
//min distance is set to 15m (see line 2935 in road.js)

function updateDimensions(){ // if viewport or sizePhys changed
  center_xPhys=center_xRel*refSizePhys; //[m]
  center_yPhys=center_yRel*refSizePhys;

  arcRadius=arcRadiusRel*refSizePhys;
  arcLen=arcRadius*Math.PI;
  straightLen=refSizePhys*critAspectRatio-center_xPhys;

  rampLen=rampLenRel*refSizePhys;
  mergeLen=0.3*rampLen; //Changed this from .4 to .3 to shorten the ramp
  mainRampOffset=mainroadLen-straightLen+mergeLen-rampLen+0.4*straightLen;
  taperLen=50;
  rampRadius=4*arcRadius;
  console.log("calculated mainroadLen=",arcLen+2*straightLen);
  console.log("calculated rampLen=",rampLen);
}



// on constructing road, road elements are gridded and internal
// road.traj_xy(u) are generated if doGridding=true (here false). If true,
// traj_xy*(u) obsolete ??!!!

function traj_x(u){ // physical coordinates
        var dxPhysFromCenter= // left side (median), phys coordinates
	    (u<straightLen) ? straightLen-u
	  : (u>straightLen+arcLen) ? u-mainroadLen+straightLen
	  : -arcRadius*Math.sin((u-straightLen)/arcRadius);
	return center_xPhys+dxPhysFromCenter;
}

function traj_y(u){ // physical coordinates
        var dyPhysFromCenter=
 	    (u<straightLen) ? arcRadius
	  : (u>straightLen+arcLen) ? -arcRadius
	  : arcRadius*Math.cos((u-straightLen)/arcRadius);
	return center_yPhys+dyPhysFromCenter;
}


// heading of onramp (0: towards positive x, pi/2 = towards positive y)
// in logical onramp longitudinal coordinates
// linear change of heading between the pivot points

// NOTICE: in defining dependent geometry,
// do not refer to mainroad or onramp!! may not be defined:
// mainroad.nLanes => nLanes_main, ramp.nLanes=>nLanes_ramp1!!

function headingRamp(u){

  var um1=0; var headingm1=0.2; // heading at ramp begin
  var u0=0.3*(rampLen-mergeLen); var heading0=0;
  var u1=0.4*(rampLen-mergeLen); var heading1=0;
  var u2=0.5*(rampLen-mergeLen); var heading2=0.0; // 0.2;
  var u3=0.55*(rampLen-mergeLen); var heading3=0;
  var u4=0.6*(rampLen-mergeLen); var heading4=0;
  var u5=0.8*(rampLen-mergeLen); var heading5=0.25;
  var u6=1.0*rampLen-mergeLen; var heading6=0;
  var u7=rampLen-taperLen; var heading7=0;
  var u8=rampLen-0.5*taperLen; var heading8=2*nLanes_rmp*laneWidth/taperLen;
  var u9=rampLen; var heading9=0;
  var heading= (u<u0) ? headingm1 + (u-um1)/(u0-um1)*(heading0-headingm1) :
    (u<u1) ? heading0 + (u-u0)/(u1-u0)*(heading1-heading0) :
    (u<u2) ? heading1 + (u-u1)/(u2-u1)*(heading2-heading1) :
    (u<u3) ? heading2 + (u-u2)/(u3-u2)*(heading3-heading2) :
    (u<u4) ? heading3 + (u-u3)/(u4-u3)*(heading4-heading3) :
    (u<u5) ? heading4 + (u-u4)/(u5-u4)*(heading5-heading4) :
    (u<u6) ? heading5 + (u-u5)/(u6-u5)*(heading6-heading5) :
    (u<u7) ? heading6 + (u-u6)/(u7-u6)*(heading7-heading6) :
    (u<u8) ? heading7 + (u-u7)/(u8-u7)*(heading8-heading7)
    : heading8 + (u-u8)/(u9-u8)*(heading9-heading8);
  return heading;
}

// construct ramp x/y arrays in physical space
//!!! assuming for the moment mainroad heading=0 @ merge!

var nArrRamp=100;
var drampLen=rampLen/(nArrRamp-1);
var xRamp=[];
var yRamp=[];

// updates array variables if new geometry, changed viewport size etc

function updateRampGeometry(){

  // crucial: correct x/y attachment at begin of merge
  // (assume heading=0 @ merge for the moment)

  xRamp[nArrRamp-1]=traj_x(mainRampOffset+rampLen-mergeLen)+mergeLen;
  yRamp[nArrRamp-1]=traj_y(mainRampOffset+rampLen-mergeLen)
    -0.5*laneWidth*(nLanes_main-nLanes_rmp);

  for(var i=nArrRamp-2; i>=0; i--){
    var u=drampLen*(i+0.5);
    xRamp[i]=xRamp[i+1]-drampLen*Math.cos(headingRamp(u));
    yRamp[i]=yRamp[i+1]-drampLen*Math.sin(headingRamp(u));
  }

  //!!! necessary, since roads internal tables!

  ramp.gridTrajectories(trajRamp_x,trajRamp_y);
  //console.log("in updateRampGeometry: nLanes_main=",nLanes_main,
//	      " trajRamp_y(rampLen-50)=",formd(trajRamp_y(rampLen-50))
//	     );

}


function trajRamp_x(u){ // physical coordinates
  var idouble=u/drampLen;
  var il=Math.max(0,Math.floor(idouble));
  var iu=Math.min(nArrRamp-1,il+1);
  return xRamp[il]+(idouble-il)*(xRamp[iu]-xRamp[il]);
}

function trajRamp_y(u){ // physical coordinates
  var idouble=u/drampLen;
  var il=Math.max(0,Math.floor(idouble));
  var iu=Math.min(nArrRamp-1,il+1);
  return yRamp[il]+(idouble-il)*(yRamp[iu]-yRamp[il]);
}


//##################################################################
// Specification of logical road
//##################################################################

var isRing=false;  // 0: false; 1: true
var roadIDmain=1;
var roadIDramp=2;

var fracTruckToleratedMismatch=1.0; // 100% allowed=>changes only by sources

var speedInit=20; // IC for speed

// last arg = doGridding (true: user can change road geometry)

var mainroad=new road(roadIDmain,mainroadLen,laneWidth,nLanes_main,
		      traj_x,traj_y,
		      density,speedInit,fracTruck,isRing,userCanDistortRoads);

var ramp=new road(roadIDramp,rampLen,laneWidth,nLanes_rmp,
		    trajRamp_x,trajRamp_y,
		  density, speedInit, fracTruck,isRing,userCanDistortRoads);
network[0]=mainroad;  // network declared in canvas_gui.js
network[1]=ramp;

updateRampGeometry(); //!! needed since ramp geometry depends on mainroad

// add standing virtual vehicle at the end of ramp (1 lane)
// prepending=unshift (strange name)

var virtualStandingVeh=new vehicle(2, laneWidth, ramp.roadLen-0.9*taperLen, 0, 0, "obstacle");

ramp.veh.unshift(virtualStandingVeh);

// introduce stationary detectors

var nDet=2;
var detectors=[];
detectors[0]=new stationaryDetector(mainroad,0.68*mainroadLen,reportInt);
//detectors[1]=new stationaryDetector(mainroad,0.60*mainroadLen,10);
detectors[1]=new stationaryDetector(mainroad,0.96*mainroadLen,reportInt);


//#########################################################
// model initialization (models and methods defined in control_gui.js)
//#########################################################

updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory


//####################################################################
// Global graphics specification
//####################################################################

var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip; // true only if user-driven geometry changes

var drawColormap=false;
var vmin_col=0; // min speed for speed colormap (drawn in red)
var vmax_col=100/3.6; // max speed for speed colormap (drawn in blue-violet)


//####################################################################
// Images
//####################################################################


// init background image

var background = new Image();
background.src ='figs/backgroundGrass.jpg';


// init vehicle image(s)

carImg = new Image();
carImg.src = 'figs/blackCarCropped.gif';
truckImg = new Image();
truckImg.src = 'figs/truck1Small.png';


// init traffic light images

traffLightRedImg = new Image();
traffLightRedImg.src='figs/trafficLightRed_affine.png';
traffLightGreenImg = new Image();
traffLightGreenImg.src='figs/trafficLightGreen_affine.png';


// define obstacle image names

obstacleImgNames = []; // srcFiles[0]='figs/obstacleImg.png'
obstacleImgs = []; // srcFiles[0]='figs/obstacleImg.png'
for (var i=0; i<10; i++){
  obstacleImgs[i]=new Image();
  obstacleImgs[i].src = (i==0)
    ? "figs/obstacleImg.png"
    : "figs/constructionVeh"+(i)+".png";
  obstacleImgNames[i] = obstacleImgs[i].src;
}


// init road images

roadImgs1 = []; // road with lane separating line
roadImgs2 = []; // road without lane separating line

for (var i=0; i<4; i++){
    roadImgs1[i]=new Image();
    roadImgs1[i].src="figs/road"+(i+1)+"lanesCropWith.png"
    roadImgs2[i]=new Image();
    roadImgs2[i].src="figs/road"+(i+1)+"lanesCropWithout.png"
}

roadImg1 = new Image();
roadImg1=roadImgs1[nLanes_main-1];
roadImg2 = new Image();
roadImg2=roadImgs2[nLanes_main-1];

rampImg = new Image();
rampImg=roadImgs1[nLanes_rmp-1];



//############################################
// traffic objects
//############################################

// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
var trafficObjs=new TrafficObjects(canvas,1,0,0.50,0.72,1,1);
var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.5,0.5);

var rampMeterLight=trafficObjs.trafficObj[0];
//activate(trafficObject,road,u) or activate(trafficObject,road)
trafficObjs.activate(rampMeterLight,ramp,rampLen-mergeLen-80);

var gk = 40; //green phase duaration in seconds
var lightStatus = [[],[]];

//#################################################################
function updateSim(){
//#################################################################

    // (1) update times

  time +=dt; // dt depends on timewarp slider (fps=const)
  itime++;

  //onramp and main flows from the data file
  if (dataIndex+1 < data.time.length){
    if (time >= data.time[dataIndex+1]){
      dataIndex++;
    }
  }
  qOn = data.rampflow[dataIndex]*flow_mltpr/3600.;
  let mainFlow = data.totalflow[dataIndex]-data.rampflow[dataIndex];
  mainFlow = (mainFlow>0) ? mainFlow : 0;
  qIn = mainFlow*flow_mltpr/3600.; // inflow 4400./3600; convers flow per hour to flow per second
  slider_qIn.value=3600*qIn;
  slider_qInVal.innerHTML=formd0(3600*qIn)+" V/h";

    // (2) transfer effects from slider interaction and mandatory regions
    // to the vehicles and models




  updateRampGeometry();

  mainroad.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
  mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);

  ramp.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
  ramp.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);


  // (2a) update moveable speed limits

  for(let i=0; i<network.length; i++){
    network[i].updateSpeedlimits(trafficObjs);
  }

  // (2b) programmatic control upstream secondary network

  //switchingSchemeTLup(depot.obstTL[0],qOn,time); // with explicit TL
  /*qOn=externalOnrampDemand(time);*/                  // implicit flow control

  // (2c) programmatic control downstream ramp meter TL

  // (2d) externally impose mandatory LC behaviour
  // all ramp vehicles must change lanes to the left (last arg=false)

  ramp.setLCMandatory(0, ramp.roadLen, false);


    // (3) do central simulation update of vehicles

    mainroad.updateLastLCtimes(dt);
    mainroad.calcAccelerations();
    mainroad.changeLanes();
    mainroad.updateSpeedPositions();
    mainroad.updateBCdown();
    mainroad.updateBCup(qIn,dt); // argument=total inflow

    for (let i=0; i<mainroad.nveh; i++){
    	if(mainroad.veh[i].speed<0){
    	    console.log(" speed "+mainroad.veh[i].speed
    			    +" of mainroad vehicle "
    			    +i+" is negative!");
    	}
    }

    ramp.calcAccelerations();
    ramp.updateSpeedPositions();
    //ramp.updateBCdown();
    ramp.updateBCup(qOn,dt); // argument=total inflow

    //template: road.mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight)

    ramp.mergeDiverge(mainroad,mainRampOffset,
			ramp.roadLen-mergeLen,ramp.roadLen,true,false);

    // (4) update detector readings


    for(let iDet=0; iDet<nDet; iDet++){
	   detectors[iDet].update(time,dt,gk,ramp.veh.length);
    }

    if (detIndex+1 < detectors[iDet].time.length){ //update the sensor data index if needed
    if (time >= detectors[iDet].time[detIndex+1]){
      detIndex++;
    }
  }

  let isGreen = true;

  //############################################
  //ALINEA Ramp Metering
  //############################################
  // KR (regulator parameter) : 70 veh/hr
  // C (Signal cycle) : 40 sec
  // rsat (Ramp sturation capacity) : 2766 veh/hr
  // O^ (critical occupancy) : 0.13 (13%)
  // gmin (min green phase) : 10 sec
  // gmax (max green phse) : 40 sec
  lightStatus[0].push(time);
  if (ALINEA_RM) {
   gk+=70*(40./2766.)*(0.15-detectors[iDet].historyOcc[detIndex]);
   if (gk<10) gk=10;
   if (gk>40) gk=40;

   let fracGreen=gk/40;
   let nCycle=Math.floor(time/40);
   let fracCycle=time/40.-nCycle;
   isGreen=(fracCycle<fracGreen);
  }

  //############################################
  //Proposed Ramp Metering
  //############################################

  if (PROP_RM && time<endTime){
    let nextP = predictLR([detectors[iDet].time[detIndex],
                Math.round((detectors[iDet].historyOcc[detIndex]+Number.EPSILON)*100)/100,
                Math.round(3.6*detectors[iDet].historySpeed[detIndex]),
                Math.round(3600*detectors[iDet].historyFlow[detIndex])]);
    /*if (detIndex>0) {
      let prevP = predictLR([detectors[iDet].time[detIndex-1],
                  Math.round((detectors[iDet].historyOcc[detIndex-1]+Number.EPSILON)*100)/100,
                  Math.round(3.6*detectors[iDet].historySpeed[detIndex-1]),
                  Math.round(3600*detectors[iDet].historyFlow[detIndex-1])]);  //previous prediction
      let prevPE =(prevP-Math.round(3600*detectors[iDet].historyFlow[detIndex]))*1./prevP;      //previous prediction error
      if ((prevPE<-0.5) || (prevPE>0.7)){ //correct the next prediction if needed
        nextP *= (1-prevPE);
      }
    } */
    let curP =(dt*(nextP-Math.round(3600*detectors[iDet].historyFlow[detIndex]))*1./(detectors[iDet].time[detIndex]+reportInt-time))+Math.round(3600*detectors[iDet].historyFlow[detIndex]); //linear interpolation to calculate the flow for the next timeStep
    if (curP>2000){ //ramp metering colume threshold
      const tType=predictKM((nextP-Math.round(3600*detectors[iDet].historyFlow[detIndex]))*1./reportInt);
      let fracGreen = 1;
      let cap = 0;
    switch (tType){
      // 1-5 classes are sorted from the lowest to highest
      case 1: //lowest two rates
      case 2: //Rs(t+1) = 1+(2xCap) capacity is slowly decreasing
      //use 90% model, medium capacity
        cap = 2200/(32.532*Math.pow(Math.round(3.6*detectors[iDet].historySpeed[detIndex]),-0.9682));
      break;
      case 3: //about 0 Rs(t+1) = 1+(1.9xCap) capacity is a bit higher
        //use 95% model: highest capacity
        cap = 2000/(32.793*Math.pow(Math.round(3.6*detectors[iDet].historySpeed[detIndex]),-0.9916));
      break;
      case 4: //highest two rates
      case 5: //Rs(t+1) = 1+(2.1xCap) capacity is low
      // use 85% model: lowest capacity
        cap = 1600/(32.537*Math.pow(Math.round(3.6*detectors[iDet].historySpeed[detIndex]),-0.9524));
      break;
    }
    fracGreen -= (curP*1./cap)*.75;
    if (fracGreen < 0.25) fracGreen = 0.25;
    if (fracGreen > 1) fracGreen = 1;
    gk = Math.round(40*fracGreen); //for data logging
    let nCycle=Math.floor(time/40);
    let fracCycle=(time/40.)-nCycle;
    isGreen=(fracCycle<fracGreen);
    } else {
      isGreen = true;
      gk = 40;
    }
  }

  //template switchingSchemeTL(TL,qRoad,time,cycleTime,greenTime,isFixed)
  //switchingSchemeTL(rampMeterLight,qOn,time,7,3,true); //!!! (1) das macht Fuck!! for debug off
  //Always green light
  lightStatus[1].push((isGreen)? 1:0);
  const newState=(isGreen) ? "green" : "red";
  trafficObjs.setTrafficLight(rampMeterLight, newState);

  //  (5) without this zoomback cmd, everything works but depot vehicles
  // just stay where they have been dropped outside of a road

  if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){//xxxnew
    trafficObjs.zoomBack();
 }

}//updateSim




//##################################################
function drawSim() {
//##################################################

    //!! test relative motion isMoving


  var movingObserver=false;
  var uObs=0*time;

    // (1) redefine graphical aspects of road (arc radius etc) using
    // responsive design if canvas has been resized
    // isSmartphone defined in updateSim

  var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02;
  var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);



  if ((canvas.width!=simDivWindow.clientWidth)
      ||(canvas.height != simDivWindow.clientHeight)){
    hasChanged=true;
    canvas.width  = simDivWindow.clientWidth;
    canvas.height  = simDivWindow.clientHeight;
    aspectRatio=canvas.width/canvas.height;
    refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

    scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile

    updateDimensions();
    trafficObjs.calcDepotPositions(canvas);

    if(false){
	    console.log("haschanged=true: new canvas dimension: ",
		        canvas.width," X ",canvas.height);
    }
  }




  // (2) reset transform matrix and draw background
  // (only needed if no explicit road drawn)

  ctx.setTransform(1,0,0,1,0,0);
  if(drawBackground){
	if(hasChanged||(itime<=15) || (itime===20) || userCanvasManip
	   || movingObserver || (!drawRoad)){
        ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
  }


  // (3) draw mainroad
  // (always drawn; but changedGeometry=true necessary
  // if changed (it triggers building a new lookup table).
  // Otherwise, road drawn at old position

    var changedGeometry=userCanvasManip || hasChanged||(itime<=1)||true;
  ramp.draw(rampImg,rampImg,scale,changedGeometry);
	//	movingObserver,0,
	//	center_xPhys-mainroad.traj_x(uObs)+ramp.traj_x(0),
	//	center_yPhys-mainroad.traj_y(uObs)+ramp.traj_y(0));

    mainroad.draw(roadImg1,roadImg2,scale,changedGeometry);



    // (4) draw vehicles

    ramp.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			vmin_col,vmax_col,0,ramp.roadLen,
			movingObserver,0,
			center_xPhys-mainroad.traj_x(uObs)+ramp.traj_x(0),
			center_yPhys-mainroad.traj_y(uObs)+ramp.traj_y(0));


    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			  vmin_col,vmax_col,0,mainroad.roadLen,
			  movingObserver,uObs,center_xPhys,center_yPhys);


   // (5a) draw traffic objects

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw(scale);
  }

  // (5b) draw speedlimit-change select box

  ctx.setTransform(1,0,0,1,0,0);
  drawSpeedlBox();



    // (6) show simulation time and detector displays

  displayTime(time,textsize);
  for(var iDet=0; iDet<nDet; iDet++){
    detectors[iDet].display(textsize);
  }

  // (7) draw the speed colormap
  // MT 2019: drawColormap=false if drawn statically by html file!

  if(drawColormap){
    displayColormap(0.22*refSizePix,
			0.43*refSizePix,
			0.1*refSizePix, 0.2*refSizePix,
			vmin_col,vmax_col,0,100/3.6);
  }

  // may be set to true in next step if changed canvas
  // or old sign should be wiped away

  hasChanged=false;

  // revert to neutral transformation at the end!

  ctx.setTransform(1,0,0,1,0,0);
 }

//##################################################
// Clustering and regression models for reamp metering
//##################################################
var regression;
var clusters;

function trainModels(){
  const xdata = trdata.time.map((_,i)=>[trdata.time[i],trdata.occ[i],trdata.speed[i],trdata.pvol[i]]);
  const ydata = trdata.pvol.map((_,i)=>[trdata.vol[i],trdata.vol[i]]);
  regression = new ML.MultivariateLinearRegression(xdata, ydata);

  let dvol = [];
  for (let i=1; i<trdata.vol.length; i++){
    dvol[i-1] = [0,(trdata.vol[i] - trdata.vol[i-1])/(trdata.time[i] - trdata.time[i-1])];
  }
  let result = ML.KMeans(dvol,5,{'initialization':'kmeans++'});
  clusters = [];
  for (var i=0; i<result.centroids.length; i++){
    clusters[i] = result.centroids[i].centroid[1];
  }
  clusters.sort(function(a, b){return a - b});
}

function predictKM(input){
  let diff = 1000;
  let clstr = 0;
  for (let i=0; i<clusters.length; i++){
    if (Math.abs(input-clusters[i])<diff) {
      diff = Math.abs(input-clusters[i]);
      clstr = i+1;
    }
  }
  return clstr;
}

function predictLR(input){
  return regression.predict(input)[0];
}

//##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_loop() {
  if (time>endTime){
    clearInterval(myRun);
    isStopped = true;
    document.getElementById("startStop").src="figs/buttonGo_small.png";
    prepPlots();
    dlResults();
    return;
  }
    updateSim();
    drawSim();
    userCanvasManip=false;
}


function run_sim(){
  lightStatus = [];
  lightStatus[0] = [];
  lightStatus[1] = [];
  if (PROP_RM){
    trainModels();
    }
  while (time <= endTime){
    updateSim();
    drawSim();
    userCanvasManip=false;
}
  //console.log(getResults());
  document.getElementById("startStop").src="figs/buttonGo_small.png";
  console.log("Simulation Complete");
  prepPlots();
  dlResults();
}

function prepResults(){
  const r1 = detectors[1].time.map((_,i)=>[detectors[1].time[i],
      Math.round((detectors[1].historyOcc[i]+Number.EPSILON)*100)/100,
      Math.round(3.6*detectors[1].historySpeed[i]),Math.round(3600*detectors[1].historyFlow[i]),
      Math.round(3600*detectors[0].historyFlow[i]),detectors[1].optStat[i],
      Math.round((detectors[1].historyGC[i]+Number.EPSILON)*100)/100]);
  const r2 = lightStatus[0].map((_,i)=>[lightStatus[0][i],lightStatus[1][i]]);
  return [r1,r2];
}

function prepPlots(){
  const sresult = [{'x' : detectors[1].time.map((_,i)=>detectors[1].time[i]/3600.),
                  'y' : detectors[0].historyFlow.map((_,i)=>Math.round(3600*detectors[0].historyFlow[i])),
                  'name' : 'Upstream',
                  'mode' : 'lines'},
                  {'x' : detectors[1].time.map((_,i)=>detectors[1].time[i]/3600.),
                  'y' : detectors[1].historyFlow.map((_,i)=>Math.round(3600*detectors[1].historyFlow[i])),
                  'name' : 'Downstream',
                  'mode' : 'lines'},
                  {'x' : detectors[1].time.map((_,i)=>detectors[1].time[i]/3600.),
                  'y' : detectors[1].historySpeed.map((_,i)=>Math.round(3.6*detectors[1].historySpeed[i])),
                  'name' : 'Downstream Speed',
                  'mode' : 'lines'},
                  {'x' : detectors[1].time.map((_,i)=>detectors[1].time[i]/3600.),
                  'y' : detectors[1].historyGC.map((_,i)=>Math.round((detectors[1].historyGC[i]+Number.EPSILON)*100)/100),
                  'name' : 'Green Phase',
                  'mode' : 'lines'},
                  {'x' : detectors[1].time.map((_,i)=>detectors[1].time[i]/3600.),
                  'y' : detectors[1].optStat,
                  'name' : 'Ramp Queue',
                  'mode' : 'lines'},
                  {'x' : detectors[1].time.map((_,i)=>detectors[1].time[i]/3600.),
                  'y' : detectors[1].historyOcc.map((_,i)=>Math.round((detectors[1].historyOcc[i]+Number.EPSILON)*100)/100),
                  'name' : 'Occupancy',
                  'mode' : 'lines'},
                  {'x' : lightStatus[0].map((_,i)=>lightStatus[0][i]/3600.),
                  'y' : lightStatus[1],
                  'name' : 'Signal Status',
                  'mode' : 'markers',
                  'type' : 'scatter'},
                  /*{'x' : propRM[0].map((_,i)=>propRM[0][i]/3600.),
                  'y' : propRM[2],
                  'name' : 'Signal Status',
                  'mode' : 'lines'}*/,
                  {'Flow Multipier': flow_mltpr,
                  'Report Interval': reportInt,
                  'Time Step': timeStep
                  }];
  //console.log(JSON.stringify(sresult));
  //console.log(propRM[2]);
  localStorage.clear();
  localStorage.setItem("result",JSON.stringify(sresult));
}

function dlResults(){ //Downloading the results from the downstream sensor
  let nameStirng;
  if (ALINEA_RM) {
    nameStirng = 'ALINEARM';
  } else if (PROP_RM){
    nameStirng = 'PROPRM';
  } else {
    nameStirng = 'NoMetering';
  }
  const res = prepResults();
  const csv1 = "data:text/csv;charset=utf-8,"+"time,occupancy,speed,totalflow,mainflow,qramp,greenCycle\n"
  +res[0].map(e => e.join(",")).join("\n");
  const URI1 = encodeURI(csv1);
  let link = document.createElement("a");
  link.setAttribute("href", URI1);
  link.setAttribute("download", 'Results_'+nameStirng+'.csv');
  document.body.appendChild(link); // Required for FF
  //link.click();

  const csv2 = "data:text/csv;charset=utf-8,"+"time,LightStatus\n"
  +res[1].map(e => e.join(",")).join("\n");
  const URI2 = encodeURI(csv2);
  link = document.createElement("a");
  link.setAttribute("href", URI2);
  link.setAttribute("download", 'MeterStatus_'+nameStirng+'.csv');
  document.body.appendChild(link); // Required for FF
  //link.click();
  window.open("./results.html", "_blank");
}

 //############################################
// start the simulation thread
// THIS function does all the things; everything else
// only functions/definitions
// triggers:
// (i) automatically when loading the simulation
// (ii) when pressing the start button in *gui.js
//  ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");
//showInfo();
var myRun;
//var myRun=setInterval(main_loop, 1000/fps);
