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

const colors = {
  1: "#9C6ADE",
  "1-A": "#9C6ADE",
  "1-D": "#E3D0FF",
  "1-C": "#50248F",
  "1-B": "#230051",

  2: "#47C1BF",
  "2-A": "#47C1BF",
  "2-D": "#B7ECEC",
  "2-C": "#00848E",
  "2-B": "#003135",


  3: "#F49342",
  "3-A": "#F49342",
  "3-D": "#FFC58B",
  "3-C": "#C05717",
  "3-B": "#4A1504",

  4: "#50B83C",
  "4-A": "#50B83C",
  "4-B": "#173630",
  "4-C": "#108043",
  "4-D": "#BBE5B3",

};

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
      maxTimestamp: parseInt(moment().format("x")),
      hiddenSeries: new Set(),
      lastMsgRecievedAt: parseInt(moment().format("x")),
      names: [],
      legendEvents: [],
      minTimestamp: parseInt(moment().subtract(30, 'seconds').format("x")),
    };
    this.onConnect = this.onConnect.bind(this);
    this.onMessageArrived = this.onMessageArrived.bind(this);
  }

  onConnect() {
    this.client.subscribe(
      ["pioreactor", "+", this.props.experiment, this.props.topic].join("/")
    );
  }

  componentDidMount() {
    this.getData();
    this.client = new Client(
      "ws://pioreactorws.ngrok.io/",
      "client" + Math.random()
    );


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
              data: (data["data"][i]).filter((e, i) =>  i % 4 == 0), //tune this value better.
              name: v,
              color: colors[v],
            };
          }
        }
        let names = Object.keys(initialSeriesMap);
        let mts = Math.min(
          ...Object.values(initialSeriesMap).map((s) => parseInt(s.data[0].x))
        );
        this.setState({
          seriesMap: initialSeriesMap,
          legendEvents: this.createLegendEvents(names),
          names: names,
          minTimestamp: mts,
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
                mutation: () => {
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
    if (message.retained){
      return
    }
    const currentTime = parseInt(moment().format("x"));

    var key = this.props.isODReading
      ? message.topic.split("/")[1] + "-" + message.topic.split("/")[5]
      : message.topic.split("/")[1];

    try {
      if (!(key in this.state.seriesMap)){
        const newSeriesMap = {...this.state.seriesMap, [key]:  {
          data: [{x: currentTime, y: parseFloat(message.payloadString)}],
          name: key,
          color: colors[key]
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

      this.setState({
        maxTimestamp: currentTime,
        lastMsgRecievedAt: currentTime,
      });
    }
    catch (error) {
      console.log(error)
    }
    return;
  }

  breakString(string){
    if (string.length > 7){
      return string.slice(0, 7)
    }
    return string
  }

  renameAndFormatSeries(name){
    if (!this.props.config['dashboard.rename']){
      return name
    }

    if (name.match(/(\d+)-([ABCD])/g)){
      const results = name.match(/(\d+)-([ABCD])/)
      const index = results[1];
      const sensor = results[2];
      return this.breakString(this.props.config['dashboard.rename'][index] || index) + sensor
    }
    else {
      return this.breakString(this.props.config['dashboard.rename'][name] || name)
    }
  }


  createXTickValues(minTimestamp, maxTimestamp){
    const delta_ts = moment(maxTimestamp, "x").diff(
      moment(minTimestamp, "x"),
      "hours"
    );
    const v = linspace(
      minTimestamp,
      maxTimestamp + 100000,
      7
    ).map((x) =>
      moment(Math.round(x), "x").startOf(delta_ts >= 16 ? "hour" : "minute")
    );
    return v

  }

  render() {
    let delta_ts = moment(this.state.maxTimestamp, "x").diff(
      moment(this.state.minTimestamp, "x"),
      "hours"
    );
    let axis_display_ts_format =
      delta_ts >= 16 ? (delta_ts >= 5 * 24 ? "MMM DD" : "dd HH:mm") : "H:mm";
    let tooltip_display_ts_format =
      delta_ts >= 16
        ? delta_ts >= 5 * 24
          ? "MMM DD HH:mm"
          : "dd HH:mm"
        : "H:mm";
    const ts = this.createXTickValues(this.state.minTimestamp, this.state.maxTimestamp)
    const VictoryVoronoiContainer = createContainer("voronoi");
    return (
      <Card style={{width: "100%", "height": "100%"}}>
        <VictoryChart
          title={this.props.title}
          domainPadding={10}
          padding={{ left: 70, right: 80, bottom: 50, top: 50 }}
          events={this.state.legendEvents}
          responsive={true}
          width={600}
          height={285}
          theme={VictoryTheme.material}
          containerComponent={
            <VictoryVoronoiContainer
              voronoiBlacklist={['parent']}
              labels={(d) => {
                return `${moment(d.datum.x, 'x').format(tooltip_display_ts_format)}
${this.renameAndFormatSeries(d.datum.childName)}: ${Math.round(d.datum.y * 1000) / 1000}`
              }}
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
            tickFormat={(mt) => mt.format(axis_display_ts_format)}
            tickValues={ts}
            style={{
              tickLabels: {
                fontSize: 13,
                padding: 5,
                fontFamily: "inherit",
              },
            }}
            offsetY={50}
            orientation="bottom"
          />
          <VictoryAxis
            crossAxis={false}
            dependentAxis
            domain={this.props.domain}
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
            x={515}
            y={35}
            symbolSpacer={10}
            itemsPerRow={10}
            name={"legend"}
            borderPadding={{ right: 8 }}
            orientation="vertical"
            cursor={"pointer"}
            style={{
              labels: { fontSize: 12 },
              data: { stroke: "#485157", strokeWidth: 1, size: 6 },
            }}
            data={this.state.names.map((name) => {
              const line = this.state.seriesMap[name];
              const item = {
                name: this.renameAndFormatSeries(line.name),
                symbol: { fill: line.color },
              };
              if (this.state.hiddenSeries.has(name)) {
                return { ...item, symbol: { fill: "white" } };
              }
              return item;
            })}
          />
          {Object.keys(this.state.seriesMap).map((name) => {
            if (this.state.hiddenSeries.has(name)) {
              return undefined;
            }
            return (
              <VictoryLine
                interpolation={this.props.interpolation}
                key={"line-" + name}
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
          })}
        </VictoryChart>
      </Card>
    );
  }
}

export default Chart;
