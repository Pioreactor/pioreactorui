import React from "react";
import { Client, Message } from "paho-mqtt";
import ClearIcon from '@material-ui/icons/Clear';
import Button from "@material-ui/core/Button";
import { makeStyles } from '@material-ui/core/styles';


const useStyles = makeStyles((theme) => ({
  textIcon: {
    fontSize: 15,
    verticalAlign: "middle",
    margin: "0px 3px"
  },
}))


function ClearLogButton(props){
  const classes = useStyles();


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
    <Button color="primary" style={{textTransform: "none"}} onClick={onClick}> <ClearIcon className={classes.textIcon}/>  Clear log table </Button>
)}


export default ClearLogButton;
