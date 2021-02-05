import clsx from 'clsx';
import { Client, Message } from "paho-mqtt";

import React, {useState, useEffect} from "react";

import Grid from '@material-ui/core/Grid';
import Header from "./components/Header"
import PropTypes from 'prop-types';

import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import {Typography} from '@material-ui/core';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import CircularProgress from '@material-ui/core/CircularProgress';
import Slider from '@material-ui/core/Slider';
import Snackbar from '@material-ui/core/Snackbar';
import TextField from '@material-ui/core/TextField';
import InputAdornment from '@material-ui/core/InputAdornment';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Button from "@material-ui/core/Button";
import AddIcon from '@material-ui/icons/Add';
import ClearIcon from '@material-ui/icons/Clear';
import EditIcon from '@material-ui/icons/Edit';
import IconButton from '@material-ui/core/IconButton';
import FlareIcon from '@material-ui/icons/Flare';
import SettingsIcon from '@material-ui/icons/Settings';

import {parseINIString} from "./utilities"
import ButtonChangeDosingDialog from "./components/ButtonChangeDosingDialog"
import ButtonChangeLEDDialog from "./components/ButtonChangeLEDDialog"
import ActionDosingForm from "./components/ActionDosingForm"
import ActionLEDForm from "./components/ActionLEDForm"
import PioreactorIcon from "./components/PioreactorIcon"
import TactileButtonNotification from "./components/TactileButtonNotification";


const onlineGreen = "#4caf50"
const offlineGrey = "grey"
const errorRed = "#DE3618"

const useStyles = makeStyles((theme) => ({
  textIcon: {
    fontSize: 15,
    verticalAlign: "middle",
    margin: "0px 3px"
  },
  pioreactorCard: {
    marginTop: "0px",
    marginBottom: "20px",
  },
  cardContent: {
    padding: "10px 20px 20px 20px"
  },
  unitTitle: {
    fontSize: 20,
    color: "rgba(0, 0, 0, 0.87)",
    fontWeight: 500,
  },
  unitTitleDialog :{
    fontSize: 20,
    color: "rgba(0, 0, 0, 0.87)",
  },
  suptitle: {
    fontSize: "13px",
    color: "rgba(0, 0, 0, 0.60)",
  },
  disabledText: {
    color: "rgba(0, 0, 0, 0.38)",
  },
  textbox:{
    width: "130px",
  },
  textboxLabel:{
    width: "100px",
  },
  footnote: {
    marginBottom: 0,
    fontSize: 12,
  },
  textField: {
    marginTop: "15px",
    maxWidth: "180px",
  },
  textFieldWide: {
    marginTop: "15px",
    maxWidth: "220px",
  },
  textFieldCompact: {
    marginTop: theme.spacing(3),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(0),
    width: "30ch",
  },
  slider: {
    width: "70%",
    margin: "40px auto 0px auto",
  },
  divider: {
    marginTop: 15,
    marginBottom: 10,
  },
}));

function TabPanel(props) {
  // move me
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
          <div>{children}</div>
      )}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.any.isRequired,
  value: PropTypes.any.isRequired,
};


class UnitSettingDisplay extends React.Component {
  // this class polls the MQTT broker for state
  constructor(props) {
    super(props);
    this.state = { msg: this.props.default };
    this.onConnect = this.onConnect.bind(this);
    this.onMessageArrived = this.onMessageArrived.bind(this);
    this.MQTTConnect();
  }

  updateParent(data) {
    try {
      this.props.passChildData(data);
    } catch (e) {}
  }

  MQTTConnect() {
    // need to have unique clientIds
    if (this.props.config.remote) {
      this.client = new Client(
        `ws://${this.props.config.remote.ws_url}/`,
        "webui_UnitSettingDisplay" + Math.random()
      )}
    else {
      this.client = new Client(
        `${this.props.config['network.topology']['leader_address']}`, 9001,
        "webui_UnitSettingDisplay" + Math.random()
      );
    }
    this.client.connect({ onSuccess: this.onConnect, timeout: 180});
    this.client.onMessageArrived = this.onMessageArrived;
  }

  onConnect() {
    this.client.subscribe(
      [
        "pioreactor",
        this.props.unit,
        this.props.experiment,
        this.props.topic,
      ].join("/"),
      { qos: 1 }
    );
  }

  stateDisplay = {
    "init":          {display: "Starting", color: onlineGreen},
    "ready":         {display: "On", color: onlineGreen},
    "sleeping":      {display: "Paused", color: offlineGrey},
    "disconnected":  {display: "Off", color: offlineGrey},
    "lost":          {display: "Lost", color: errorRed},
    "NA":            {display: "Not available", color: offlineGrey},
  }

  onMessageArrived(message) {
    var parsedFloat = parseFloat(message.payloadString);
    var payload = isNaN(parsedFloat) ? message.payloadString : parsedFloat
    this.setState({
      msg: payload,
    });
    this.updateParent(payload);
  }

  render() {
    if (this.props.isStateSetting) {
      if (!this.props.isUnitActive) {
        return <div style={{ color: offlineGrey, fontWeight: 500}}> {this.stateDisplay[this.state.msg].display} </div>;
      } else {
        var displaySettings = this.stateDisplay[this.state.msg]
        return (
          <div style={{ color: displaySettings.color, fontWeight: 500}}>
            {displaySettings.display}
          </div>
      )}
    } else {
      if (!this.props.isUnitActive || this.state.msg === "—" || this.state.msg === "") {
        return <div style={{ color: offlineGrey, fontSize: "13px"}}> {this.props.default} </div>;
      } else {
        return (
          <div style={{ fontSize: "13px"}}>
            {(typeof this.state.msg === "string"
              ? this.state.msg
              : +this.state.msg.toFixed(this.props.precision)) +
              (this.props.measurementUnit ? this.props.measurementUnit : "")}
          </div>
        );
      }
    }
  }
}



function ButtonConfirmStopProcessDialog() {
  const classes = useStyles();
  const [open, setOpen] = useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const onConfirm = () => {
    fetch("/stop")
    handleClose()
  }

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <React.Fragment>
      <Button style={{textTransform: 'none', marginRight: "10px", float: "right"}} color="secondary" onClick={handleClickOpen}>
        <ClearIcon className={classes.textIcon}/> Stop all activity
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Stop all Pioreactor activity?"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            This will stop all activies (stirring, dosing, optical density reading, etc.) in <b>all</b> Pioreactor units. Do you wish to stop all activities?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onConfirm} color="primary">
            Confirm
          </Button>
          <Button onClick={handleClose} color="secondary" autoFocus>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}


