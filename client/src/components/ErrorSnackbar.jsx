import React from "react";
import { Client } from "paho-mqtt";
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';

import Snackbar from '@mui/material/Snackbar';

function ErrorSnackbar(props) {
  var [open, setOpen] = React.useState(false)
  var [renamedUnit, setRenamedUnit] = React.useState("")
  var [unit, setUnit] = React.useState("")
  var [msg, setMsg] = React.useState("")
  var [level, setLevel] = React.useState("error")
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

      if ((payload.level === "ERROR" || payload.level === "WARNING") && (!message.topic.endsWith("/ui"))){
        const unit = message.topic.split("/")[1]
        try {
          setRenamedUnit(props.config['ui.rename'][unit])
        }
        catch {}
        setMsg(payload.message)
        setTask(payload.task)
        setLevel(payload.level)
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
        "webui_ErrorSnackbarNotification" + Math.random()
      )}
    else {
      client = new Client(
        `${props.config['network.topology']['leader_address']}`, 9001,
        "webui_ErrorSnackbarNotification" + Math.random()
      );
    }
    client.connect({onSuccess: onSuccess, timeout: 180, reconnect: true});
    client.onMessageArrived = onMessageArrived;

  },[props.config])

  return (
    <Snackbar
      open={open}
      anchorOrigin={{vertical: "bottom", horizontal: "right"}}
      key={"error-snackbar"}
      autoHideDuration={11000}
      style={{maxWidth: "500px"}}
      onClose={handleClose}
    >
    <Alert variant="standard" severity={level.toLowerCase()} onClose={handleClose}>
      <AlertTitle style={{fontSize: 15}}>{task} encountered the following {level.toLowerCase()} in {unit + (renamedUnit ? " / " + renamedUnit : "")}</AlertTitle>
      <span style={{whiteSpace: 'pre-wrap'}}>{msg}</span>
    </Alert>
    </Snackbar>
)}

export default ErrorSnackbar;
