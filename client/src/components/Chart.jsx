import React from "react";
import { Client } from "paho-mqtt";
import {
  VictoryChart,
  VictoryLabel,
  VictoryAxis,
  VictoryTheme,
  VictoryLine,
  VictoryLegend,
  createContainer,
  VictoryTooltip,
  VictoryVoronoiContainer
} from "victory";
import moment from "moment";
import Card from "@material-ui/core/Card";

const colors = [
  //generated with https://medialab.github.io/iwanthue/
  // and https://maketintsandshades.com/#50b47b,b74873,6c81d9,bf903b,5b388a,b94f3d,7fa443,c169ba
  {primary: "#50b47b", A: "#50b47b", B: "#73c395", C: "#387e56", D: "#a8dabd"},
  {primary: "#b74873", A: "#b74873", B: "#c56d8f", C: "#923a5c", D: "#dba4b9"},
  {primary: "#6c81d9", A: "#6c81d9", B: "#98a7e4", C: "#4c5a98", D: "#c4cdf0"},
  {primary: "#bf903b", A: "#bf903b", B: "#cca662", C: "#866529", D: "#dfc89d"},
  {primary: "#5b388a", A: "#5b388a", B: "#7c60a1", C: "#402761", D: "#ad9cc5"},
  {primary: "#b94f3d", A: "#b94f3d", B: "#ce8477", C: "#943f31", D: "#dca79e"},
  {primary: "#7fa443", A: "#7fa443", B: "#a5bf7b", C: "#59732f", D: "#bfd2a1"},
  {primary: "#c169ba", A: "#c169ba", B: "#d496cf", C: "#874a82", D: "#e6c3e3"},
];

const colorMaps = {}

function getColorFromName(name){
  if (name in colorMaps){
    return colorMaps[name]
  }

  let sensorRe = /(.*)-[ABCD]/;
  if (sensorRe.test(name)){
    let primaryName = name.match(sensorRe)[1]
    return getColorFromName(primaryName)
  }
  else{
    var newPallete = colors.shift()
    colorMaps[name] = newPallete.primary
    colorMaps[name + "-A"] = newPallete.A
    colorMaps[name + "-B"] = newPallete.B
    colorMaps[name + "-C"] = newPallete.C
    colorMaps[name + "-D"] = newPallete.D
    return getColorFromName(name)
  }
}


function linspace(startValue, stopValue, cardinality) {
  var arr = [];
  var step = (stopValue - startValue) / (cardinality - 1);
  for (var i = 0; i < cardinality; i++) {
    arr.push(startValue + step * i);
  }
  return arr;
}