function AddNewPioreactor(props){
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [name, setName] = React.useState("");
  const [isRunning, setIsRunning] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState("")
  const [isError, setIsError] = React.useState("")

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false)
  }

  const handleNameChange = evt => {
    setName(evt.target.value)
  }

  const onSubmit = (event) =>{
    event.preventDefault()
    if (!name) {
      setIsError(true)
      setErrorMsg("Fill in the new name.")
      return
    }
    setIsError(false)
    setIsRunning(true)
    fetch('add_new_pioreactor',{
        method: "POST",
        body: JSON.stringify({newPioreactorName: name}),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
    })
    .then(response => {
        if(!response.ok){
          throw new Error('Something went wrong.');
        }
    })
    .catch(error => {
      setIsError(true)
      setErrorMsg("Unable to complete installation. Check server logs.")
      setIsRunning(false)
    });
  }

  const runningFeedback = isRunning ? <CircularProgress color="inherit" size={24}/> : "Install and connect"

  return (
    <React.Fragment>
    <Button onClick={handleClickOpen} style={{textTransform: 'none', float: "right", marginRight: "0px"}} color="primary">
      <AddIcon className={classes.textIcon}/> Add new Pioreactor
    </Button>
    <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
      <DialogTitle>
        <Typography className={classes.unitTitleDialog}>
        Add new Pioreactor
        </Typography>
      </DialogTitle>
      <DialogContent>
      <p> To add a new Pioreactor, you'll need the following: </p>
      <ul>
        <li>A RaspberryPi, with power cord</li>
        <li>A microSD card</li>
        <li>A computer with internet access that can read & write to the microSD card</li>
        <li>The Pioreactor hardware hat</li>
      </ul>
      <p> With that all ready, let's begin: </p>
      <ol>
        <li>Flash the Raspberry Pi OS Lite onto the microSD card. Here's a <a href="https://www.youtube.com/watch?v=J024soVgEeM">short video</a> on how.</li>
        <li>Remove the microSD card, and put it <b>back in</b>.</li>
        <li>Onto the microSD card, create an empty file named <code>ssh</code>.</li>
        <li>Also onto the microSD card, create a file named <code>wpa_supplicant.conf</code>, with the following contents:</li>
        <pre style={{border: "1px #b9b9b9 solid", padding: "5px 10px", maxWidth: "85%"}}>
{`country=CA # Your 2-digit country code, ex: US, GB, CA
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
network={
    ssid="your network name"
    psk="your network password"
    key_mgmt=WPA-PSK
}`}
       </pre>
        <li>Unmount the microSD, insert it into the RaspberryPi, and attach the Pioreactor hat to the RaspberryPi.</li>
        <li>Turn on the RaspberryPi by inserting the power cord.</li>
      </ol>

      <p>We're pretty much done at this point. Below, provide a unique name for your new Pioreactor, and
      we'll automatically install the required software and connect it to the other Pioreactors.
      </p>

      <p>It will take up to 5 minutes to install the software. When finished, the new Pioreactor
      will show up on on this page. You don't need to stay on this page while it's installing.</p>

      {isRunning? <p><b>Installation is occuring in the background. You may navigate away from this page. </b></p> : <p></p>}
      {isError? <p><b>{errorMsg}</b></p> : <p></p>}

      <div >
        <TextField
          size="small"
          id="new-pioreactor-name"
          label="Provide a name"
          variant="outlined"
          className={classes.textFieldWide}
          onChange={handleNameChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PioreactorIcon style={{fontSize: "1.1em"}}/>
              </InputAdornment>
            ),
          }}
        />
      </div>
      <Button
        variant="contained"
        color="primary"
        style={{marginTop: "15px"}}
        onClick={onSubmit}
        type="submit"
      >
        {runningFeedback}
      </Button>

      </DialogContent>
    </Dialog>
    <Snackbar
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      open={snackbarOpen}
      onClose={handleSnackbarClose}
      message={"Installing new Pioreactor"}
      autoHideDuration={7000}
      key={"snackbar-add-new"}
    />
    </React.Fragment>
)}



function PioreactorHeader(props) {

  return (
    <div>
      <div style={{display: "flex", justifyContent: "space-between", marginBottom: "5px"}}>
        <Typography variant="h5" component="h1">
          <Box fontWeight="fontWeightBold">
            Pioreactors
          </Box>
        </Typography>
        <div >
          <SettingsActionsDialogAll unit={'$broadcast'} config={props.config} experiment={props.experiment}/>
          <AddNewPioreactor config={props.config}/>
          <ButtonConfirmStopProcessDialog/>
        </div>
      </div>
      <Divider/>
    </div>
  )
}



function PatientButton(props) {
  const [buttonText, setButtonText] = useState(props.buttonText)

  useEffect(
    () => {
      setButtonText(props.buttonText)
    }
  , [props.buttonText])

  function wrappingOnClick() {
    function f() {
      setButtonText(<CircularProgress color="inherit" size={22}/>)
      props.onClick()
    }
    return f
  }

  return (
    <Button
      disableElevation
      style={{width: "70px", marginTop: "5px"}}
      color={props.color}
      variant={props.variant}
      size="small"
      onClick={wrappingOnClick()}
    >
      {buttonText}
    </Button>
  )
}



