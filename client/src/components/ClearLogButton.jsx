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
    if (props.config.remote.ws_url) {
      var client = new Client(
        `ws://${props.config.remote.ws_url}/`,
        "webui_ClearLogButton" + Math.random()
      )}
    else {
      var client = new Client(
        `${props.config['network.topology']['leader_address']}`, 9001,
        "webui_ClearLogButton" + Math.random()
      );
    }
    client.connect({timeout: 180, onSuccess: () => {
      var message = new Message("");
      message.destinationName = [
        "pioreactor",
        props.config['network.topology']['leader_hostname'],
        "$experiment",
        "log_aggregating",
        "aggregated_log_table",
        "set",
      ].join("/");
      client.publish(message);
      window.location.reload();
      return false
    }});
  }

  return (
    <Button color="primary" style={{textTransform: "none"}} onClick={onClick}> <ClearIcon className={classes.textIcon}/>  Clear log table </Button>
)}


export default ClearLogButton;
