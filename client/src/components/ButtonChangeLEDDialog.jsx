import React, { useState, useEffect } from "react";

import { Client, Message } from "paho-mqtt";

import { makeStyles } from "@material-ui/styles";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormLabel from '@material-ui/core/FormLabel';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import PioreactorIcon from "./PioreactorIcon"


const useStyles = makeStyles((theme) => ({
  textFieldCompact: {
    marginTop: theme.spacing(3),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(0),
    width: "30ch",
  },
  formControl: {
    marginTop: theme.spacing(2)
  },
  unitTitle: {
    fontSize: 17,
    color: "rgba(0, 0, 0, 0.87)",
  },
  unitTitleDialog :{
    fontSize: 20,
    color: "rgba(0, 0, 0, 0.87)",
  },
  suptitle: {
    fontSize: "13px",
    color: "rgba(0, 0, 0, 0.60)",
  },
}));

function SilentForm(props){
  const classes = useStyles();
  const defaults = {duration: 60}

  useEffect(() => {
    props.updateParent(defaults)
  }, [])


  const onSettingsChange = (e) => {
    props.updateParent({[e.target.id]: e.target.value})
  }

  return (
      <TextField
        size="small"
        id="duration"
        label="Duration between events"
        defaultValue={defaults.duration}
        InputProps={{
          endAdornment: <InputAdornment position="end">min</InputAdornment>,
        }}
        variant="outlined"
        onChange={onSettingsChange}
        className={classes.textFieldCompact}
      />
)}


function ButtonChangeLEDDialog(props) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [algoSettings, setAlgoSettings] = useState({led_automation: "silent"})
  const [isClicked, setIsClicked] = useState(false)
  const [client, setClient] = useState(null)

  const algos = [
    {name: "Silent", key: "silent"},
  ]

  useEffect(() => {
    // MQTT - client ids should be unique
    if (!props.config['network.topology']){
      return
    }

    if (props.config.remote && props.config.remote.ws_url) {
      var client = new Client(
        `ws://${props.config.remote.ws_url}/`,
        "webui_ButtonChangeLEDDialog" + Math.random()
      )}
    else {
      var client = new Client(
        `${props.config['network.topology']['leader_address']}`, 9001,
        "webui_ButtonChangeLEDDialog" + Math.random()
      );
    }

    client.connect({timeout: 180});
    setClient(client)
  },[props.config])

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleAlgoSelectionChange = (e) => {
    setAlgoSettings({led_automation: e.target.value})
  }

  const updateFromChild = (setting) => {
    setAlgoSettings(prevState => ({...prevState, ...setting}))
  }

  const switchToForm = () => {
    switch(algoSettings.led_automation) {
      case "silent":
        return <SilentForm updateParent={updateFromChild}/>
    }
  }

  const onSubmit = (event) => {
    event.preventDefault()
    setIsClicked(true)
    var message = new Message(JSON.stringify(algoSettings));
    message.destinationName = [
      "pioreactor",
      props.unit,
      props.experiment,
      "led_control",
      "led_automation",
      "set",
    ].join("/");
    message.qos = 2;
    try{
      client.publish(message);
    }
    catch (e){
      console.log(e)
    }
    setOpen(false);
  }
  return (
    <div>
    <Button
      style={{marginTop: "10px"}}
      size="small"
      color="primary"
      disabled={!props.currentLEDautomation}
      onClick={handleClickOpen}
    >
      Change LED automation
    </Button>
    <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title" PaperProps={{style: {height: "100%"}}}>
      <DialogTitle>
        <Typography className={classes.suptitle}>
          <PioreactorIcon style={{verticalAlign: "middle", fontSize: "1.2em"}}/> {props.title || ((props.config['ui.overview.rename'] && props.config['ui.overview.rename'][props.unit]) ? `${props.config['ui.overview.rename'][props.unit]} (${props.unit})` : `${props.unit}`)}
        </Typography>
        <Typography className={classes.unitTitleDialog}>
          LED automation
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" component="p" gutterBottom>
          LED automations control when and how much media to add to the Pioreactor. The settings below can be changed later. Learn more about <a target="_blank" href="https://github.com/Pioreactor/pioreactor/wiki/LED-automations">led automations</a>.
        </Typography>

        <form>
          <FormControl component="fieldset" className={classes.formControl}>
          <FormLabel component="legend">automation</FormLabel>
            <Select
              native
              value={algoSettings.mode}
              onChange={handleAlgoSelectionChange}
              style={{maxWidth: "200px"}}
            >
              {algos.map((v) => {
                return <option id={v.key} value={v.key} key={"change-io" + v.key}>{v.name}</option>
                }
              )}
            </Select>
            {switchToForm()}
            <Button
              type="submit"
              variant="contained"
              color={isClicked ? "default" : "primary" }
              onClick={onSubmit}
              style={{width: "120px", marginTop: "20px"}}
            >
              Submit
            </Button>
          </FormControl>
        </form>


      </DialogContent>
    </Dialog>
    </div>
)}


export default ButtonChangeLEDDialog;