function SettingsActionsDialog(props) {
  const classes = useStyles();
  const [defaultStirring, setDefaultStirring] = useState(0);
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [tabValue, setTabValue] = React.useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  useEffect(() => {
    async function fetchData() {
      await fetch("/get_config/config_" + props.unit + ".ini")
        .then((response) => {
            if (response.ok) {
              return response.text();
            } else {
              throw new Error('Something went wrong');
            }
          })
        .then((config) => {
          config = parseINIString(config);
          setDefaultStirring(
            config["stirring"]["duty_cycle_" + props.unit]
          );
        })
        .catch((error) => {})
    }
    if (!props.disabled) {
      fetchData();
    }
  }, [props.disabled, props.unit]);

  useEffect(() => {
    if (!props.config['network.topology']){
      return
    }
    if (props.config.remote) {
      var client = new Client(
        `ws://${props.config.remote.ws_url}/`,
        "webui_SettingsActionsDialog" + Math.random()
      )}
    else {
      var client = new Client(
        `${props.config['network.topology']['leader_address']}`, 9001,
        "webui_SettingsActionsDialog" + Math.random()
      );
    }
    client.connect({timeout: 180});
    setClient(client)
  },[props.config])


  function setPioreactorJobState(job, state) {
    return function sendMessage() {
      var message = new Message(String(state));
      message.destinationName = [
        "pioreactor",
        props.unit,
        props.experiment,
        job,
        "$state",
        "set",
      ].join("/");
      message.qos = 1;
      try{
        client.publish(message);
      }
      catch (e){
        console.log(e)
        setTimeout(() => {sendMessage()}, 750)
      }
    };
  }

  function startPioreactorJob(job_attr){
    return function() {
      fetch("/run/" + job_attr + "/" + props.unit).then(res => {
      })
    }
  }

  function setPioreactorJobAttr(job_attr, value) {
    var message = new Message(String(value));
    message.destinationName = [
      "pioreactor",
      props.unit,
      props.experiment,
      job_attr,
      "set",
    ].join("/");
    message.qos = 1;
    try{
      client.publish(message);
    }
    catch (e) {
      console.log(e)
      client.connect({onSuccess: () => setPioreactorJobAttr(job_attr, value)});
    }
  }

  function setPioreactorJobAttrOnEnter(e) {
    if (e.key === "Enter") {
      setPioreactorJobAttr(e.target.id, e.target.value);
      setSnackbarMessage(`Updated to ${e.target.value}.`)
      setSnackbarOpen(true)
    }
  }

  function setPioreactorStirring(e, value) {
    setPioreactorJobAttr("stirring/duty_cycle", value);
  }


  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setTabValue(0)
    setOpen(false);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false)
  }


  function createUserButtonsBasedOnState(jobState, job, parentJob=null){

    parentJob = parentJob || job
    switch (jobState){
      case "lost":
      case "disconnected":
       return (<div>
               <PatientButton
                color="primary"
                variant="contained"
                onClick={startPioreactorJob(parentJob)}
                buttonText="Start"
               />
              </div>)
      case "init":
      case "ready":
        return (<div>
          <PatientButton
            color="secondary"
            variant="contained"
            onClick={setPioreactorJobState(job, "sleeping")}
            buttonText="Pause"
          />
          <PatientButton
            color="secondary"
            onClick={setPioreactorJobState(parentJob, "disconnected")}
            buttonText="Stop"
          />
        </div>)
      case "sleeping":
        return (
          <div>
            <PatientButton
              color="primary"
              variant="contained"
              onClick={setPioreactorJobState(job, "ready")}
              buttonText="Resume"
            />
            <PatientButton
              color="secondary"
              onClick={setPioreactorJobState(parentJob, "disconnected")}
              buttonText="Stop"
            />
          </div>
          )
      default:
        return(<div></div>)
    }
   }

  const stirringButtons = createUserButtonsBasedOnState(props.stirringJobState, "stirring")
  const odButtons = createUserButtonsBasedOnState(props.ODReadingJobState, "od_reading")
  const grButtons = createUserButtonsBasedOnState(props.growthRateJobState, "growth_rate_calculating")
  const dosingButtons = createUserButtonsBasedOnState(props.dosingControlJobState, "dosing_algorithm", "dosing_control")
  const ledButtons = createUserButtonsBasedOnState(props.ledControlJobState, "led_algorithm", "led_control")
  const invertedLEDMap = Object.fromEntries(Object.entries(props.config['leds']).map(([k, v]) => [v, k]))

  return (
    <div>
    <Button style={{textTransform: 'none', float: "right" }} disabled={props.disabled} onClick={handleClickOpen} color="primary">
      <EditIcon color={props.disabled ? "disabled" : "primary"} className={classes.textIcon}/> Edit
    </Button>
    <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
      <DialogTitle>
        <Typography className={classes.suptitle}>
          <PioreactorIcon style={{verticalAlign: "middle", fontSize: "1.2em"}}/> {(props.config['ui.overview.rename'] &&  props.config['ui.overview.rename'][props.unit]) ? `${props.config['ui.overview.rename'][props.unit]} / ${props.unit}` : `${props.unit}`}
        </Typography>
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        indicatorColor="primary"
        textColor="primary"
        variant="scrollable"
        scrollButtons="auto"
        >
        <Tab label="Activities"/>
        <Tab label="Settings"/>
        <Tab label="Dosing"/>
        <Tab label="LEDs"/>
      </Tabs>
      </DialogTitle>
      <DialogContent>
        <TabPanel value={tabValue} index={2}>
          <Typography  gutterBottom>
            Add media
          </Typography>
          <Typography variant="body2" component="p">
            Run the media pump{props.isPlural ? "s" : ""} for a set duration (seconds), or a set volume (mL).
          </Typography>
          <ActionDosingForm action="add_media" unit={props.unit} />
          <Divider className={classes.divider} />
          <Typography gutterBottom>
            Add alternative media
          </Typography>
          <Typography variant="body2" component="p">
            Run the alternative media pump{props.isPlural ? "s" : ""} for a set duration (seconds), or a set
            volume (mL).
          </Typography>
          <ActionDosingForm action="add_alt_media" unit={props.unit} />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Remove waste
          </Typography>
          <Typography variant="body2" component="p">
            Run the waste pump{props.isPlural ? "s" : ""} for a set duration (seconds), or a set volume (mL).
          </Typography>
          <ActionDosingForm action="remove_waste" unit={props.unit} />
          <Divider className={classes.divider} />
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          <Typography className={clsx(classes.suptitle)} color="textSecondary">
            {(invertedLEDMap['A']) ? "Channel A" : ""}
          </Typography>
          <Typography style={{textTransform: "capitalize"}}>
            {(invertedLEDMap['A']) ? (invertedLEDMap['A'].replace("_", " ").replace("led", "LED")) : "Channel A" }
          </Typography>
          <ActionLEDForm channel="A" unit={props.unit} />
          <Divider className={classes.divider} />

          <Typography className={clsx(classes.suptitle)} color="textSecondary">
            {(invertedLEDMap['B']) ? "Channel B" : ""}
          </Typography>
          <Typography style={{textTransform: "capitalize"}}>
            {(invertedLEDMap['B']) ? (invertedLEDMap['B'].replace("_", " ").replace("led", "LED")) : "Channel B" }
          </Typography>
          <ActionLEDForm channel="B" unit={props.unit} />
          <Divider className={classes.divider} />

          <Typography className={clsx(classes.suptitle)} color="textSecondary">
            {(invertedLEDMap['C']) ? "Channel C" : ""}
          </Typography>
          <Typography style={{textTransform: "capitalize"}}>
            {(invertedLEDMap['C']) ? (invertedLEDMap['C'].replace("_", " ").replace("led", "LED")) : "Channel C" }
          </Typography>
          <ActionLEDForm channel="C" unit={props.unit} />
          <Divider className={classes.divider} />

          <Typography className={clsx(classes.suptitle)} color="textSecondary">
            {(invertedLEDMap['D']) ? "Channel D" : ""}
          </Typography>
          <Typography style={{textTransform: "capitalize"}}>
            {(invertedLEDMap['D']) ? (invertedLEDMap['D'].replace("_", " ").replace("led", "LED")) : "Channel D" }
          </Typography>
          <ActionLEDForm channel="A" unit={props.unit} />

          <Divider className={classes.divider} />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <Typography  gutterBottom>
            Stirring speed
          </Typography>
          <Typography variant="body2" component="p">
            Modify the stirring speed (arbitrary units). This will effect the
            optical density reading. Too low and the fan may completely stop.
          </Typography>
          <div className={classes.slider}>
            <Slider
              defaultValue={parseInt(props.stirringDCState)}
              aria-labelledby="discrete-slider-custom"
              step={1}
              valueLabelDisplay="on"
              id={"stirring/duty_cycle_" + props.unit}
              key={"stirring/duty_cycle_" + props.unit}
              onChangeCommitted={setPioreactorStirring}
              marks={[
                { value: 0, label: "0", key: "slider-0" },
                { value: defaultStirring, label: "Default: " + defaultStirring, key: "slider-default"},
                { value: 100, label: "100", key: "slider-100" },
              ]}
            />
          </div>
          <Divider className={classes.divider} />
          <Typography gutterBottom>
            Volume / dosing
          </Typography>
          <Typography variant="body2" component="p">
            Change the volume per dilution. Typical values are between 0.0mL and
            1.0mL.
          </Typography>
          <TextField
            size="small"
            id="dosing_algorithm/volume"
            label="Volume / dosing"
            defaultValue={props.volumeState}
            InputProps={{
              endAdornment: <InputAdornment position="end">mL</InputAdornment>,
            }}
            variant="outlined"
            onKeyPress={setPioreactorJobAttrOnEnter}
            className={classes.textFieldWide}
          />

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Target OD
          </Typography>
          <Typography variant="body2" component="p">
            Change the target optical density. Typical values are between 1.0 and
            2.5 (arbitrary units)
          </Typography>
          <TextField
            size="small"
            id="dosing_algorithm/target_od"
            label="Target optical density"
            defaultValue={props.targetODState}
            InputProps={{
              endAdornment: <InputAdornment position="end">AU</InputAdornment>,
            }}
            variant="outlined"
            onKeyPress={setPioreactorJobAttrOnEnter}
            className={classes.textFieldWide}
          />

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Duration between dosing events
          </Typography>
          <Typography variant="body2" component="p">
            Change how long to wait between dilutions. Typically between 5 and 90 minutes. Changing this will immediately trigger
            a dosing event.
          </Typography>
          <TextField
            size="small"
            id="dosing_algorithm/duration"
            label="Duration"
            defaultValue={props.durationState}
            InputProps={{
              endAdornment: <InputAdornment position="end">min</InputAdornment>,
            }}
            variant="outlined"
            onKeyPress={setPioreactorJobAttrOnEnter}
            className={classes.textFieldWide}
          />

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Target growth rate
          </Typography>
          <Typography variant="body2" component="p">
            Change the target hourly growth rate - only applicable in{" "}
            <code>morbidostat</code> mode. Typical values are between 0.05h⁻¹ and
            0.4h⁻¹.
          </Typography>
          <TextField
            size="small"
            id="dosing_algorithm/target_growth_rate"
            label="Target growth rate"
            defaultValue={props.targetGrowthRateState}
            InputProps={{
              endAdornment: <InputAdornment position="end">h⁻¹</InputAdornment>,
            }}
            variant="outlined"
            onKeyPress={setPioreactorJobAttrOnEnter}
            className={classes.textFieldWide}
          />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Dosing algorithm
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            {props.dosingControlJobState !== "disconnected" &&
              <React.Fragment>
              Currently running dosing algorithm <code>{props.dosingAlgorithm}</code>.
              Learn more about <a target="_blank" href="https://github.com/Pioreactor/pioreactor/wiki/dosing-algorithms">dosing algorithms</a>.
              </React.Fragment>
            }
            {props.dosingControlJobState === "disconnected" &&

              <React.Fragment>
              You can change the Dosing algorthm after starting the job.
              </React.Fragment>
            }
          </Typography>

          <ButtonChangeDosingDialog
            unit={props.unit}
            config={props.config}
            experiment={props.experiment}
            currentDosingAlgorithm={props.dosingAlgorithm}
          />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            LED algorithm
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            {props.ledControlJobState !== "disconnected" &&
              <React.Fragment>
              Currently running LED algorithm <code>{props.ledAlgorithm}</code>.
              Learn more about <a target="_blank" href="https://github.com/Pioreactor/pioreactor/wiki/led-algorithms">LED algorithms</a>.
              </React.Fragment>
            }
            {props.ledControlJobState === "disconnected" &&

              <React.Fragment>
              You can change the LED algorthm after starting the job.
              </React.Fragment>
            }
          </Typography>

          <ButtonChangeLEDDialog
            unit={props.unit}
            config={props.config}
            experiment={props.experiment}
            currentLEDAlgorithm={props.ledAlgorithm}
          />
          <Divider className={classes.divider} />
        </TabPanel>
        <TabPanel value={tabValue} index={0}>
          <Typography gutterBottom>
            Stirring
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            Start, stop or pause the stirring on the Pioreactor. Stirring is needed for homogenous mixing.
          </Typography>

          {stirringButtons}

          <Divider className={classes.divider} />
          <Typography gutterBottom>
            Optical density
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            Pausing the optical density readings will also pause
            downstream activities that rely on optical density readings, like growth
            rates.
          </Typography>

          {odButtons}

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Growth rate
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            Pausing the growth rate calculating will also pause
            downstream activities that rely on it, like dosing events.
          </Typography>

          {grButtons}

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Dosing control
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            {props.dosingControlJobState !== "disconnected" &&
              <React.Fragment>
              Currently running dosing algorithm <code>{props.dosingAlgorithm}</code>.
              Learn more about <a target="_blank" href="https://github.com/Pioreactor/pioreactor/wiki/dosing-algorithms">dosing algorithms</a>.
              </React.Fragment>
            }
            {props.dosingControlJobState === "disconnected" &&

              <React.Fragment>
              Dosing events will initially start in <span className={"underlineSpan"} title="silent mode performs no dosing operations."><code>silent</code></span> mode, and can be changed after.
              Learn more about <a target="_blank" href="https://github.com/Pioreactor/pioreactor/wiki/dosing-algorithms">dosing algorithms</a>.
              </React.Fragment>
            }
          </Typography>

            {dosingButtons}

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            LED control
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            {props.ledControlJobState !== "disconnected" &&
              <React.Fragment>
              Currently running LED algorithm <code>{props.dosingAlgorithm}</code>.
              Learn more about <a target="_blank" href="https://github.com/Pioreactor/pioreactor/wiki/led-algorithms">LED algorithms</a>.
              </React.Fragment>
            }
            {props.ledControlJobState === "disconnected" &&

              <React.Fragment>
              LED controls will initially start in <span className={"underlineSpan"} title="silent mode performs no dosing operations."><code>silent</code></span> mode, and can be changed after.
              Learn more about <a target="_blank" href="https://github.com/Pioreactor/pioreactor/wiki/led-algorithms">LED algorithms</a>.
              </React.Fragment>
            }
          </Typography>

            {ledButtons}

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Temperature controlling
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            Us at Pioreactor are working on including per-reactor temperature control. Stay tuned!
          </Typography>

          <Divider className={classes.divider} />
        </TabPanel>
      </DialogContent>
    </Dialog>
    <Snackbar
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      open={snackbarOpen}
      onClose={handleSnackbarClose}
      message={snackbarMessage}
      autoHideDuration={7000}
      key={"snackbar" + props.unit + "settings"}
    />
    </div>
  );
}


