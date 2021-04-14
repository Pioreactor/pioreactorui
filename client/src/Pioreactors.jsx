import clsx from 'clsx';
import { Client, Message } from "paho-mqtt";

import React, {useState, useEffect} from "react";

import Grid from '@material-ui/core/Grid';
import Header from "./components/Header"
import PropTypes from 'prop-types';

import { makeStyles, withStyles } from '@material-ui/core/styles';
import { palette } from '@material-ui/system';
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
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Slider from '@material-ui/core/Slider';
import Snackbar from '@material-ui/core/Snackbar';
import TextField from '@material-ui/core/TextField';
import Switch from '@material-ui/core/Switch';
import Tooltip from '@material-ui/core/Tooltip';
import InputAdornment from '@material-ui/core/InputAdornment';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Button from "@material-ui/core/Button";
import AddIcon from '@material-ui/icons/Add';
import ClearIcon from '@material-ui/icons/Clear';
import EditIcon from '@material-ui/icons/Edit';
import FlareIcon from '@material-ui/icons/Flare';
import SettingsIcon from '@material-ui/icons/Settings';


import {parseINIString} from "./utilities"
import ButtonChangeDosingDialog from "./components/ButtonChangeDosingDialog"
import ButtonChangeLEDDialog from "./components/ButtonChangeLEDDialog"
import ButtonChangeTemperatureDialog from "./components/ButtonChangeTemperatureDialog"
import ActionDosingForm from "./components/ActionDosingForm"
import ActionLEDForm from "./components/ActionLEDForm"
import PioreactorIcon from "./components/PioreactorIcon"
import TactileButtonNotification from "./components/TactileButtonNotification";


const readyGreen = "#4caf50"
const disconnectedGrey = "grey"
const lostRed = "#DE3618"

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
    width: "126px",
    marginTop: "10px"
  },
  textboxLabel:{
    width: "100px",
    marginTop: "10px",
    marginRight: "5px"
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
  jobButton: {
    paddingRight: "15px",
    paddingLeft: "15px"
  },
  unitSettingsSubtext:{
    fontSize: "11px"
  },
  unitSettingsSubtextEmpty:{
    minHeight: "15px"
  }
}));


function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      key={`simple-tabpanel-${index}`}
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


