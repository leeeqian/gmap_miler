var GmapMiler = (function () {
    
    var boundaries = {};
    
    var readBoundaries = function () {
        for(i in states){
            var state = states[i];
            var stateAbbrev = state_abbrevs[state._name];
            boundaries[stateAbbrev] = state.point;
        }
    };
    readBoundaries();
        
    var inside = function (point, vs) {
        // ray-casting algorithm based on
        // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
        
        var x = point.lat, y = point.lng;
        
        var inside = false;
        for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            var xi = vs[i].lat, yi = vs[i].lng;
            var xj = vs[j].lat, yj = vs[j].lng;
            
            var intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        
        return inside;
    };
    
    var detectState = function (point) {
        if(point.hasOwnProperty('state'))
            return point.state;
        var lat = point.lat();
        var lng = point.lng();
        for(state in boundaries){
            if(inside({lat: lat, lng: lng}, boundaries[state])){
                point.state = state;
                return state;
            }
        }
        return false;
    };
    
    var gRoute = function (origin, destination, goThroughFn) {
        var dir = new google.maps.DirectionsService;
            dir.route({
                origin: origin,
                destination: destination,
                travelMode: google.maps.TravelMode.DRIVING
            }, function(response, status) {
                if (status === google.maps.DirectionsStatus.OK) {
                    var steps = response.routes[0].legs[0].steps;  
                    goThroughFn(steps);  
                } else {
                    console.log(status);
                }
            });
    };
    
    var findBoundary = function (path, begin, end, beginState, endState) {
        var middle =  Math.floor((end + begin)/2);
        var state = detectState(path[middle]);
        var nextState = detectState(path[middle + 1]);
        if(state !== nextState)
            return middle;
        var prevState = detectState(path[middle - 1]);
        if(state !== nextState)
            return middle - 1;
        if(state === beginState){
            return findBoundary(path, middle, end, beginState, endState);
        }
        else{
            return findBoundary(path, begin, middle, beginState, endState);
        }
    };
    
    var latLng = function(point) {
        return point.lat() + ',' + point.lng();
    }
    
    var calcPointToPoint = function (p1, p2, distanceOb, state, b){
        setTimeout(function(){
            gRoute(latLng(p1), latLng(p2), function(steps){
                var sum = 0;
                for (j in steps) {
                    sum += steps[j].distance.value;
                }
                increaseDistance(distanceOb, state, sum);
console.log('calcPointToPoint')
console.log(latLng(p1), latLng(p2), state, sum);
console.log(distanceOb)
            });            
        }, b*1000);
    };
    
    var increaseDistance = function(distanceOb, state, value){
        if(!distanceOb.hasOwnProperty(state)){
            distanceOb[state] = 0;
        }
        distanceOb[state] += value;
    };
    
    var calcCircleDistance = function(p1, p2) {
        var lat1 = deg2rad(p1.lat());
        var lat2 = deg2rad(p2.lat());
        var lon1 = deg2rad(p1.lng());
        var lon2 = deg2rad(p2.lng());
        var dlon = lon2 - lon1;
        var dlat = lat2 - lat1; 
        var a = Math.pow(Math.sin(dlat/2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dlon/2), 2); 
        var c = 2 * Math.atan2( Math.sqrt(a), Math.sqrt(1-a) );
        var d = 6373 * 1000 * c; //(where R is the radius of the Earth)
        return d;
    };
   
	var deg2rad = function(deg) {
		return deg * Math.PI/180;
	};
	
	var round = function (x) {
		return Math.round( x * 1000) / 1000;
	};
    
    return {
        calcDistance: function (origin, destination) {
            gRoute(origin, destination, function(steps){
                var totalDistance = 0;
                var distanceOb = {};
                var prevState = false;
                for (var i in steps) {
                    var step = steps[i];
                    var path = step.path;
                    
                    var boundaries = [];
                    var prevState = detectState(path[0]);
                    boundaries.push({p: path[0], i: 0, from: prevState});
                    for (var j in path) {
                        var jState = detectState(path[j]);
                        if (jState === prevState || jState === false) {
                            continue;
                        }
                        
                        boundaries.push({p: path[j], i: j, from: prevState});
                        prevState = jState;
                    }
                    if(boundaries.length === 1){
                        increaseDistance(distanceOb, prevState, step.distance.value);
                    }
                    else {
                        var end = path.length - 1;
                        boundaries.push({p: path[end], i: end, from: detectState(path[end])});
console.log('boundaries');
console.log(boundaries);
                        for (var b = 0; b < boundaries.length - 2; b++) {
                            calcPointToPoint(boundaries[b].p, boundaries[b+1].p, distanceOb, boundaries[b+1].from, b);
                        }
                    }
                    totalDistance += step.distance.value;
                }
console.log(totalDistance);
console.log(distanceOb); 
            });
        }
    };
})();