function SettingsActionsDialogAll(props) {

  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [tabValue, setTabValue] = React.useState(0);

  const hrJobs = {
    "od_reading":  "optical density reading",
    "growth_rate_calculating":  "growth rate activity",
    "stirring":  "stirring",
    "dosing_algorithm":  "dosing control",
    "dosing_control":  "dosing control",
    "led_control":  "LED control",
    "led_algorithm":  "LED control",
  }

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  useEffect(() => {
    if (!props.config['network.topology']){
      return
    }
    if (props.config.remote) {
      var client = new Client(
        `ws://${props.config.remote.ws_url}/`,
        "webui_SettingsActionsDialogAll" + Math.random()
      )}
    else {
      var client = new Client(
        `${props.config['network.topology']['leader_address']}`, 9001,
        "webui_SettingsActionsDialogAll" + Math.random()
      );
    }
    client.connect({timeout: 180});
    setClient(client)
  },[props.config])


  function setPioreactorJobState(job, state) {
    return function sendMessage() {
      var message = new Message(String(state));
      message.destinationName = [
        "pioreactor",
        props.unit,
        props.experiment,
        job,
        "$state",
        "set",
      ].join("/");
      message.qos = 1;
      try{
        client.publish(message);
      }
      catch (e){
        console.log(e)
        setTimeout(() => {sendMessage()}, 750)
      }
      finally {
        const verbs = {
          "sleeping":  "Pausing",
          "disconnected":  "Stopping",
          "ready":  "Resuming",
        }
        setSnackbarMessage(`${verbs[state]} ${hrJobs[job]} on all active Pioreactors`)
        setSnackbarOpen(true)
      }
    };
  }

  function startPioreactorJob(job){
    return function() {
      setSnackbarMessage(`Starting ${hrJobs[job]} on all active Pioreactors`)
      setSnackbarOpen(true)
      fetch("/run/" + job + "/" + props.unit)
    }
  }

  function setPioreactorJobAttr(job_attr, value) {
    var message = new Message(String(value));
    message.destinationName = [
      "pioreactor",
      props.unit,
      props.experiment,
      job_attr,
      "set",
    ].join("/");
    message.qos = 1;
    try{
      setSnackbarOpen(true)
    }
    catch (e) {
      console.log(e)
      client.connect({onSuccess: () => setPioreactorJobAttr(job_attr, value)});
    }
  }

  function setPioreactorJobAttrOnEnter(e) {
    if (e.key === "Enter") {
      setPioreactorJobAttr(e.target.id, e.target.value);
      setSnackbarMessage(`Updated to ${e.target.value}.`)
      setSnackbarOpen(true)
    }
  }

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setTabValue(0)
    setOpen(false);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false)
  }


  function createUserButtonsBasedOnState(job, parentJob=null){
    parentJob = parentJob || job
    return (<div>
        <Button
          className={classes.jobButton}
          disableElevation
          color="primary"
          onClick={startPioreactorJob(parentJob)}
        >
          Start
        </Button>
        <Button
          className={classes.jobButton}
          disableElevation
          color="primary"
          onClick={setPioreactorJobState(job, "sleeping")}
        >
          Pause
        </Button>
        <Button
          className={classes.jobButton}
          disableElevation
          color="primary"
          onClick={setPioreactorJobState(job, "ready")}
        >
          Resume
        </Button>
        <Button
          className={classes.jobButton}
          disableElevation
          color="secondary"
          onClick={setPioreactorJobState(parentJob, "disconnected")}
        >
          Stop
        </Button>
      </div>
  )}

  const odButtons = createUserButtonsBasedOnState("od_reading")
  const grButtons = createUserButtonsBasedOnState("growth_rate_calculating")
  const dosingButtons = createUserButtonsBasedOnState("dosing_algorithm", "dosing_control")
  const ledButtons = createUserButtonsBasedOnState("led_algorithm", "led_control")
  const stirringButtons = createUserButtonsBasedOnState("stirring")

  return (
    <React.Fragment>
    <Button style={{textTransform: 'none', float: "right" }} onClick={handleClickOpen} color="primary">
      <EditIcon className={classes.textIcon}/> Edit all Pioreactors
    </Button>
    <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
      <DialogTitle>
        <Typography className={classes.suptitle}>
          All active Pioreactors
        </Typography>
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        indicatorColor="primary"
        textColor="primary"
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Activities"/>
        <Tab label="Settings"/>
        <Tab label="Dosing"/>
      </Tabs>
      </DialogTitle>
      <DialogContent>
        <TabPanel value={tabValue} index={1}>
          <Typography gutterBottom>
            Volume / dosing
          </Typography>
          <Typography variant="body2" component="p">
            Change the volume per dilution. Typical values are between 0.0mL and
            1.0mL.
          </Typography>
          <TextField
            size="small"
            id="dosing_algorithm/volume"
            label="Volume / dosing"
            defaultValue={props.volumeState}
            InputProps={{
              endAdornment: <InputAdornment position="end">mL</InputAdornment>,
            }}
            variant="outlined"
            onKeyPress={setPioreactorJobAttrOnEnter}
            className={classes.textFieldWide}
          />

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Target OD
          </Typography>
          <Typography variant="body2" component="p">
            Change the target optical density. Typical values are between 1.0 and
            2.5 (arbitrary units)
          </Typography>
          <TextField
            size="small"
            id="dosing_algorithm/target_od"
            label="Target optical density"
            defaultValue={props.targetODState}
            InputProps={{
              endAdornment: <InputAdornment position="end">AU</InputAdornment>,
            }}
            variant="outlined"
            onKeyPress={setPioreactorJobAttrOnEnter}
            className={classes.textFieldWide}
          />

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Duration between dosing events
          </Typography>
          <Typography variant="body2" component="p">
            Change how long to wait between dilutions. Typically between 15 and 90 minutes. Changing this will immediately trigger
            a dosing event.
          </Typography>
          <TextField
            size="small"
            id="dosing_algorithm/duration"
            label="Duration"
            defaultValue={props.durationState}
            InputProps={{
              endAdornment: <InputAdornment position="end">min</InputAdornment>,
            }}
            variant="outlined"
            onKeyPress={setPioreactorJobAttrOnEnter}
            className={classes.textFieldWide}
          />

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Target growth rate
          </Typography>
          <Typography variant="body2" component="p">
            Change the target hourly growth rate - only applicable in{" "}
            <code>morbidostat</code> mode. Typical values are between 0.05h⁻¹ and
            0.4h⁻¹.
          </Typography>
          <TextField
            size="small"
            id="dosing_algorithm/target_growth_rate"
            label="Target growth rate"
            defaultValue={props.targetGrowthRateState}
            InputProps={{
              endAdornment: <InputAdornment position="end">h⁻¹</InputAdornment>,
            }}
            variant="outlined"
            onKeyPress={setPioreactorJobAttrOnEnter}
            className={classes.textFieldWide}
          />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Dosing algorithm
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
              Learn more about <a target="_blank" href="https://github.com/Pioreactor/pioreactor/.ex/dosing-algorithms">dosing algorithms</a>.
          </Typography>

          <ButtonChangeDosingDialog
            unit={props.unit}
            config={props.config}
            experiment={props.experiment}
            currentDosingAlgorithm={true}
            title="All active Pioreactors"
          />
          <Divider className={classes.divider} />

        </TabPanel>

        <TabPanel value={tabValue} index={0}>
          <Typography gutterBottom>
            Stirring
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            Start, stop or pause the stirring on all the Pioreactors. Stirring is needed for homogenous mixing.
          </Typography>

          {stirringButtons}

          <Divider className={classes.divider} />
          <Typography gutterBottom>
            Optical density
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            Pausing the optical density readings will also pause
            downstream activities that rely on optical density readings, like growth
            rates.
          </Typography>

          {odButtons}

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Growth rate
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            Pausing the growth rate calculating will also pause
            downstream activities that rely on it, like dosing events.
          </Typography>

          {grButtons}

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Dosing control
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            Dosing events will initially start in <span className={"underlineSpan"} title="silent mode performs no IO operations."><code>silent</code></span> mode, and can be changed after.
            Learn more about <a target="_blank" href="https://github.com/Pioreactor/pioreactor/wiki/dosing-algorithms">dosing algorithms</a>.
          </Typography>

            {dosingButtons}
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            LED control
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            LED control will initially start in <span className={"underlineSpan"} title="silent mode performs no IO operations."><code>silent</code></span> mode, and can be changed after.
            Learn more about <a target="_blank" href="https://github.com/Pioreactor/pioreactor/wiki/led-algorithms">LED algorithms</a>.
          </Typography>

            {ledButtons}
          <Divider className={classes.divider} />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <Typography  gutterBottom>
            Add media
          </Typography>
          <Typography variant="body2" component="p">
            Run the media pump{props.isPlural ? "s" : ""} for a set duration (seconds), or a set volume (mL).
          </Typography>
          <ActionDosingForm action="add_media" unit={props.unit} />
          <Divider className={classes.divider} />
          <Typography gutterBottom>
            Add alternative media
          </Typography>
          <Typography variant="body2" component="p">
            Run the alternative media pump{props.isPlural ? "s" : ""} for a set duration (seconds), or a set
            volume (mL).
          </Typography>
          <ActionDosingForm action="add_alt_media" unit={props.unit} />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Remove waste
          </Typography>
          <Typography variant="body2" component="p">
            Run the waste pump{props.isPlural ? "s" : ""} for a set duration (seconds), or a set volume (mL).
          </Typography>
          <ActionDosingForm action="remove_waste" unit={props.unit} />
          <Divider className={classes.divider} />
        </TabPanel>
      </DialogContent>
    </Dialog>
    <Snackbar
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      open={snackbarOpen}
      onClose={handleSnackbarClose}
      message={snackbarMessage}
      autoHideDuration={7000}
      key={"snackbar" + props.unit + "settings"}
    />
    </React.Fragment>
  );
}


