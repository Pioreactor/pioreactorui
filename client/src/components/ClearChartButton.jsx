import React from "react";
import { Client, Message } from "paho-mqtt";
import Button from "@material-ui/core/Button";



function ClearChartButton(props){


  function onClick() {
    var client = new Client(
      "ws://pioreactorws.ngrok.io/",
      "client" + Math.random()
    );
    client.connect({onSuccess: () => {
      for (var jobName of ['od_raw', 'od_filtered', 'growth_rate', 'alt_media_fraction']) {
        var message = new Message("");

        message.destinationName = [
          "pioreactor",
          "leader",
          props.experiment,
          `${jobName}_time_series_aggregating`,
          "aggregated_time_series",
          "set",
        ].join("/");

        message.qos = 2;
        client.publish(message);
      }

      window.location.reload();
      return false
    }});
  }

  return (
    <Button onClick={onClick}> Clear chart data </Button>
)}


export default ClearChartButton;
