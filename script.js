"use strict";

(function () {
    const mapContainer = document.getElementById("map");

    let width = mapContainer.offsetWidth;
    let height = mapContainer.offsetHeight;
    let scale = 0.9;
    let projection = d3.geoOrthographic().clipAngle(90);
    let path = d3.geoPath().projection(projection);
    let map = void 0;
    let world = void 0;
    let countries = void 0;

    // cached values needed for zoom functionality
    let mapWidth = 0;
    let mapHeight = 0;
    let mapCenterX = 0;
    let mapCenterY = 0;

    //
    let mode = "selection";
    let selectedCountries = [];

    // score
    let rightAnswers = 0;
    let wrongAnswers = 0;

    let cached = false;
    function cacheZoomVars(){
        if(cached){
            return;
        }

        let b = path.bounds(countries);
        mapWidth = b[1][0] - b[0][0];
        mapHeight = b[1][1] - b[0][1];
        mapCenterX = mapWidth / 2;
        mapCenterY = mapHeight / 2;

        cached = true;
    }

    function hideTooltip(){
        var div = document.getElementById('tooltip');
        div.style.display = 'none';
    }

    function onZoom(event) {
        cacheZoomVars();
        hideTooltip();
        let scale = event.transform.k;
        let tx = mapCenterX - (mapWidth * scale) / 2;
        let ty = mapCenterY - (mapHeight * scale) / 2;
        map.attr("transform", `translate(${tx}, ${ty})scale(${event.transform.k})`);
    }

    const zoom = d3.zoom()
        .scaleExtent([1, 50])
        .on("zoom", onZoom);


    function onDrag(event) {
        hideTooltip();
        let c = projection.rotate();
        projection.rotate([c[0] + event.dx / 2, c[1] - event.dy / 2, c[2]]);
        map.selectAll('path').attr('d', path);
    };

    const drag = d3.drag()
        .on("drag", onDrag);

    function geoID(d) {
        return "c" + d.id;
    };

    function onClick(event, d) {
        if(mode === "interim"){
            return;
        }
        if(mode === "selection"){
            const countryInfo = {
                elID: geoID(d),
                a3: d.properties.a3,
                name: d.properties.name
            }
            if(selectedCountries.find(c => c.elID === countryInfo.elID)){
                selectedCountries = selectedCountries.filter(c => c.elID !== countryInfo.elID);
                hideTooltip();
            }
            else{
                selectedCountries.push(countryInfo);
                var div = document.getElementById('tooltip');
                div.style.left = event.pageX +'px';
                div.style.top = event.pageY + 'px';
                const a3 = d.properties.a3;
                const name = d.properties.name;
                div.innerHTML =
                    `<img class="flag" src="/svg_flags/${a3}.svg" /> <span>${name}</span>`;
                div.style.display = 'block';
            }
            d3.selectAll('path').attr('fill', "#ccc");
            for(let c of selectedCountries){
                d3.select('#' + c.elID).attr('fill', "lightgreen");
            }

            const startBtn = document.getElementById("start-btn");
            startBtn.disabled = selectedCountries.length < 2;

        }
        else{ // test mode
            if(d.properties.a3 === pickedCountry.a3){
                updateScore(rightAnswers + 1, wrongAnswers);
                d3.selectAll('path').attr('fill', "#ccc");
                d3.select('#' + geoID(d)).attr('fill', "lightgreen");
                mode = "interim";
                setTimeout(pickCountry, 200);
            }
            else{
                updateScore(rightAnswers, wrongAnswers + 1);
                d3.selectAll('path').attr('fill', "#ccc");
                d3.select('#' + geoID(d)).attr('fill', "lightcoral");
            }
        }
    };

    function updateScore(newRightAnswer, newWrongAnswers){
        if(newRightAnswer !== rightAnswers){
            rightAnswers = newRightAnswer;
            document.getElementById("right-answers").innerHTML = `${rightAnswers}`;
        }
        if(newWrongAnswers !== wrongAnswers){
            wrongAnswers = newWrongAnswers;
            document.getElementById("wrong-answers").innerHTML = `${wrongAnswers}`;
        }
    }

    let svg = d3.select("#map")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%");

    d3.json('/geodata/110m.json').then(function (data) {
        countries = topojson.feature(data, data.objects.countries);

        map = svg.append('g').attr('class', 'boundary');
        world = map.selectAll('path').data(countries.features);

        projection.scale(1).translate([0, 0]);
        let b = path.bounds(countries);
        let s = scale / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height);
        let t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1])) / 2];
        projection.scale(s).translate(t);

        projection.rotate([90, 0, 0]);

        world.enter()
            .append('path')
            .attr('d', path)
            .attr('id', geoID)
            .on("click", onClick);

        svg.call(drag).call(zoom);

    });


    function hideDiv(divID){
        const div = document.getElementById(divID);
        div.style.display = "none";
    }

    function showDiv(divID){
        const div = document.getElementById(divID);
        div.style.display = "block";
    }


    //const selectionBtn = document.getElementById("select-btn");
    document.getElementById("select-btn").onclick = function(){
        mode = "selection";
        hideDiv("test-tools");
        showDiv("selection-tools");
        d3.selectAll('path').attr('fill', "#ccc");
        for(let c of selectedCountries){
            d3.select('#' + c.elID).attr('fill', "lightgreen");
        }
        document.getElementById("country-name").innerHTML = "";
    }

    //const testStartBtn = document.getElementById("start-btn");
    document.getElementById("start-btn").onclick = function() {
        mode = "test";
        hideDiv("selection-tools");
        showDiv("test-tools");
        updateScore(0, 0);
        hideTooltip();
        pickCountry();

    }

    //const clearSelectionBtn = document.getElementById("clear-selection-btn");
    document.getElementById("clear-selection-btn").onclick = function() {
        hideTooltip();
        selectedCountries = [];
        d3.selectAll('path').attr('fill', "#ccc");
        for(let c of selectedCountries){
            d3.select('#' + c.elID).attr('fill', "lightgreen");
        }
        document.getElementById("start-btn").disabled = true;
    }

    let pickedCountry = "";
    let previousPickedCountry = "";
    function pickCountry(){
        mode = "test";
        while(true){
            pickedCountry = getRandomArrayElement(selectedCountries);
            if(pickedCountry !== previousPickedCountry){
                previousPickedCountry = pickedCountry;
                break;
            }
        }
        d3.selectAll('path').attr('fill', "#ccc");
        const div = document.getElementById("country-name");
        const a3 = pickedCountry.a3;
        const name = pickedCountry.name;
        div.innerHTML = `<img class="flag" src="/svg_flags/${a3}.svg" /> <span>${name}</span>`;


    }

    function getRandomArrayElement(arr){
        return arr[Math.floor(Math.random() * arr.length)];
    }
})();