function ActiveUnits(props){
  return (
  <React.Fragment>
    <div style={{display: "flex", justifyContent: "space-between", marginBottom: "10px", marginTop: "15px"}}>
      <Typography variant="h5" component="h2">
        <Box fontWeight="fontWeightRegular">
          Active Pioreactors
        </Box>
      </Typography>
      <div >

      </div>
    </div>
    {props.units.map(unit =>
      <PioreactorCard isUnitActive={true} key={unit} unit={unit} config={props.config} experiment={props.experiment}/>
  )}
  </React.Fragment>
)}

function FlashLEDButton(props){
  const classes = useStyles();

  const [client, setClient] = useState(null)
  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    if (!props.config['network.topology']){
      return
    }
    if (props.config.remote) {
      var client = new Client(
        `ws://${props.config.remote.ws_url}/`,
        "webui_FlashLEDButton" + Math.random()
      )}
    else {
      var client = new Client(
        `${props.config['network.topology']['leader_address']}`, 9001,
        "webui_FlashLEDButton" + Math.random()
      );
    }
    client.connect({timeout: 180});
    setClient(client)
  },[props.config])


  const onClick = () => {
    setFlashing(true)

    const sendMessage = () => {
      var message = new Message("1");
      message.destinationName = [
        "pioreactor",
        props.unit,
        "$experiment",
        "monitor",
        "flicker_led",
      ].join("/");
      message.qos = 0;
      try{
        client.publish(message);
      }
      catch (e){
        console.log(e)
        setTimeout(() => {sendMessage()}, 1000)
      }
    }

    sendMessage()
    setTimeout(() => {setFlashing(false)}, 3600 ) // .9 * 4
  }

  return (
    <Button style={{textTransform: 'none', float: "right"}} className={clsx({["blink-led"]: flashing})} disabled={props.disabled} onClick={onClick} color="primary">
      <FlareIcon color={props.disabled ? "disabled" : "primary"} className={classes.textIcon}/> <span >  Blink  </span>
    </Button>
)}


