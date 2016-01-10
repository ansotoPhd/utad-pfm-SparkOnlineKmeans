/**
 * Created by asoriano on 21/12/15.
 */


var svg = d3.select("body").append("svg")
            .attr("width", 800)
            .attr("height", 803);


function moveRect() {
    d3.select(this).attr('transform', 'translate(' + d3.event.x + ' ' + d3.event.y +')');
}

function moveCircle() {
    d3.select(this).attr('cx', d3.event.x).attr('cy', d3.event.y);
}

var circle = svg.append("circle")
    .attr("r", 40)
    .attr("cx", 50)
    .attr("cy", 200)
    .style("fill", "white")
    .style("stroke", "red")
    .style("stroke-width", "2px")
    .classed("baseCircle", true); // created a class to identify

var drag = d3.behavior.drag()
    .on("dragstart", dragstart)
    .on("drag", drag)
    .on("dragend", dragend);

circle.call(drag);

var targetCircle = circle;
var tempCircle   = circle;

function dragstart() {
    console.log("circle dragged is::" + d3.select(this).attr("id"));
    if (d3.select(this).classed("baseCircle") === true) {

        targetCircle = svg.append("circle")
            .attr("r", 40)
            .attr("cx", targetCircle.attr("cx"))
            .attr("cy", targetCircle.attr("cy"))
            .style("fill", "white")
            .style("stroke", "green")
            .style("stroke-width", "2px");
    }
    else
    {
        targetCircle = d3.select(this);
        tempCircle = this;
    }
    targetCircle.classed("dragTarget", true);
}

function drag()
{
    targetCircle.attr("cx", d3.event.x)
        .attr("cy", d3.event.y);
}

// Group element
var targetG = svg.append("g")
    .attr("transform", "translate(150,150)")
    .call(
        d3.behavior.drag()
            .on('drag', moveRect).origin(function () {
            var tc = d3.select(this).attr('transform').replace(/[a-z()]/g, '').split(' ');
            if (tc.length === 1)
                tc = tc[0].split(',')
            return { x: Number(tc[0]), y: Number(tc[1]) };
        }));

targetG.append("rect")
    .attr("fill", "none")
    .style("stroke", "black")
    .style("stroke-width", "2px")
    .attr("width", 200)
    .attr("height", 200)
    .style("fill", "white")

function dragend(d) {
    //Get event x and y
    var tx = targetCircle.attr("cx"),
        ty = targetCircle.attr("cy");
    var flag = 0;
    //Select all elements in svg
    try {
        var elemArr = svg.selectAll("*").each(function (d, i) {
            //If the element is a member of a group, check
            if ($(this.parentNode).is("g")) {
                //Get coordinates
                var box = this.getBBox();
                var bx = box.x,
                    by = box.y,
                    bw = box.width,
                    bh = box.height;
                //Make shape inherit translate of parent element
                var translate = d3.select(this.parentNode).attr("transform");
                var translate = translate.substring(translate.indexOf("translate(") + 10, translate.length);
                translate = (translate.substring(0, translate.indexOf(")"))).split(",");
                if (translate.length === 1)
                    translate = translate[0].split(' ');

                bx += parseInt(translate[0]);
                by += parseInt(translate[1]);
                //Check if within x and y bounds
                if (tx >= bx && tx <= (bx + bw) && !flag && ty >= by && ty <= (by + bh))
                {
                    //Flag to prevent further action
                    flag = 1;
                    //Append target circle to g element
                    targetG.append("circle")
                        .attr("r", 40) 	//get radius from targetCircle and also styles?
                        .attr("id", "circleAdded")
                        //.classed("notbaseCircle", true)
                        .attr("cx", d3.mouse(this)[0])
                        .attr("cy", d3.mouse(this)[1])
                        .style("fill", "white")
                        .style("stroke", "black")
                        .style("stroke-width", "2px")
                        .call(
                            d3.behavior.drag()
                                .on('drag', moveCircle).origin(function () {
                                var t = d3.select(this);
                                return {x: t.attr("cx"), y: t.attr("cy")};
                            }));
                    d3.selectAll("circle.dragTarget").remove();
                }
            }
        });
    } catch (e) {
        log(e);
    }
}
function log(s) {
    console.log(s);
    return s;
}