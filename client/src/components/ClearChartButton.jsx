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


function ClearChartButton(props){
  const classes = useStyles();


  function onClick() {
    if (props.config.remote) {
      var client = new Client(
        `ws://${props.config.remote.ws_url}/`,
        "webui" + Math.random()
      )}
    else {
      var client = new Client(
        `${props.config['network.topology']['leader_hostname']}.local`, 9001,
        "webui" + Math.random()
      );
    }
    client.connect({timeout: 180, onSuccess: () => {
      for (var jobName of ['od_raw', 'od_filtered', 'growth_rate', 'alt_media_fraction']) {
        var message = new Message("");

        message.destinationName = [
          "pioreactor",
          "leader",
          "$experiment",
          `${jobName}_time_series_aggregating`,
          "aggregated_time_series",
          "set",
        ].join("/");

        client.publish(message);
      }

      window.location.reload();
      return false
    }});
  }

  return (
    <Button color="primary" style={{textTransform: "none"}} onClick={onClick}><ClearIcon className={classes.textIcon}/> Clear chart data </Button>
)}


export default ClearChartButton;