function PioreactorCard(props){
  const classes = useStyles();
  const unit = props.unit
  const isUnitActive = props.isUnitActive
  const experiment = props.experiment
  const [stirringDCState, setStirringDCState] = useState(0);
  const [stirringJobState, setStirringJobState] = useState("disconnected");
  const [ODReadingJobState, setODReadingJobState] = useState("disconnected");
  const [growthRateJobState, setGrowthRateJobState] = useState("disconnected");
  const [dosingControlJobState, setdosingControlJobState] = useState("disconnected");
  const [temperatureControllingJobState, setTemperatureControllingJobState] = useState("disconnected");
  const [ledControlJobState, setLEDControllingJobState] = useState("disconnected");
  const [targetODState, setTargetODState] = useState(0);
  const [durationState, setDurationState] = useState(0);
  const [targetGrowthRateState, setTargetGrowthRateState] = useState(0);
  const [volumeState, setVolumeState] = useState(0);
  const [dosingAlgorithm, setDosingAlgorithm] = useState(null);
  const [ledAlgorithm, setLedAlgorithm] = useState(null);
  const [temperature, setTemperature] = useState(0);

  return (
    <Card className={classes.pioreactorCard} id={unit}>

      <CardContent className={classes.cardContent}>
        <div className={"fixme"}>
          <Typography className={clsx(classes.suptitle)} color="textSecondary">
            {(props.config['ui.overview.rename'] && props.config['ui.overview.rename'][unit]) ? unit : ""}
          </Typography>
          <div style={{display: "flex", justifyContent: "space-between"}}>
            <Typography className={clsx(classes.unitTitle, {[classes.disabledText]: !isUnitActive})} gutterBottom>
              <PioreactorIcon color={isUnitActive ? "inherit" : "disabled"} style={{verticalAlign: "middle"}}/> {(props.config['ui.overview.rename'] && props.config['ui.overview.rename'][unit]) ? props.config['ui.overview.rename'][unit] : unit }
            </Typography>
            <div style={{display: "flex", justifyContent: "right"}}>
              <div>
                <Button style={{textTransform: 'none', float: "right" }} disabled={!isUnitActive} color="primary">
                  <SettingsIcon color={!isUnitActive ? "disabled" : "primary"} className={classes.textIcon}/> Calibrate
                </Button>
              </div>
              <div>
                <FlashLEDButton disabled={!isUnitActive} config={props.config} unit={unit}/>
              </div>
              <SettingsActionsDialog
                config={props.config}
                stirringDCState={stirringDCState}
                ODReadingJobState={ODReadingJobState}
                growthRateJobState={growthRateJobState}
                stirringJobState={stirringJobState}
                dosingControlJobState={dosingControlJobState}
                ledControlJobState={ledControlJobState}
                temperatureControllingJobState={temperatureControllingJobState}
                targetGrowthRateState={targetGrowthRateState}
                volumeState={volumeState}
                durationState={durationState}
                targetODState={targetODState}
                dosingAlgorithm={dosingAlgorithm}
                ledAlgorithm={ledAlgorithm}
                temperature={temperature}
                experiment={experiment}
                unit={unit}
                disabled={!isUnitActive}
              />
            </div>
          </div>
        </div>


      <div style={{display: "flex", margin: "15px 20px 20px 0px"}}>
        <div className={classes.textboxLabel}>
          <Typography variant="body2" component="body1">
            <Box fontWeight="fontWeightBold" className={clsx({[classes.disabledText]: !isUnitActive})}>
              Activities:
            </Box>
          </Typography>
        </div>

        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            Stirring
          </Typography>
          <UnitSettingDisplay
            passChildData={setStirringJobState}
            experiment={experiment}
            isUnitActive={isUnitActive}
            default="disconnected"
            isStateSetting
            topic="stirring/$state"
            unit={unit}
            config={props.config}
          />
        </div>
        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            Optical density
          </Typography>
          <UnitSettingDisplay
            passChildData={setODReadingJobState}
            experiment={experiment}
            isUnitActive={isUnitActive}
            default="disconnected"
            isStateSetting
            topic="od_reading/$state"
            unit={unit}
            config={props.config}
          />
        </div>
        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            Growth rate
          </Typography>
          <UnitSettingDisplay
            passChildData={setGrowthRateJobState}
            experiment={experiment}
            isUnitActive={isUnitActive}
            default="disconnected"
            isStateSetting
            topic="growth_rate_calculating/$state"
            unit={unit}
            config={props.config}
          />
        </div>
        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            Dosing control
          </Typography>
          <UnitSettingDisplay
            passChildData={setdosingControlJobState}
            experiment={experiment}
            isUnitActive={isUnitActive}
            default="disconnected"
            isStateSetting
            topic="dosing_algorithm/$state"
            unit={unit}
            config={props.config}
          />
        </div>
        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            LED control
          </Typography>
          <UnitSettingDisplay
            passChildData={setLEDControllingJobState}
            experiment={experiment}
            isUnitActive={isUnitActive}
            default="disconnected"
            isStateSetting
            topic="led_control/$state"
            unit={unit}
            config={props.config}
          />
        </div>
        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            Temperature control
          </Typography>
          <UnitSettingDisplay
            passChildData={setTemperatureControllingJobState}
            experiment={experiment}
            isUnitActive={isUnitActive}
            default="NA"
            isStateSetting
            topic="temperature_control/$state"
            unit={unit}
            config={props.config}
          />
        </div>
      </div>
      <Divider/>


      <div style={{display: "flex", margin: "20px 20px 20px 0px"}}>
        <div className={classes.textboxLabel}>
          <Typography variant="body2" component="body1">
            <Box fontWeight="fontWeightBold"  className={clsx({[classes.disabledText]: !isUnitActive})}>
              Settings:
            </Box>
          </Typography>
        </div>
        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            Stirring speed
          </Typography>
          <UnitSettingDisplay
            passChildData={setStirringDCState}
            experiment={experiment}
            isUnitActive={isUnitActive}
            default="—"
            className={classes.alignRight}
            topic="stirring/duty_cycle"
            unit={unit}
            config={props.config}
          />
        </div>
        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            Volume / dosing
          </Typography>
          <UnitSettingDisplay
            precision={2}
            measurementUnit="mL"
            experiment={experiment}
            passChildData={setVolumeState}
            isUnitActive={isUnitActive}
            default="—"
            className={classes.alignRight}
            topic="dosing_algorithm/volume"
            unit={unit}
            config={props.config}
          />
        </div>
        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            Target OD
          </Typography>
          <UnitSettingDisplay
            precision={2}
            experiment={experiment}
            passChildData={setTargetODState}
            isUnitActive={isUnitActive}
            default={"—"}
            className={classes.alignRight}
            topic="dosing_algorithm/target_od"
            unit={unit}
            config={props.config}
          />
        </div>
        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            Target growth rate
          </Typography>
          <UnitSettingDisplay
            precision={2}
            measurementUnit="h⁻¹"
            experiment={experiment}
            passChildData={setTargetGrowthRateState}
            isUnitActive={isUnitActive}
            default="—"
            className={classes.alignRight}
            topic="dosing_algorithm/target_growth_rate"
            unit={unit}
            config={props.config}
          />
        </div>
        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            Dosing algorithm
          </Typography>
          <UnitSettingDisplay
            experiment={experiment}
            passChildData={setDosingAlgorithm}
            isUnitActive={isUnitActive}
            default="—"
            className={classes.alignRight}
            topic="dosing_control/dosing_algorithm"
            unit={unit}
            config={props.config}
          />
        </div>
        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            LED algorithm
          </Typography>
          <UnitSettingDisplay
            experiment={experiment}
            passChildData={setLedAlgorithm}
            isUnitActive={isUnitActive}
            default="—"
            className={classes.alignRight}
            topic="led_control/led_algorithm"
            unit={unit}
            config={props.config}
          />
        </div>
        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            Time between dosing events
          </Typography>
          <UnitSettingDisplay
            precision={0}
            measurementUnit="m"
            experiment={experiment}
            passChildData={setDurationState}
            isUnitActive={isUnitActive}
            default="—"
            className={classes.alignRight}
            topic="dosing_algorithm/duration"
            unit={unit}
            config={props.config}
          />
        </div>
        <div className={classes.textbox}>
          <Typography variant="body2" style={{fontSize: "0.85rem"}}>
            Target temperature
          </Typography>
          <UnitSettingDisplay
            experiment={experiment}
            passChildData={setTemperature}
            isUnitActive={isUnitActive}
            default="—"
            className={classes.alignRight}
            topic="temperature_control/temperature"
            unit={unit}
            config={props.config}
          />
        </div>
      </div>


      </CardContent>
    </Card>
)}


