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
} from "victory";
import moment from "moment";
import Card from "@material-ui/core/Card";

const colors = [
  {primary: "#9C6ADE", 0: "#9C6ADE", 1: "#E3D0FF", 2: "#50248F", 3: "#ecdffb"},
  {primary: "#F49342", 0: "#F49342", 1: "#FFC58B", 2: "#C05717", 3: "#4A1504"},
  {primary: "#47C1BF", 0: "#47C1BF", 1: "#B7ECEC", 2: "#00848E", 3: "#003135"},
  {primary: "#50B83C", 0: "#50B83C", 1: "#BBE5B3", 2: "#108043", 3: "#E3F1DF"},
  {primary: "#DE3618", 0: "#DE3618", 1: "#FEAD9A", 2: "#BF0711", 3: "#FBEAE5"},
  {primary: "#EEC200", 0: "#EEC200", 1: "#FFEA8A", 2: "#8A6116", 3: "#573B00"},
  {primary: "#006FBB", 0: "#006FBB", 1: "#B4E1FA", 2: "#084E8A", 3: "#001429"},
  {primary: "#43467F", 0: "#43467F", 1: "#B3B5CB", 2: "#1C2260", 3: "#00044C"},
];

const colorMaps = {}

function getColorFromName(name){
  if (name in colorMaps){
    return colorMaps[name]
  }

  let sensorRe = /(.*)-[0123]/;
  if (sensorRe.test(name)){
    let primaryName = name.match(sensorRe)[1]
    return getColorFromName(primaryName)
  }
  else{
    var newPallete = colors.shift()
    colorMaps[name] = newPallete.primary
    colorMaps[name + "-0"] = newPallete[0]
    colorMaps[name + "-1"] = newPallete[1]
    colorMaps[name + "-2"] = newPallete[2]
    colorMaps[name + "-3"] = newPallete[3]
    return getColorFromName(name)
  }
}


class Chart extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      seriesMap: {},
      hiddenSeries: new Set(),
      names: [],
      legendEvents: [],
      fetched: false,
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

    if (this.props.config.remote && this.props.config.remote.ws_url) {
      this.client = new Client(
        `ws://${this.props.config.remote.ws_url}/`,
        "webui_Chart" + Math.random()
      )}
    else {
      this.client = new Client(
        `${this.props.config['network.topology']['leader_address']}`, 9001,
        "webui_Chart" + Math.random()
      );
    }


    this.client.connect({ onSuccess: this.onConnect, reconnect: true});
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
          fetched: true
        });
      })
      .catch((e) => {
        console.log(e)
        this.setState({fetched: true})
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
    if (!this.state.fetched){
      return
    }
    if (message.retained){
      return
    }
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
    if (string.length > 11){
      return string.slice(0, 5) + "..." + string.slice(string.length-2, string.length)
    }
    return string
  }

  renameAndFormatSeries(name){
    if (!this.props.config['ui.rename']){
      return name
    }

    if (name.match(/(.*)-([0123])/g)){
      const results = name.match(/(.*)-([0123])/);
      const index = results[1];
      const sensor = results[2];
      return this.breakString(this.props.config['ui.rename'][index] || index) + "-" + sensor
    }
    else {
      return this.breakString(this.props.config['ui.rename'][name] || name)
    }
  }


  filterDataPoints(totalLength){
    return function(value, index){
      if (totalLength < 600){
        return true
      }
      if ((index === 0) || (index === (totalLength - 1))){
        return true
      }
      else if (index % Math.round(totalLength/600) === 0){
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
            domain={this.props.yAxisDomain}
            tickFormat={this.props.yAxisTickFormat}
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
            x={65}
            y={267}
            symbolSpacer={6}
            itemsPerRow={5}
            name={"legend"}
            borderPadding={{ right: 8 }}
            orientation="horizontal"
            cursor={"pointer"}
            gutter={15}
            rowGutter={5}
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
