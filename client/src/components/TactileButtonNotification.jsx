import React from "react";
import { Client } from "paho-mqtt";
import { Alert, AlertTitle } from '@material-ui/lab';

import Snackbar from '@material-ui/core/Snackbar';

function TactileButtonNotification(props) {
  var [unit, setUnit] = React.useState("")
  var [renamedUnit, setRenamedUnit] = React.useState("")
  var [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (!props.config['network.topology']){
      return
    }

    const onMessageArrived = (msg) => {
      if (msg.payloadString === "1"){
        var unit = msg.topic.split("/")[1]
        setUnit(unit)
        try {
          setRenamedUnit(props.config['ui.overview.rename'][unit])
        }
        catch {}
        setOpen(true)
      }
      else {
        setOpen(false)
      }
    }

    const onSuccess = () => {
      console.log("tb success")
      client.subscribe(
      [
        "pioreactor",
        "+",
        "$experiment",
        "monitor",
        "button_down"
      ].join("/"),
      { qos: 1 }
      )
    }

    var client = null
    if (props.config.remote) {
      client = new Client(
        `ws://${props.config.remote.ws_url}/`,
        "webui" + Math.random()
      )}
    else {
      client = new Client(
        `${props.config['network.topology']['leader_hostname']}.local`, 9001,
        "webui" + Math.random()
      );
    }
    client.connect({onSuccess: onSuccess, timeout: 180});
    client.onMessageArrived = onMessageArrived;

  },[props.config])

  return (
    <Snackbar
      open={open}
      autoHideDuration={null}
      onClose={() => {}}
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      key={"button-tactile-snackbar"}
      transitionDuration={{enter: 10}}
    >
    <Alert severity="info" variant="filled" icon={false}>
      <AlertTitle style={{fontSize: 25}}>{unit + (renamedUnit ? " / " + renamedUnit : "")}</AlertTitle>
      Holding <b>{unit}</b>'s button down
    </Alert>
    </Snackbar>
)}

export default TactileButtonNotification;
