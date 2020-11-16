import React from "react";
import { Client, Message } from "paho-mqtt";
import Button from "@material-ui/core/Button";



function ClearChartButton(props){


  function onClick() {
    var client = new Client(
      "ws://morbidostatws.ngrok.io/",
      "client" + Math.random()
    );
    client.connect({onSuccess: () => {
      var message = new Message("");
      message.destinationName = [
        "morbidostat",
        "leader",
        props.experiment,
        "time_series_aggregating",
        "aggregated_time_series",
        "set",
      ].join("/");
      console.log(message.destinationName)
      console.log(message.message)
      // not working?
      message.qos = 2;
      client.publish(message);
      window.location.reload();
      return false
    }});
  }

  return (
    <Button onClick={onClick}> Clear chart data </Button>
)}


export default ClearChartButton;