function InactiveUnits(props){

  return (
  <React.Fragment>
    <div style={{display: "flex", justifyContent: "space-between", marginBottom: "10px", marginTop: "15px"}}>
      <Typography variant="h5" component="h2">
        <Box fontWeight="fontWeightRegular">
          Inactive Pioreactors
        </Box>
      </Typography>
    </div>
    {props.units.map(unit =>
      <PioreactorCard isUnitActive={false} key={unit} unit={unit} config={props.config} experiment={props.experiment}/>
  )}
    </React.Fragment>
)}

function Pioreactors(props) {
    const [experimentMetadata, setExperimentMetadata] = React.useState({})

    React.useEffect(() => {
      async function getLatestExperiment() {
           await fetch("/get_latest_experiment")
          .then((response) => {
            return response.json();
          })
          .then((data) => {
            setExperimentMetadata(data)
          });
        }
      getLatestExperiment()
    }, [])

    const entries = (a) => Object.entries(a)

    return (
        <Grid container spacing={2} >
          <Grid item xs={12}><Header /></Grid>
          <Grid item xs={12} />
          <Grid item xs={12} />

          <Grid item md={1} xs={1}/>
          <Grid item md={10} xs={12}>
            <PioreactorHeader config={props.config} experiment={experimentMetadata.experiment}/>
            <ActiveUnits experiment={experimentMetadata.experiment} config={props.config} units={props.config['inventory'] ? entries(props.config['inventory']).filter((v) => v[1] === "1").map((v) => v[0]) : [] }/>
            <InactiveUnits experiment={experimentMetadata.experiment} config={props.config} units={props.config['inventory'] ? entries(props.config['inventory']).filter((v) => v[1] === "0").map((v) => v[0]) : [] }/>
          </Grid>
          <Grid item md={1} xs={1}/>
          {props.config['ui.overview.rename'] ? <TactileButtonNotification config={props.config}/> : null}
        </Grid>
    )
}

export default Pioreactors;

