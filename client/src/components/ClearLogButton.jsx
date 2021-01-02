import React from "react";
import { Client, Message } from "paho-mqtt";
import Button from "@material-ui/core/Button";



function ClearLogButton(props){


  function onClick() {
    var client = new Client(
      "ws://pioreactorws.ngrok.io/",
      "client" + Math.random()
    );
    client.connect({onSuccess: () => {
      var message = new Message("");
      message.destinationName = [
        "pioreactor",
        "leader",
        "$experiment",
        "log_aggregating",
        "aggregated_log_table",
        "set",
      ].join("/");
      message.qos = 2;
      client.publish(message);
      window.location.reload();
      return false
    }});
  }

  return (
    <Button color="primary" style={{textTransform: "none"}} onClick={onClick}> Clear log table </Button>
)}


export default ClearLogButton;