function UnitSettingDisplay(props) {
  const classes = useStyles();
  const stateDisplay = {
    "init":          {display: "Starting", color: readyGreen},
    "ready":         {display: "On", color: readyGreen},
    "sleeping":      {display: "Paused", color: disconnectedGrey},
    "disconnected":  {display: "Off", color: disconnectedGrey},
    "lost":          {display: "Lost", color: lostRed},
    "NA":            {display: "Not available", color: disconnectedGrey},
  }
  const value = props.value || ""
  if (props.isStateSetting) {
    if (!props.isUnitActive) {
      return <div className={clsx({[classes.disabledText]: !props.isUnitActive})}> {stateDisplay[value].display} </div>;
    } else {
      var displaySettings = stateDisplay[value]
      return (
        <React.Fragment>
        <div style={{ color: displaySettings.color, fontWeight: 500}}>
          {displaySettings.display}
        </div>
        {props.subtext && <div className={classes.unitSettingsSubtext}><code>{props.subtext}</code></div>}
        {!props.subtext && <div className={classes.unitSettingsSubtextEmpty}></div>}
        </React.Fragment>
    )}
  } else if (props.isLEDIntensity) {
    if (!props.isUnitActive || value === "—" || value === "") {
      return <div style={{ color: disconnectedGrey, fontSize: "13px"}}> {props.default} </div>;
    } else {
      const ledIntensities = JSON.parse(value)
      return(
        <div style={{fontSize: "13px"}}>
          <div>
            <span style={{width: "55px", display: "inline-block"}}>A: {ledIntensities["A"]}%</span>
            <span style={{width: "55px", display: "inline-block"}}>B: {ledIntensities["B"]}% </span>
          </div>
          <div>
            <span style={{width: "55px", display: "inline-block"}}>C: {ledIntensities["C"]}%</span>
            <span style={{width: "55px", display: "inline-block"}}>D: {ledIntensities["D"]}% </span>
          </div>
        </div>
      )
    }
  } else {
    if (!props.isUnitActive || value === "—" || value === "") {
      return <div style={{ color: disconnectedGrey, fontSize: "13px"}}> {props.default} </div>;
    } else {
      return (
        <div style={{ fontSize: "13px"}}>
          {(typeof value === "string"
            ? value
            : +value.toFixed(props.precision)) +
            (props.measurementUnit ? props.measurementUnit : "")}
        </div>
      );
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
    fetch("/stop_all", {method: "POST"})
    handleClose()
  }

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <React.Fragment>
      <Button style={{textTransform: 'none', float: "right"}} color="secondary" onClick={handleClickOpen}>
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
      setErrorMsg("Provide a name for the new Pioreactor")
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
          setIsError(true)
          setIsRunning(false)
          response.json().then(data => setErrorMsg(`Unable to complete installation. ${data.stderr}`))
        }
    })
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
        <li>A blank microSD card</li>
        <li>A computer with the <a href="https://www.raspberrypi.org/software/">RaspberryPi Imager</a> installed and that can read & write to the microSD card</li>
        <li>The Pioreactor hardware hat</li>
      </ul>
      <p> With that all ready, let's begin: </p>
      <ol>
        <li>Insert your microSD card into your computer.</li>
        <li>Open the <a href="https://www.raspberrypi.org/software/">RaspberryPi Imager</a>, and hold "ctrl-shift-x" to bring up the settings menu</li>
        <li>Check "Enable SSH", with password <code>raspberry</code>. <b>This is important</b>.</li>
        <li>Check "Configure wifi", and add your credentials.</li>
        <li> Click "Save".</li>
        <li>Choose the "Raspberry Pi OS Lite" and your storage, and click "write". </li>
        <li>When done, unmount the microSD, insert it into the RaspberryPi, and attach the Pioreactor hat to the RaspberryPi.</li>
        <li>Turn on the RaspberryPi by inserting the power cord.</li>
      </ol>

      <p>Below, provide a unique name for your new Pioreactor (letters and digits only), and
      your existing Pioreactors will automatically install the required software and connect it to the cluster.
      </p>

      <p>It may take up to 5 minutes to install the software. When finished, the new Pioreactor
      will show up on this page. You don't need to stay on this page while it's installing.</p>


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

      <div style={{minHeight: "50px"}}>
        {isError? <p><Box color="error.main">{errorMsg}</Box></p> : <p></p>}
        {isRunning? <p>Installation is occuring in the background. You may navigate away from this page, including adding more Pioreactors. </p> : <p> </p>}
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
            config["stirring"]["duty_cycle"]
          );
        })
        .catch((error) => {})
    }
    if (!props.disabled) {
      fetchData();
    }
  }, [props.disabled, props.unit]);


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
        props.client.publish(message);
      }
      catch (e){
        console.log(e)
        setTimeout(() => {sendMessage()}, 750)
      }
    };
  }

  function startPioreactorJob(job_attr){
    return function() {
      fetch("/run/" + job_attr + "/" + props.unit, {method: "POST"}).then(res => {
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
      props.client.publish(message);
    }
    catch (e) {
      console.log(e)
      props.client.connect({onSuccess: () => setPioreactorJobAttr(job_attr, value)});
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

  function setPioreactorStirringDynamic(e, value) {
    setPioreactorJobAttr("stirring/dc_increase_between_adc_readings", value ? 1 : 0);
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


  function createUserButtonsBasedOnState(jobState, job){

    switch (jobState){
      case "lost":
        return (<div>
          <PatientButton
            color="secondary"
            variant="contained"
                onClick={startPioreactorJob(job)}
            buttonText="Start"
          />
          <PatientButton
            color="secondary"
            onClick={setPioreactorJobState(job, "disconnected")}
            buttonText="Stop"
          />
        </div>)
      case "disconnected":
       return (<div>
               <PatientButton
                color="primary"
                variant="contained"
                onClick={startPioreactorJob(job)}
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
            onClick={setPioreactorJobState(job, "disconnected")}
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
              onClick={setPioreactorJobState(job, "disconnected")}
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
  const dosingButtons = createUserButtonsBasedOnState(props.dosingControlJobState, "dosing_control")
  const ledButtons = createUserButtonsBasedOnState(props.ledControlJobState, "led_control")
  const tempButtons = createUserButtonsBasedOnState(props.temperatureControlJobState, "temperature_control")

  // the | {} is here to protect against the UI loading from a broken config.
  const invertedLEDMap = Object.fromEntries(Object.entries(props.config['leds'] | {}).map(([k, v]) => [v, k]))

  return (
    <div>
    <Button style={{textTransform: 'none', float: "right" }} disabled={props.disabled} onClick={handleClickOpen} color="primary">
      <EditIcon color={props.disabled ? "disabled" : "primary"} className={classes.textIcon}/> Edit
    </Button>
    <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
      <DialogTitle>
        <Typography className={classes.suptitle}>
          <PioreactorIcon style={{verticalAlign: "middle", fontSize: "1.2em"}}/> {(props.config['ui.rename'] &&  props.config['ui.rename'][props.unit]) ? `${props.config['ui.rename'][props.unit]} / ${props.unit}` : `${props.unit}`}
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
          <ActionLEDForm channel="D" unit={props.unit} />

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
              defaultValue={parseInt(props.stirringDC)}
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
          <Typography  gutterBottom>
            Dynamic stirring adjustments
          </Typography>
          <Typography variant="body2" component="p">
            Enable adjusting of stirring speed when not taking optical density measurements. Turning this on
            increases the oxygen transfer rate.
          </Typography>

          <div style={{marginLeft: "20px"}}>
            <FormControlLabel
              control={<Switch checked={props.stirringDynamic} onChange={setPioreactorStirringDynamic} color="primary"/>}
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
            id="dosing_automation/volume"
            label="Volume / dosing"
            defaultValue={props.volume}
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
            id="dosing_automation/target_od"
            label="Target optical density"
            defaultValue={props.targetOD}
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
            id="dosing_automation/duration"
            label="Duration"
            defaultValue={props.duration}
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
            id="dosing_automation/target_growth_rate"
            label="Target growth rate"
            defaultValue={props.targetGrowthRate}
            InputProps={{
              endAdornment: <InputAdornment position="end">h⁻¹</InputAdornment>,
            }}
            variant="outlined"
            onKeyPress={setPioreactorJobAttrOnEnter}
            className={classes.textFieldWide}
          />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Target Temperature
          </Typography>
          <Typography variant="body2" component="p">
            Change the target temperature. Lower bound is the ambient temperature, and
            upperbound is 50℃.
          </Typography>
          <TextField
            size="small"
            id="temperature_automation/target_temperature"
            label="Target temperature"
            defaultValue={props.targetTemperature}
            InputProps={{
              endAdornment: <InputAdornment position="end">℃</InputAdornment>,
            }}
            variant="outlined"
            onKeyPress={setPioreactorJobAttrOnEnter}
            className={classes.textFieldWide}
          />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Dosing automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            {props.dosingControlJobState !== "disconnected" &&
              <React.Fragment>
              Currently running dosing automation <code>{props.dosingAutomation}</code>.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/dosing-automations">dosing automations</a>.
              </React.Fragment>
            }
            {props.dosingControlJobState === "disconnected" &&

              <React.Fragment>
              You can change the dosing automation after starting the Dosing control activity.
              </React.Fragment>
            }
          </Typography>

          <ButtonChangeDosingDialog
            unit={props.unit}
            config={props.config}
            experiment={props.experiment}
            currentDosingAutomation={props.dosingAutomation}
          />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            LED automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            {props.ledControlJobState !== "disconnected" &&
              <React.Fragment>
              Currently running LED automation <code>{props.ledAutomation}</code>.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/led-automations">LED automations</a>.
              </React.Fragment>
            }
            {props.ledControlJobState === "disconnected" &&

              <React.Fragment>
              You can change the LED automation after starting the LED control activity.
              </React.Fragment>
            }
          </Typography>

          <ButtonChangeLEDDialog
            unit={props.unit}
            config={props.config}
            experiment={props.experiment}
            currentLEDAutomation={props.ledAutomation}
          />
          <Divider className={classes.divider} />

          <Typography  gutterBottom>
            Temperature automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            {props.temperatureControlJobState !== "disconnected" &&
              <React.Fragment>
              Currently running temperature automation <code>{props.tempAutomation}</code>.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/temperature-automations">temperature automations</a>.
              </React.Fragment>
            }
            {props.temperatureControlJobState === "disconnected" &&

              <React.Fragment>
              You can change the temperature automation after starting the Temperature control activity.
              </React.Fragment>
            }
          </Typography>

          <ButtonChangeTemperatureDialog
            unit={props.unit}
            config={props.config}
            experiment={props.experiment}
            currentTemperatureAutomation={props.tempAutomation}
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
              Currently running dosing automation <code>{props.dosingAutomation}</code>.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/dosing-automations">dosing automations</a>.
              </React.Fragment>
            }
            {props.dosingControlJobState === "disconnected" &&

              <React.Fragment>
              Dosing events will initially start in <span className={"underlineSpan"} title="silent mode performs no dosing operations."><code>silent</code></span> mode, and can be changed after.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/dosing-automations">dosing automations</a>.
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
              Currently running LED automation <code>{props.ledAutomation}</code>.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/led-automations">LED automations</a>.
              </React.Fragment>
            }
            {props.ledControlJobState === "disconnected" &&

              <React.Fragment>
              LED controls will initially start in <span className={"underlineSpan"} title="silent mode performs no dosing operations."><code>silent</code></span> mode, and can be changed after.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/led-automations">LED automations</a>.
              </React.Fragment>
            }
          </Typography>

            {ledButtons}

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Temperature control
          </Typography>

          <Typography variant="body2" component="p" gutterBottom>
            {props.temperatureControlJobState !== "disconnected" &&
              <React.Fragment>
              Currently running temperature automation <code>{props.tempAutomation}</code>.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/temperature-automations">temperature automations</a>.
              </React.Fragment>
            }
            {props.temperatureControlJobState === "disconnected" &&

              <React.Fragment>
              Temperature controls will initially start in <span className={"underlineSpan"} title="silent mode performs no dosing operations."><code>silent</code></span> mode, and can be changed after.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/temperature-automations">temperature automations</a>.
              </React.Fragment>
            }
          </Typography>

            {tempButtons}

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
      resumeHideDuration={2000}
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

  const humanReadableJobs = {
    "od_reading":  "optical density reading",
    "growth_rate_calculating":  "growth rate activity",
    "stirring":  "stirring",
    "dosing_automation":  "dosing control",
    "dosing_control":  "dosing control",
    "led_control":  "LED control",
    "led_automation":  "LED control",
    "temperature_control":  "temperature control",
    "temperature_automation":  "temperature control",
  }

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  useEffect(() => {
    if (!props.config['network.topology']){
      return
    }
    var client
    if (props.config.remote && props.config.remote.ws_url) {
      client = new Client(
        `ws://${props.config.remote.ws_url}/`,
        "webui_SettingsActionsDialogAll" + Math.random()
      )}
    else {
      client = new Client(
        `${props.config['network.topology']['leader_address']}`, 9001,
        "webui_SettingsActionsDialogAll" + Math.random()
      );
    }
    client.connect({timeout: 180, reconnect: true});
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
        setSnackbarMessage(`${verbs[state]} ${humanReadableJobs[job]} on all active Pioreactors`)
        setSnackbarOpen(true)
      }
    };
  }

  function startPioreactorJob(job){
    return function() {
      setSnackbarMessage(`Starting ${humanReadableJobs[job]} on all active Pioreactors`)
      setSnackbarOpen(true)
      fetch("/run/" + job + "/" + props.unit, {method: "POST"})
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


  function createUserButtonsBasedOnState(job){
    return (<div>
        <Button
          className={classes.jobButton}
          disableElevation
          color="primary"
          onClick={startPioreactorJob(job)}
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
          onClick={setPioreactorJobState(job, "disconnected")}
        >
          Stop
        </Button>
      </div>
  )}

  const odButtons = createUserButtonsBasedOnState("od_reading")
  const grButtons = createUserButtonsBasedOnState("growth_rate_calculating")
  const dosingButtons = createUserButtonsBasedOnState("dosing_control")
  const ledButtons = createUserButtonsBasedOnState("led_control")
  const tempButtons = createUserButtonsBasedOnState("temperature_control")
  const stirringButtons = createUserButtonsBasedOnState("stirring")

  return (
    <React.Fragment>
    <Button style={{textTransform: 'none', float: "right" }} onClick={handleClickOpen} color="primary">
      <EditIcon className={classes.textIcon}/> Edit all Pioreactors
    </Button>
    <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
      <DialogTitle style={{backgroundColor: "#edeaf9"}}>
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
        <Tab label="LEDs"/>
      </Tabs>
      </DialogTitle>
      <DialogContent>

        <TabPanel value={tabValue} index={3}>
          <Typography style={{textTransform: "capitalize"}}>
            Channel A
          </Typography>
          <ActionLEDForm channel="A" unit={props.unit} />
          <Divider className={classes.divider} />

          <Typography style={{textTransform: "capitalize"}}>
            Channel B
          </Typography>
          <ActionLEDForm channel="B" unit={props.unit} />
          <Divider className={classes.divider} />

          <Typography style={{textTransform: "capitalize"}}>
            Channel C
          </Typography>
          <ActionLEDForm channel="C" unit={props.unit} />

          <Divider className={classes.divider} />
          <Typography style={{textTransform: "capitalize"}}>
            Channel D
          </Typography>
          <ActionLEDForm channel="D" unit={props.unit} />

          <Divider className={classes.divider} />
        </TabPanel>

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
            id="dosing_automation/volume"
            label="Volume / dosing"
            defaultValue={props.volume}
            InputProps={{
              endAdornment: <InputAdornment position="end">mL</InputAdornment>,
            }}
            variant="outlined"
            onKeyPress={setPioreactorJobAttrOnEnter}
            className={classes.textFieldWide}
          />

          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Target Temperature
          </Typography>
          <Typography variant="body2" component="p">
            Change the target temperature. Lower bound is the ambient temperature, and
            upperbound is 50℃.
          </Typography>
          <TextField
            size="small"
            id="temperature_automation/target_temperature"
            label="Target temperature"
            defaultValue={props.targetTemperature}
            InputProps={{
              endAdornment: <InputAdornment position="end">℃</InputAdornment>,
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
            id="dosing_automation/duration"
            label="Duration"
            defaultValue={props.duration}
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
            id="dosing_automation/target_growth_rate"
            label="Target growth rate"
            defaultValue={props.targetGrowthRate}
            InputProps={{
              endAdornment: <InputAdornment position="end">h⁻¹</InputAdornment>,
            }}
            variant="outlined"
            onKeyPress={setPioreactorJobAttrOnEnter}
            className={classes.textFieldWide}
          />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Dosing automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/Dosing-automations">dosing automations</a>.
          </Typography>

          <ButtonChangeDosingDialog
            unit={props.unit}
            config={props.config}
            experiment={props.experiment}
            currentDosingAutomation={true}
            title="All active Pioreactors"
          />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            LED automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/LED-automations">LED automations</a>.
          </Typography>

          <ButtonChangeLEDDialog
            unit={props.unit}
            config={props.config}
            experiment={props.experiment}
            currentLEDAutomation={true}
            title="All active Pioreactors"
          />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Temperature automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/temperature-automations">temperature automations</a>.
          </Typography>

          <ButtonChangeTemperatureDialog
            unit={props.unit}
            config={props.config}
            experiment={props.experiment}
            currentTemperatureAutomation={true}
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
            Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/dosing-automations">dosing automations</a>.
          </Typography>

            {dosingButtons}
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            LED control
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            LED control will initially start in <span className={"underlineSpan"} title="silent mode performs no IO operations."><code>silent</code></span> mode, and can be changed after.
            Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/led-automations">LED automations</a>.
          </Typography>

            {ledButtons}
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Temperature control
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            Temperature control will initially start in <span className={"underlineSpan"} title="silent mode performs no IO operations."><code>silent</code></span> mode, and can be changed after.
            Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/temperature-automations">temperature automations</a>.
          </Typography>

            {tempButtons}
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
      resumeHideDuration={2000}
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

  const [flashing, setFlashing] = useState(false)


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
        props.client.publish(message);
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
    <Button style={{textTransform: 'none', float: "right"}} className={clsx({blinkled: flashing})} disabled={props.disabled} onClick={onClick} color="primary">
      <FlareIcon color={props.disabled ? "disabled" : "primary"} className={classes.textIcon}/> <span >  Blink  </span>
    </Button>
)}


function PioreactorCard(props){
  const classes = useStyles();
  const unit = props.unit
  const isUnitActive = props.isUnitActive
  const experiment = props.experiment

  const [client, setClient] = useState(null)

  const [stirringJobState, setStirringJobState] = useState("disconnected");
  const [ODReadingJobState, setODReadingJobState] = useState("disconnected");
  const [growthRateJobState, setGrowthRateJobState] = useState("disconnected");
  const [dosingControlJobState, setSosingControlJobState] = useState("disconnected");
  const [monitorJobState, setMonitorJobState] = useState("disconnected");
  const [temperatureControlJobState, setTemperatureControlJobState] = useState("disconnected");
  const [ledControlJobState, setLEDControlJobState] = useState("disconnected");
  const [stirringDC, setStirringDC] = useState(0);
  const [stirringDynamic, setStirringDynamic] = useState(0);
  const [targetOD, setTargetOD] = useState(0);
  const [targetTemperature, setTargetTemperature] = useState(0);
  const [duration, setDuration] = useState(0);
  const [targetGrowthRate, setTargetGrowthRate] = useState(0);
  const [volume, setVolume] = useState(0);
  const [dosingAutomation, setDosingAutomation] = useState(null);
  const [ledAutomation, setLedAutomation] = useState(null);
  const [tempAutomation, setTempAutomation] = useState(null);
  const [ledIntensity, setLEDIntensity] = useState("");

  const topicsToCallback = {
    [["pioreactor", unit, experiment, "led_control/$state"                  ].join("/")]: setLEDControlJobState,
    [["pioreactor", unit, experiment, "stirring/$state"                     ].join("/")]: setStirringJobState,
    [["pioreactor", unit, experiment, "od_reading/$state"                   ].join("/")]: setODReadingJobState,
    [["pioreactor", unit, experiment, "dosing_control/$state"               ].join("/")]: setSosingControlJobState,
    [["pioreactor", unit, experiment, "growth_rate_calculating/$state"      ].join("/")]: setGrowthRateJobState,
    [["pioreactor", unit, experiment, "temperature_control/$state"          ].join("/")]: setTemperatureControlJobState,
    [["pioreactor", unit, "$experiment", "monitor/$state"                   ].join("/")]: setMonitorJobState,
    [["pioreactor", unit, experiment, "stirring/duty_cycle"                 ].join("/")]: setStirringDC,
    [["pioreactor", unit, experiment, "stirring/dc_increase_between_adc_readings" ].join("/")]: setStirringDynamic,
    [["pioreactor", unit, experiment, "dosing_automation/target_od"         ].join("/")]: setTargetOD,
    [["pioreactor", unit, experiment, "temperature_automation/target_temperature" ].join("/")]: setTargetTemperature,
    [["pioreactor", unit, experiment, "dosing_automation/duration"          ].join("/")]: setDuration,
    [["pioreactor", unit, experiment, "dosing_automation/target_growth_rate"].join("/")]: setTargetGrowthRate,
    [["pioreactor", unit, experiment, "dosing_automation/volume"            ].join("/")]: setVolume,
    [["pioreactor", unit, experiment, "dosing_control/dosing_automation"    ].join("/")]: setDosingAutomation,
    [["pioreactor", unit, experiment, "led_control/led_automation"          ].join("/")]: setLedAutomation,
    [["pioreactor", unit, experiment, "temperature_control/temperature_automation" ].join("/")]: setTempAutomation,
    [["pioreactor", unit, "$experiment", "leds/intensity"                   ].join("/")]: setLEDIntensity,
  }


  useEffect(() => {
    const onConnect = () => {
      for (const topic of Object.keys(topicsToCallback)) {
        client.subscribe(topic);
      }
    }

    const onMessageArrived = (message) => {
      var parsedFloat = parseFloat(message.payloadString); // try to parse it as a float first
      var payload = isNaN(parsedFloat) ? message.payloadString : parsedFloat
      topicsToCallback[message.topic](payload)
    }

    if (!props.config['network.topology']){
      return
    }

    if (!isUnitActive){
      return
    }

    if (!experiment){
      return
    }

    var client
    if (props.config.remote && props.config.remote.ws_url) {
      client = new Client(
        `ws://${props.config.remote.ws_url}/`,
        "webui" + Math.random()
      )}
    else {
      client = new Client(
        `${props.config['network.topology']['leader_address']}`, 9001,
        "webui" + Math.random()
      );
    }
    client.onMessageArrived = onMessageArrived
    client.connect({onSuccess: onConnect, reconnect: true});
    setClient(client)
  },[props.config, props.experiment])

  const indicatorDotColor = (monitorJobState === "disconnected") ? disconnectedGrey : ((monitorJobState === "lost") ? lostRed : readyGreen)
  const indicatorDotShadow = (monitorJobState === "disconnected") ? 0 : 6
  const indicatorLabel = (monitorJobState === "disconnected") ? (isUnitActive ? "Offline, need to power up" : "Offline, change inventory status in config.ini") : ((monitorJobState === "lost") ? "Lost, something went wrong..." : "Online")

  return (
    <Card className={classes.pioreactorCard} id={unit}>

      <CardContent className={classes.cardContent}>
        <div className={"fixme"}>
          <Typography className={clsx(classes.suptitle)} color="textSecondary">
            {(props.config['ui.rename'] && props.config['ui.rename'][unit]) ? unit : ""}
          </Typography>
          <div style={{display: "flex", justifyContent: "space-between"}}>
            <div style={{display: "flex", justifyContent: "left"}}>
              <Typography className={clsx(classes.unitTitle, {[classes.disabledText]: !isUnitActive})} gutterBottom>
                <PioreactorIcon color={isUnitActive ? "inherit" : "disabled"} style={{verticalAlign: "middle"}}/>
                {(props.config['ui.rename'] && props.config['ui.rename'][unit]) ? props.config['ui.rename'][unit] : unit }
              </Typography>
              <Tooltip title={indicatorLabel} placement="right">
                <div>
                  <div aria-label={indicatorLabel} className="indicator-dot" style={{boxShadow: `0 0 ${indicatorDotShadow}px ${indicatorDotColor}, inset 0 0 12px  ${indicatorDotColor}`}}/>
                </div>
              </Tooltip>
            </div>
            <div style={{display: "flex", justifyContent: "flex-end", flexDirection: "row", flexWrap: "wrap"}}>
              <div>
                <Button style={{textTransform: 'none', float: "right" }} disabled={true} color="primary">
                  <SettingsIcon color={"disabled"} className={classes.textIcon}/> Calibrate
                </Button>
              </div>
              <div>
                <FlashLEDButton client={client} disabled={!isUnitActive} config={props.config} unit={unit}/>
              </div>
              <SettingsActionsDialog
                config={props.config}
                client={client}
                stirringJobState={stirringJobState}
                ODReadingJobState={ODReadingJobState}
                growthRateJobState={growthRateJobState}
                dosingControlJobState={dosingControlJobState}
                ledControlJobState={ledControlJobState}
                temperatureControlJobState={temperatureControlJobState}
                stirringDC={stirringDC}
                stirringDynamic={stirringDynamic}
                targetGrowthRate={targetGrowthRate}
                volume={volume}
                duration={duration}
                targetOD={targetOD}
                targetTemperature={targetTemperature}
                dosingAutomation={dosingAutomation}
                ledAutomation={ledAutomation}
                tempAutomation={tempAutomation}
                experiment={experiment}
                unit={unit}
                disabled={!isUnitActive}
              />
            </div>
          </div>
        </div>


      <div style={{
          display: "flex",
          margin: "15px 20px 20px 0px",
          flexDirection: "row",
        }}>
        <div className={classes.textboxLabel}>
          <Typography variant="body2" component="body1">
            <Box fontWeight="fontWeightBold" className={clsx({[classes.disabledText]: !isUnitActive})}>
              Activities:
            </Box>
          </Typography>
        </div>
        <div
         style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "flex-start",
          alignItems: "stretch",
          alignContent: "stretch",
        }}
        >
          <div className={classes.textbox}>
            <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
              Stirring
            </Typography>
            <UnitSettingDisplay
              value={stirringJobState}
              isUnitActive={isUnitActive}
              default="disconnected"
              isStateSetting
            />
          </div>
          <div className={classes.textbox}>
            <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
              Optical density
            </Typography>
            <UnitSettingDisplay
              value={ODReadingJobState}
              isUnitActive={isUnitActive}
              default="disconnected"
              isStateSetting
            />
          </div>
          <div className={classes.textbox}>
            <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
              Growth rate
            </Typography>
            <UnitSettingDisplay
              value={growthRateJobState}
              isUnitActive={isUnitActive}
              default="disconnected"
              isStateSetting
            />
          </div>
          <div className={classes.textbox}>
            <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
              Dosing control
            </Typography>
            <UnitSettingDisplay
              value={dosingControlJobState}
              isUnitActive={isUnitActive}
              default="disconnected"
              subtext={dosingAutomation}
              isStateSetting
            />
          </div>
          <div className={classes.textbox}>
            <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
              LED control
            </Typography>
            <UnitSettingDisplay
              value={ledControlJobState}
              isUnitActive={isUnitActive}
              default="disconnected"
              subtext={ledAutomation}
              isStateSetting
            />
          </div>
          <div className={classes.textbox}>
            <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
              Temperature control
            </Typography>
            <UnitSettingDisplay
              value={temperatureControlJobState}
              isUnitActive={isUnitActive}
              subtext={tempAutomation}
              default="NA"
              isStateSetting
            />
          </div>
        </div>
      </div>

      <Divider/>

      <div style={{
          display: "flex",
          margin: "15px 20px 20px 0px",
          flexDirection: "row",
        }}>
        <div className={classes.textboxLabel}>
          <Typography variant="body2" component="body1">
            <Box fontWeight="fontWeightBold" className={clsx({[classes.disabledText]: !isUnitActive})}>
              Settings:
            </Box>
          </Typography>
        </div>
        <div
         style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "flex-start",
          alignItems: "stretch",
          alignContent: "stretch",
        }}
        >
          <div className={classes.textbox}>
            <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
              Stirring speed
            </Typography>
            <UnitSettingDisplay
              value={stirringDC}
              isUnitActive={isUnitActive}
              default="—"
              className={classes.alignRight}
            />
          </div>
          <div className={classes.textbox}>
            <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
              Volume / dosing
            </Typography>
            <UnitSettingDisplay
              precision={2}
              measurementUnit="mL"
              value={volume}
              isUnitActive={isUnitActive}
              default="—"
              className={classes.alignRight}
            />
          </div>
          <div className={classes.textbox}>
            <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
              Target OD
            </Typography>
            <UnitSettingDisplay
              precision={2}
              value={targetOD}
              measurementUnit=" AU"
              isUnitActive={isUnitActive}
              default={"—"}
              className={classes.alignRight}
            />
          </div>
          <div className={classes.textbox}>
            <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
              Target growth rate
            </Typography>
            <UnitSettingDisplay
              precision={2}
              measurementUnit="h⁻¹"
              value={targetGrowthRate}
              isUnitActive={isUnitActive}
              default="—"
              className={classes.alignRight}
            />
          </div>
          <div className={classes.textbox}>
            <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
              Time between dosing events
            </Typography>
            <UnitSettingDisplay
              precision={0}
              measurementUnit="m"
              value={duration}
              isUnitActive={isUnitActive}
              default="—"
              className={classes.alignRight}
            />
          </div>
          <div className={classes.textbox}>
            <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
              LED intensity
            </Typography>
            <UnitSettingDisplay
              value={ledIntensity}
              isUnitActive={isUnitActive}
              default="—"
              className={classes.alignRight}
              isLEDIntensity
            />
          </div>
          <div className={classes.textbox}>
            <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
              Target temperature
            </Typography>
            <UnitSettingDisplay
              precision={2}
              value={targetTemperature}
              measurementUnit="℃"
              isUnitActive={isUnitActive}
              default={"—"}
              className={classes.alignRight}
            />
          </div>
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
      document.title = props.title;
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
    }, [props.title])

    const entries = (a) => Object.entries(a)

    return (
        <Grid container spacing={2} >
          <Grid item xs={12}><Header /></Grid>
          <Grid item xs={12} />
          <Grid item xs={12} />

          <Grid item md={1} xs={1}/>
          <Grid item md={10} xs={12}>
            <PioreactorHeader config={props.config} experiment={experimentMetadata.experiment}/>
            <ActiveUnits experiment={experimentMetadata.experiment} config={props.config} units={props.config['network.inventory'] ? entries(props.config['network.inventory']).filter((v) => v[1] === "1").map((v) => v[0]) : [] }/>
            <InactiveUnits experiment={experimentMetadata.experiment} config={props.config} units={props.config['network.inventory'] ? entries(props.config['network.inventory']).filter((v) => v[1] === "0").map((v) => v[0]) : [] }/>
          </Grid>
          <Grid item md={1} xs={1}/>
          {props.config['ui.rename'] ? <TactileButtonNotification config={props.config}/> : null}
        </Grid>
    )
}

export default Pioreactors;

