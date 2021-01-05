import React from "react";
import { Client } from "paho-mqtt";
import { Alert, AlertTitle } from '@material-ui/lab';

import Snackbar from '@material-ui/core/Snackbar';

function TactileButtonNotification(props) {
  var [unit, setUnit] = React.useState("")
  var [renamedUnit, setRenamedUnit] = React.useState("")
  var [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onMessageArrived = (msg) => {
      if (msg.payloadString === "1"){
        console.log("here")
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
      client.subscribe(
      [
        "pioreactor",
        "+",
        "+",
        "monitor",
        "button_down"
      ].join("/"),
      { qos: 1 }
      )
    }

    const client = new Client(
      "leader.local", 9001,
      "webui" + Math.random()
    );
    client.connect({onSuccess: onSuccess});
    client.onMessageArrived = onMessageArrived;

  },[])


  return (
    <Snackbar
      open={open}
      autoHideDuration={null}
      onClose={() => {}}
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      key={"button-tactile-snackbar"}
    >
    <Alert severity="info" variant="filled" icon={false}>
      <AlertTitle style={{fontSize: 25}}>{unit + (renamedUnit ? " / " + renamedUnit : "")}</AlertTitle>
      Holding <b>{unit}</b>'s button down
    </Alert>
    </Snackbar>
)}

export default TactileButtonNotification;