class Chart extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      seriesMap: {},
      hiddenSeries: new Set(),
      names: [],
      legendEvents: [],
    };
    this.onConnect = this.onConnect.bind(this);
    this.onMessageArrived = this.onMessageArrived.bind(this);
    this.selectLegendData = this.selectLegendData.bind(this);
    this.selectVictoryLines = this.selectVictoryLines.bind(this);

  }

  onConnect() {
    this.client.subscribe(
      ["pioreactor", "+", this.props.experiment, this.props.topic].join("/")
    );
  }

  componentDidMount() {
    this.getData();

    if (this.props.config.remote) {
      this.client = new Client(
        `ws://${this.props.config.remote.ws_url}/`,
        "webui_Chart" + Math.random()
      )}
    else {
      this.client = new Client(
        `${this.props.config['network.topology']['leader_hostname']}.local`, 9001,
        "webui_Chart" + Math.random()
      );
    }


    this.client.connect({ onSuccess: this.onConnect });
    this.client.onMessageArrived = this.onMessageArrived;
  }

  async getData() {
    await fetch(this.props.dataFile)
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        let initialSeriesMap = {};
        for (const [i, v] of data["series"].entries()) {
          if (data["data"][i].length > 0) {
            initialSeriesMap[v] = {
              data: (data["data"][i]).filter(this.filterDataPoints(data["data"][i].length)).map(item => ({y: item.y, x: moment(item.x, 'x')})),
              name: v,
              color: getColorFromName(v),
            };
          }
        }
        let names = Object.keys(initialSeriesMap);
        this.setState({
          seriesMap: initialSeriesMap,
          legendEvents: this.createLegendEvents(names),
          names: names,
        });
      });
  }

  createLegendEvents(names) {
    return names.map((name, idx) => {
      return {
        childName: ["legend"],
        target: "data",
        eventKey: String(idx),
        eventHandlers: {
          onClick: () => {
            return [
              {
                childName: ["line-" + name],
                target: "data",
                mutation: () => { //this is dumb! I shouldn't mutate this way!
                  if (!this.state.hiddenSeries.delete(name)) {
                    // Was not already hidden => add to set
                    this.state.hiddenSeries.add(name);
                  }
                  this.setState({
                    hiddenSeries: new Set(this.state.hiddenSeries),
                  });
                  return null;
                },
              },
            ];
          },
        },
      };
    });
  }

  onMessageArrived(message) {

    const currentTime = moment()

    var key = this.props.isODReading
      ? message.topic.split("/")[1] + "-" + message.topic.split("/")[5]
      : message.topic.split("/")[1];

    try {
      if (!(key in this.state.seriesMap)){
        const newSeriesMap = {...this.state.seriesMap, [key]:  {
          data: [{x: currentTime, y: parseFloat(message.payloadString)}],
          name: key,
          color: getColorFromName(key)
        }}

        this.setState({ seriesMap: newSeriesMap })
        this.setState({
          names: [...this.state.names, key]
        })
      } else {
        // .push seems like bad state management, and maybe a hit to performance...
        this.state.seriesMap[key].data.push({
          x: currentTime,
          y: parseFloat(message.payloadString),
        });
        this.setState({ seriesMap: this.state.seriesMap })
      }
    }
    catch (error) {
      console.log(error)
    }
    return;
  }

  breakString(string){
    if (string.length > 7){
      return string.slice(0, 5) + "..." + string.slice(string.length-2, string.length)
    }
    return string
  }

  renameAndFormatSeries(name){
    if (!this.props.config['ui.overview.rename']){
      return name
    }

    if (name.match(/(.*)-([ABCD])/g)){
      const results = name.match(/(.*)-([ABCD])/);
      const index = results[1];
      const sensor = results[2];
      return this.breakString(this.props.config['ui.overview.rename'][index] || index) + sensor
    }
    else {
      return this.breakString(this.props.config['ui.overview.rename'][name] || name)
    }
  }


  filterDataPoints(totalLength){
    return function(value, index){
      if (totalLength < 500){
        return true
      }
      if ((index === 0) || (index === (totalLength - 1))){
        return true
      }
      else if (index % Math.round(totalLength/500) === 0){
        return true
      } else {
        return false
      }
    }
  }

  createToolTip = (d) => {
      return `${d.datum.x.format("MMM DD HH:mm")}
${this.renameAndFormatSeries(d.datum.childName)}: ${Math.round(d.datum.y * 1000) / 1000}`
  }


  selectLegendData(name){
    if (!this.state.seriesMap) {
      return {}
    }
    const line = this.state.seriesMap[name];
    const item = {
      name: this.renameAndFormatSeries(line.name),
      symbol: { fill: line.color },
    };
    if (this.state.hiddenSeries.has(name)) {
      return { ...item, symbol: { fill: "white" } };
    }
    return item;
  }

  selectVictoryLines(name) {
    if (this.state.hiddenSeries.has(name)) {
      return undefined;
    }
    return (
      <VictoryLine
        interpolation={this.props.interpolation}
        key={"line-" + name + this.props.title}
        name={name}
        style={{
          labels: {fill: this.state.seriesMap[name].color},
          data: {
            stroke: this.state.seriesMap[name].color,
            strokeWidth: 2,
          },
          parent: { border: "1px solid #ccc" },
        }}
        data={this.state.seriesMap[name].data}
        x="x"
        y="y"
      />
    );
  }

  render() {
    const VictoryVoronoiContainer = createContainer("voronoi");
    return (
      <Card style={{ maxHeight: "100%"}}>
        <VictoryChart
          title={this.props.title}
          domainPadding={10}
          padding={{ left: 70, right: 50, bottom: 80, top: 50 }}
          events={this.state.legendEvents}
          responsive={true}
          width={600}
          height={315}
          scale={{x: 'time'}}
          theme={VictoryTheme.material}
          containerComponent={
            <VictoryVoronoiContainer
              voronoiBlacklist={['parent']}
              labels={this.createToolTip}
              labelComponent={
                <VictoryTooltip
                  cornerRadius={0}
                  flyoutStyle={{
                    fill: "white",
                    stroke: "#90a4ae",
                    strokeWidth: 1.5,
                  }}
                />
              }
            />
          }
        >
          <VictoryLabel
            text={this.props.title}
            x={300}
            y={30}
            textAnchor="middle"
            style={{
              fontSize: 15,
              fontFamily: "inherit",
            }}
          />
          <VictoryAxis
            style={{
              tickLabels: {
                fontSize: 13,
                padding: 5,
                fontFamily: "inherit",
              },
            }}
            offsetY={80}
            orientation="bottom"
          />
          <VictoryAxis
            crossAxis={false}
            dependentAxis
            label={this.props.yAxisLabel}
            axisLabelComponent={
              <VictoryLabel
                dy={-40}
                style={{
                  fontSize: 15,
                  padding: 10,
                  fontFamily: "inherit",
                }}
              />
            }
            style={{
              tickLabels: {
                fontSize: 13,
                padding: 5,
                fontFamily: "inherit",
              },
            }}
          />
          <VictoryLegend
            x={60}
            y={267}
            symbolSpacer={10}
            itemsPerRow={6}
            name={"legend"}
            borderPadding={{ right: 8 }}
            orientation="horizontal"
            cursor={"pointer"}
            gutter={15}
            style={{
              labels: { fontSize: 12 },
              data: { stroke: "#485157", strokeWidth: 0.5, size: 6.5 },
            }}
            data={this.state.names.map(this.selectLegendData)}
          />
          {Object.keys(this.state.seriesMap).map(this.selectVictoryLines)}
        </VictoryChart>
      </Card>
    );
  }
}

export default Chart;
