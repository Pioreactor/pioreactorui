import React from "react";
import { Client } from "paho-mqtt";
import Alert from '@material-ui/core/Alert';
import AlertTitle from '@material-ui/core/AlertTitle';

import Snackbar from '@material-ui/core/Snackbar';

function ErrorSnackbar(props) {
  var [open, setOpen] = React.useState(false)
  var [renamedUnit, setRenamedUnit] = React.useState("")
  var [unit, setUnit] = React.useState("")
  var [errorMsg, setErrorMsg] = React.useState("")
  var [task, setTask] = React.useState("")

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  React.useEffect(() => {
    if (!props.config['network.topology']){
      return
    }

    const onMessageArrived = (message) => {
      const payload = JSON.parse(message.payloadString)
      if (payload.level === "ERROR"){
        console.log(message)
        const unit = message.topic.split("/")[1]
        try {
          setRenamedUnit(props.config['ui.rename'][unit])
        }
        catch {}
        setErrorMsg(payload.message)
        setTask(payload.task)
        setUnit(unit)
        setOpen(true)
      }

    }

    const onSuccess = () => {
      client.subscribe(
      [
        "pioreactor",
        "+",
        "+",
        "logs",
        "+"
      ].join("/"),
      { qos: 1 }
      )
    }

    var client
    if (props.config.remote && props.config.remote.ws_url) {
      client = new Client(
        `ws://${props.config.remote.ws_url}/`,
        "webui_TactileButtonNotification" + Math.random()
      )}
    else {
      client = new Client(
        `${props.config['network.topology']['leader_address']}`, 9001,
        "webui_TactileButtonNotification" + Math.random()
      );
    }
    client.connect({onSuccess: onSuccess, timeout: 180, reconnect: true});
    client.onMessageArrived = onMessageArrived;

  },[props.config])

  return (
    <Snackbar
      open={open}
      onClose={handleClose}
      anchorOrigin={{vertical: "bottom", horizontal: "right"}}
      key={"error-snackbar"}
      autoHideDuration={7000}
    >
    <Alert severity="error" variant="filled">
      <AlertTitle style={{fontSize: 15}}>{task} error in {unit + (renamedUnit ? " / " + renamedUnit : "")}</AlertTitle>
      {errorMsg}
    </Alert>
    </Snackbar>
)}

export default ErrorSnackbar;
