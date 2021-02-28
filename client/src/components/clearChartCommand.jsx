import { Client, Message } from "paho-mqtt";

function clearChartCommand(props) {
  var client
  if (props.config.remote && props.config.remote.ws_url) {
    client = new Client(
      `ws://${props.config.remote.ws_url}/`,
      "webui_ClearChartButton" + Math.random()
    )}
  else {
    client = new Client(
      `${props.config['network.topology']['leader_address']}`, 9001,
      "webui_ClearChartButton" + Math.random()
    );
  }
  client.connect({onSuccess: () => {
    for (var jobName of ['od_raw', 'od_filtered', 'growth_rate', 'alt_media_fraction']) {
      var message = new Message("");

      message.destinationName = [
        "pioreactor",
        props.config['network.topology']['leader_hostname'],
        "$experiment",
        `${jobName}_time_series_aggregating`,
        "aggregated_time_series",
        "set",
      ].join("/");

      client.publish(message);
    }
  }});
}


export default clearChartCommand