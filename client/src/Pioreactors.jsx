import clsx from 'clsx';
import { Client, Message } from "paho-mqtt";

import React, {useState, useEffect} from "react";

import Grid from '@material-ui/core/Grid';
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
import FlareIcon from '@material-ui/icons/Flare';
import SettingsIcon from '@material-ui/icons/Settings';
import TuneIcon from '@material-ui/icons/Tune';

import {parseINIString} from "./utilities"
import ButtonChangeDosingDialog from "./components/ButtonChangeDosingDialog"
import ButtonChangeLEDDialog from "./components/ButtonChangeLEDDialog"
import ButtonChangeTemperatureDialog from "./components/ButtonChangeTemperatureDialog"
import ActionDosingForm from "./components/ActionDosingForm"
import ActionLEDForm from "./components/ActionLEDForm"
import PioreactorIcon from "./components/PioreactorIcon"
import TactileButtonNotification from "./components/TactileButtonNotification";
import UnderlineSpan from "./components/UnderlineSpan";


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
    width: "127px",
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
    marginTop: "15px",
    width: "120px",
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
  },
  ledBlock:{
    width: "55px",
    display: "inline-block"
  },
  rowOfUnitSettingDisplay:{
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "stretch",
    alignContent: "stretch",
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


function UnitSettingDisplaySubtext(props){
  const classes = useStyles();

  if (props.subtext){
    return <div className={classes.unitSettingsSubtext}><code>{props.subtext}</code></div>
  }
  else{
    return <div className={classes.unitSettingsSubtextEmpty}></div>
  };
}


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
          <UnitSettingDisplaySubtext subtext={props.subtext}/>
        </React.Fragment>
    )}
  } else if (props.isLEDIntensity) {
    if (!props.isUnitActive || value === "—" || value === "") {
      return <div style={{ color: disconnectedGrey, fontSize: "13px"}}> {props.default} </div>;
    } else {
      const ledIntensities = JSON.parse(value)
        // the | {} is here to protect against the UI loading from a broken config.
      const invertedLEDMap = Object.fromEntries(Object.entries(props.config['leds']).map(([k, v]) => [v, k]))
      const A = (invertedLEDMap['A']) ? (invertedLEDMap['A'].replace("_", " ")) : null
      const B = (invertedLEDMap['B']) ? (invertedLEDMap['B'].replace("_", " ")) : null
      const C = (invertedLEDMap['C']) ? (invertedLEDMap['C'].replace("_", " ")) : null
      const D = (invertedLEDMap['D']) ? (invertedLEDMap['D'].replace("_", " ")) : null

      return(
        <React.Fragment>
          <div style={{fontSize: "13px"}}>
            <div>
              <span className={classes.ledBlock}>
                <UnderlineSpan title={A ? A : null}>A</UnderlineSpan>: {ledIntensities["A"]}%
              </span>
              <span className={classes.ledBlock}>
                <UnderlineSpan title={B ? B : null}>B</UnderlineSpan>: {ledIntensities["B"]}%
              </span>
            </div>
            <div>
              <span className={classes.ledBlock}>
                <UnderlineSpan title={C ? C : null}>C</UnderlineSpan>: {ledIntensities["C"]}%
              </span>
              <span className={classes.ledBlock}>
                <UnderlineSpan title={D ? D : null}>D</UnderlineSpan>: {ledIntensities["D"]}%
              </span>
            </div>
          </div>
          <UnitSettingDisplaySubtext subtext={props.subtext}/>
        </React.Fragment>
      )
    }
  } else {
    if (!props.isUnitActive || value === "—" || value === "") {
      return (
        <React.Fragment>
          <div style={{ color: disconnectedGrey, fontSize: "13px"}}> {props.default} </div>
          <UnitSettingDisplaySubtext subtext={props.subtext}/>
        </React.Fragment>
      );
    } else {
      return (
        <React.Fragment>
          <div style={{ fontSize: "13px"}}>
            {(typeof value === "string"
              ? value
              : +value.toFixed(props.precision)) +
              (props.measurementUnit ? props.measurementUnit : "")}
          </div>
          <UnitSettingDisplaySubtext subtext={props.subtext}/>
        </React.Fragment>
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

function CalibrateDialog(props) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [tabValue, setTabValue] = React.useState(0);


  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setTabValue(0)
    setOpen(false);
  };


  function startPioreactorJob(job){
    return function() {
      fetch("/run/" + job + "/" + props.unit, {method: "POST"}).then(res => {
      })
    }
  }

  function clearBlank() {
    return function() {
      var message = new Message("");
      message.retained = true
      message.destinationName = [
        "pioreactor",
        props.unit,
        props.experiment,
        "od_blank",
        "mean",
      ].join("/");
      props.client.publish(message);
    }
  }

  function createUserButtonsBasedOnState(jobState, job){

    switch (jobState){
      case "disconnected":
       return (<div>
               <PatientButton
                color="primary"
                variant="contained"
                onClick={startPioreactorJob(job)}
                buttonText="Start"
               />
              </div>)
      case "ready":
       return (<div>
               <PatientButton
                color="primary"
                variant="contained"
                buttonText="Running"
               />
              </div>)
      default:
        return(<div></div>)
    }
   }

  const blankODButton = createUserButtonsBasedOnState(props.odBlankJobState, "od_blank")


  return (
    <React.Fragment>
      <Button style={{textTransform: 'none', float: "right" }} color="primary" disabled={props.disabled} onClick={handleClickOpen}>
        <TuneIcon color={props.disabled ? "disabled" : "primary"} className={classes.textIcon}/> Calibrate
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
          <Tab label="Blanks"/>
          <Tab label="Dosing" disabled={true}/>
        </Tabs>
        </DialogTitle>
        <DialogContent>
          <TabPanel value={tabValue} index={0}>
            <Typography  gutterBottom>
             Record optical densities of blank (optional)
            </Typography>
            <Typography variant="body2" component="p" gutterBottom>
              For more accurate growth rate and biomass inferences, you can subtract out the
              media's optical density per sensor. Read more about <a href="">using blanks</a>.
            </Typography>

            <div style={{display: "flex", marginBottom: "10px"}}>
              <span style={{marginRight: "5px"}}>Stirring:</span>
              <UnitSettingDisplay
                value={props.stirringJobState}
                isUnitActive={true}
                default="disconnected"
                isStateSetting
              />
            </div>

            {blankODButton}

            <Typography variant="body2" component="p" style={{marginTop: "20px"}}>
              Recorded optical densities of blank vial: <code>{props.odBlankReading ? Object.entries(JSON.parse(props.odBlankReading)).map( ([k, v]) => `${k}:${v.toFixed(3)}` ).join(", ") : "—"}</code> <Button color="primary" size="small" disabled={!props.odBlankReading} onClick={clearBlank()}>Clear</Button>
            </Typography>
            <Divider className={classes.divider} />

          </TabPanel>
        </DialogContent>
      </Dialog>
  </React.Fragment>)
}






function SettingsActionsDialog(props) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [tabValue, setTabValue] = React.useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };


  function setPioreactorJobState(job, state) {
    return function() {
      setPioreactorJobAttr(`${job}/$state`, state)
    };
  }

  function startPioreactorJob(job){
    return function() {
      fetch("/run/" + job + "/" + props.unit, {method: "POST"}).then(res => {
      })
    }
  }

  function stopPioreactorJob(job){
    return function() {
      setPioreactorJobAttr(`${job}/$state`, "disconnected")
      //fetch("/stop/" + job + "/" + props.unit, {method: "POST"}).then(res => {})
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
        return (<div key={"patient_buttons_" + job}>
          <PatientButton
            color="secondary"
            variant="contained"
                onClick={startPioreactorJob(job)}
            buttonText="Start"
          />
        </div>)
      case "disconnected":
       return (<div key={"patient_buttons_" + job}>
               <PatientButton
                color="primary"
                variant="contained"
                onClick={startPioreactorJob(job)}
                buttonText="Start"
               />
              </div>)
      case "init":
      case "ready":
        return (<div key={"patient_buttons_" + job}>
          <PatientButton
            color="secondary"
            variant="contained"
            onClick={setPioreactorJobState(job, "sleeping")}
            buttonText="Pause"
          />
          <PatientButton
            color="secondary"
            onClick={stopPioreactorJob(job)}
            buttonText="Stop"
          />
        </div>)
      case "sleeping":
        return (
          <div key={"patient_buttons_" + job}>
            <PatientButton
              color="primary"
              variant="contained"
              onClick={setPioreactorJobState(job, "ready")}
              buttonText="Resume"
            />
            <PatientButton
              color="secondary"
              onClick={stopPioreactorJob(job)}
              buttonText="Stop"
            />
          </div>
          )
      default:
        return(<div key={"patient_buttons_" + job}></div>)
    }
   }
  const invertedLEDMap = Object.fromEntries(Object.entries(props.config['leds']).map(([k, v]) => [v, k]))
  const buttons = Object.fromEntries(Object.entries(props.jobs).map( ([job_key, job], i) => [job_key, createUserButtonsBasedOnState(job.state, job_key)]))

  return (
    <div>
    <Button style={{textTransform: 'none', float: "right" }} disabled={props.disabled} onClick={handleClickOpen} color="primary">
      <SettingsIcon color={props.disabled ? "disabled" : "primary"} className={classes.textIcon}/> Manage
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
        <TabPanel value={tabValue} index={0}>
          {Object.entries(props.jobs)
            .filter(([job_key, job]) => job.metadata.display)
            .map(([job_key, job]) =>
            <div key={job_key}>
              <Typography gutterBottom>
                {job.metadata.name}
              </Typography>
              <Typography variant="body2" component="p" gutterBottom>
                <div dangerouslySetInnerHTML={{__html: job.metadata.description}}/>
              </Typography>

              {buttons[job_key]}

              <Divider className={classes.divider} />
            </div>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {Object.values(props.jobs)
            .filter(job => job.metadata.display)
            .map(job =>
            Object.entries(job)
              .filter(([key, setting]) => (key !== "state") && (key !== "metadata"))
              .filter(([_, setting]) => setting.display)
              .map(([key, setting]) =>
            <React.Fragment>
              <Typography  gutterBottom>
                {setting.label}
              </Typography>
              <Typography variant="body2" component="p">
                {setting.description}
              </Typography>
              <TextField
                size="small"
                id={`${job.metadata.key.replace("_control", "_automation")}/${key}`}
                defaultValue={setting.value}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{setting.unit}</InputAdornment>,
                }}
                variant="outlined"
                onKeyPress={setPioreactorJobAttrOnEnter}
                className={classes.textFieldCompact}
              />
              <Divider className={classes.divider} />
            </React.Fragment>

          ))}


          <Typography  gutterBottom>
            Dosing automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            {props.jobs.dosing_control && props.jobs.dosing_control.state !== "disconnected" &&
              <React.Fragment>
              Currently running dosing automation <code>{props.jobs.dosing_control.dosing_automation.value}</code>.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/dosing-automations">dosing automations</a>.
              </React.Fragment>
            }
            {props.jobs.dosing_control && props.jobs.dosing_control.state === "disconnected" &&

              <React.Fragment>
              You can change the dosing automation after starting the Dosing control activity.
              </React.Fragment>
            }
          </Typography>

          <ButtonChangeDosingDialog
            unit={props.unit}
            config={props.config}
            experiment={props.experiment}
            currentDosingAutomation={props.jobs.dosing_control && props.jobs.dosing_control.dosing_automation.value}
          />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            LED automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            {props.jobs.led_control && props.jobs.led_control.state !== "disconnected" &&
              <React.Fragment>
              Currently running LED automation <code>{props.props.jobs.led_control.led_automation.value}</code>.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/led-automations">LED automations</a>.
              </React.Fragment>
            }
            {props.jobs.led_control && props.jobs.led_control.state  === "disconnected" &&

              <React.Fragment>
              You can change the LED automation after starting the LED control activity.
              </React.Fragment>
            }
          </Typography>

          <ButtonChangeLEDDialog
            unit={props.unit}
            config={props.config}
            experiment={props.experiment}
            currentLEDAutomation={props.jobs.led_control && props.jobs.led_control.led_automation.value}
          />
          <Divider className={classes.divider} />

          <Typography  gutterBottom>
            Temperature automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            {props.jobs.temperature_control && props.jobs.temperature_control.state !== "disconnected" &&
              <React.Fragment>
              Currently running temperature automation <code>{props.jobs.temperature_control.temperature_automation.value}</code>.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://pioreactor.com/pages/temperature-automations">temperature automations</a>.
              </React.Fragment>
            }
            {props.jobs.temperature_control && props.jobs.temperature_control.state === "disconnected" &&

              <React.Fragment>
              You can change the temperature automation after starting the Temperature control activity.
              </React.Fragment>
            }
          </Typography>

          <ButtonChangeTemperatureDialog
            unit={props.unit}
            config={props.config}
            experiment={props.experiment}
            currentTemperatureAutomation={props.jobs.temperature_control && props.jobs.temperature_control.temperature_automation.value}
          />
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
          <Typography  gutterBottom>
            Remove waste
          </Typography>
          <Typography variant="body2" component="p">
            Run the waste pump{props.isPlural ? "s" : ""} for a set duration (seconds), or a set volume (mL).
          </Typography>
          <ActionDosingForm action="remove_waste" unit={props.unit} />
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
    return (<div key={job}>
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
      <SettingsIcon className={classes.textIcon}/> Manage all Pioreactors
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
  const [fetchComplete, setFetchComplete] = useState(false)

  const [client, setClient] = useState(null)
  const [jobs, setJobs] = useState({
    monitor: {
      state : "disconnected", metadata: {display: false}
    },
  })



  useEffect(() => {
    function fetchContribBackgroundJobs() {
      fetch("/contrib/background_jobs")
        .then((response) => {
            if (response.ok) {
              return response.json();
            } else {
              throw new Error('Something went wrong');
            }
          })
        .then((listOfJobs) => {
          for (const job of listOfJobs){
            var metaData_ = {state: "disconnected", metadata: {name: job.name, subtext: job.subtext, display: job.display, description: job.description, key: job.job_name}}
            for(var i = 0; i < job["editable_settings"].length; ++i){
              var field = job["editable_settings"][i]
              metaData_[field.key] = {value: field.default, label: field.label, type: field.type, unit: field.unit, display: field.display, description: field.description}
            }
            setJobs((prev) => ({...prev, [job.job_name]: metaData_}))
          }
          setFetchComplete(true)
        })
        .catch((error) => {})
    }
    fetchContribBackgroundJobs();
  }, [])

  useEffect(() => {
    const onConnect = () => {
      client.subscribe(["pioreactor", unit, "$experiment", "monitor/$state"].join());

      for (const job of Object.keys(jobs)) {
        if (job === "monitor") {continue;}
        client.subscribe(["pioreactor", unit, experiment, job, "$state"].join("/"));
        for (const setting of Object.keys(jobs[job])){
          if ((setting !== "state") && (setting !== "metadata")){
            client.subscribe(["pioreactor", unit, experiment, setting.endsWith("_automation") ? job : job.replace("_control", "_automation"), setting].join("/"));
          }
        }
      }
    }

    const onMessageArrived = (message) => {
      var parsedFloat = parseFloat(message.payloadString); // try to parse it as a float first
      var payload = isNaN(parsedFloat) ? message.payloadString : parsedFloat;
      var [job, setting] = message.topic.split('/').slice(-2)
      if (setting === "$state"){
        setJobs((prev) => ({...prev, [job]: {...prev[job], state: payload}}))
      } else if (job.endsWith("_automation")) {
        // needed because settings are attached to _automations, not _control
        job = job.replace("_automation", "_control")
        setJobs((prev) => ({...prev, [job]: {...prev[job], [setting]: {...prev[job][setting], value: payload }}}))
      } else {
        console.log(job, setting)
        setJobs((prev) => ({...prev, [job]: {...prev[job], [setting]: {...prev[job][setting], value: payload }}}))
      }
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
  },[props.config, props.experiment, fetchComplete])

  const indicatorDotColor = (jobs.monitor.state === "disconnected") ? disconnectedGrey : ((jobs.monitor.state === "lost") ? lostRed : readyGreen)
  const indicatorDotShadow = (jobs.monitor.state === "disconnected") ? 0 : 6
  const indicatorLabel = (jobs.monitor.state === "disconnected") ? (isUnitActive ? "Offline, need to power up" : "Offline, change inventory status in config.ini") : ((jobs.monitor.state === "lost") ? "Lost, something went wrong..." : "Online")


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
                <FlashLEDButton client={client} disabled={!isUnitActive} config={props.config} unit={unit}/>
              </div>
              <div>
                <CalibrateDialog
                  config={props.config}
                  client={client}
                  odBlankReading={jobs['od_blank'] ? jobs['od_blank'].mean.value : null}
                  odBlankJobState={jobs['od_blank'] ? jobs['od_blank'].state : null}
                  stirringJobState={jobs['stirring'] ? jobs['stirring'].state : null}
                  experiment={experiment}
                  unit={unit}
                  disabled={!isUnitActive}
                />
              </div>
              <SettingsActionsDialog
                config={props.config}
                client={client}
                unit={unit}
                disabled={!isUnitActive}
                experiment={experiment}
                jobs={jobs}
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
          <Typography variant="body2">
            <Box fontWeight="fontWeightBold" className={clsx({[classes.disabledText]: !isUnitActive})}>
              Activities:
            </Box>
          </Typography>
        </div>
        <div
         className={classes.rowOfUnitSettingDisplay}
        >
          {Object.values(jobs)
              .filter(job => job.metadata.display)
              .map(job => (
            <div className={classes.textbox} key={job.metadata.key}>
              <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
                {job.metadata.name}
              </Typography>
              <UnitSettingDisplay
                value={job.state}
                isUnitActive={isUnitActive}
                default="disconnected"
                subtext={job.metadata.subtext ? job[job.metadata.subtext].value : null}
                isStateSetting
              />
            </div>
         ))}

        </div>
      </div>

      <Divider/>

      <div style={{
          display: "flex",
          margin: "15px 20px 20px 0px",
          flexDirection: "row",
        }}>
        <div className={classes.textboxLabel}>
          <Typography variant="body2">
            <Box fontWeight="fontWeightBold" className={clsx({[classes.disabledText]: !isUnitActive})}>
              Settings:
            </Box>
          </Typography>
        </div>
        <div
         className={classes.rowOfUnitSettingDisplay}
        >
          {Object.values(jobs).map(job =>
            Object.entries(job)
              .filter(([key, setting]) => (key !== "state") && (key !== "metadata"))
              .filter(([_, setting]) => setting.display)
              .map(([key, setting]) =>
            <div className={classes.textbox} key={job.metadata.key + key}>
              <Typography variant="body2" style={{fontSize: "0.82rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
                {setting.label}
              </Typography>
              <UnitSettingDisplay
                value={setting.value}
                isUnitActive={isUnitActive}
                measurementUnit={setting.unit}
                default="—"
                className={classes.alignRight}
                isLEDIntensity={setting.label === "LED intensity"}
                config={props.config}
              />
            </div>
         ))}
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


          <Grid item md={12} xs={12}>
            <PioreactorHeader config={props.config} experiment={experimentMetadata.experiment}/>
            <ActiveUnits experiment={experimentMetadata.experiment} config={props.config} units={props.config['network.inventory'] ? entries(props.config['network.inventory']).filter((v) => v[1] === "1").map((v) => v[0]) : [] }/>
            <InactiveUnits experiment={experimentMetadata.experiment} config={props.config} units={props.config['network.inventory'] ? entries(props.config['network.inventory']).filter((v) => v[1] === "0").map((v) => v[0]) : [] }/>
          </Grid>
          {props.config['ui.rename'] ? <TactileButtonNotification config={props.config}/> : null}
        </Grid>
    )
}

export default Pioreactors;

