import clsx from 'clsx';
import { Client, Message } from "paho-mqtt";

import React, {useState, useEffect} from "react";

import Grid from '@material-ui/core/Grid';
import PropTypes from 'prop-types';
import { useMediaQuery } from "@material-ui/core";

import { makeStyles } from '@material-ui/styles';
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
import Snackbar from '@material-ui/core/Snackbar';
import TextField from '@material-ui/core/TextField';
import Tooltip from '@material-ui/core/Tooltip';
import InputAdornment from '@material-ui/core/InputAdornment';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Button from "@material-ui/core/Button";
import AddIcon from '@material-ui/icons/Add';
import ClearIcon from '@material-ui/icons/Clear';
import CloseIcon from '@material-ui/icons/Close';
import CheckIcon from '@material-ui/icons/Check';
import FlareIcon from '@material-ui/icons/Flare';
import SettingsIcon from '@material-ui/icons/Settings';
import TuneIcon from '@material-ui/icons/Tune';
import CheckBoxOutlinedIcon from '@material-ui/icons/CheckBoxOutlined';
import IndeterminateCheckBoxIcon from '@material-ui/icons/IndeterminateCheckBox';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import List from '@material-ui/core/List';
import IconButton from '@material-ui/core/IconButton';
import ListItem from '@material-ui/core/ListItem';
import ListSubheader from '@material-ui/core/ListSubheader';
import DnsIcon from '@material-ui/icons/Dns';
import IndeterminateCheckBoxOutlinedIcon from '@material-ui/icons/IndeterminateCheckBoxOutlined';

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
  },
  testingListItemIcon: {
    minWidth: "30px"
  },
  testingListItem : {
    paddingTop: "0px",
    paddingBottom: "0px",
  },
  headerMenu: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "5px",
    [theme.breakpoints.down('md')]:{
      flexFlow: "nowrap",
      flexDirection: "column",
    }
  },
  cardHeaderSettings:{
    display: "flex",
    justifyContent: "space-between",
    [theme.breakpoints.down('sm')]:{
      flexFlow: "nowrap",
      flexDirection: "column",
    }
  },
  cardHeaderButtons: {
    display: "flex",
    justifyContent: "flex-end",
    flexDirection: "row",
    flexWrap: "wrap",
    [theme.breakpoints.down('sm')]: {
      justifyContent: "space-between",
    }
  },
  headerButtons: {display: "flex", flexDirection: "row", justifyContent: "flex-start", flexFlow: "wrap"}
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
  const value = props.value === null ?  ""  : props.value

  function prettyPrint(x){
    if (x >= 10){
      return x.toFixed(0)
    }
    else if (x==0){
      return "0"
    }
    else if (x < 1){
      return `<1`
    } else {
      return (x).toFixed(1).replace(/[.,]0$/, "")
    }
  }

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
      const LEDMap = props.config['leds']
      const renamedA = (LEDMap['A']) ? (LEDMap['A'].replace("_", " ")) : null
      const renamedB = (LEDMap['B']) ? (LEDMap['B'].replace("_", " ")) : null
      const renamedC = (LEDMap['C']) ? (LEDMap['C'].replace("_", " ")) : null
      const renamedD = (LEDMap['D']) ? (LEDMap['D'].replace("_", " ")) : null

      return(
        <React.Fragment>
          <div style={{fontSize: "13px"}}>
            <div>
              <span className={classes.ledBlock}>
                <UnderlineSpan title={renamedA ? renamedA : null}>A</UnderlineSpan>: {prettyPrint(ledIntensities["A"])}%
              </span>
              <span className={classes.ledBlock}>
                <UnderlineSpan title={renamedB ? renamedB : null}>B</UnderlineSpan>: {prettyPrint(ledIntensities["B"])}%
              </span>
            </div>
            <div>
              <span className={classes.ledBlock}>
                <UnderlineSpan title={renamedC ? renamedC : null}>C</UnderlineSpan>: {prettyPrint(ledIntensities["C"])}%
              </span>
              <span className={classes.ledBlock}>
                <UnderlineSpan title={renamedD ? renamedD : null}>D</UnderlineSpan>: {prettyPrint(ledIntensities["D"])}%
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
              : +value.toFixed(props.precision)) + " " +
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
      <Button style={{textTransform: 'none', float: "right" }} color="secondary" onClick={handleClickOpen}>
        <ClearIcon fontSize="15" classes={{root: classes.textIcon}}/> Stop all activity
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
  const [ip, setIP] = React.useState("");
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

  const handleIPChange = evt => {
    setIP(evt.target.value.replace(/[^\.0-9]/, ""))
  }

  const onSubmit = (event) =>{
    event.preventDefault()
    if (!name) {
      setIsError(true)
      setErrorMsg("Provide the hostname for the new Pioreactor worker")
      return
    }
    setIsError(false)
    setIsRunning(true)
    fetch('add_new_pioreactor',{
        method: "POST",
        body: JSON.stringify({newPioreactorName: name, ipAddress: ip}),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
    })
    .then(response => {
        if(!response.ok){
          setIsError(true)
          setIsRunning(false)
          response.json().then(data => setErrorMsg(`Unable to complete installation. ${data.msg}`))
        }
    })
  }

  const runningFeedback = isRunning ? <CircularProgress color="inherit" size={24}/> : "Add Pioreactor"

  return (
    <React.Fragment>
    <Button onClick={handleClickOpen} style={{textTransform: 'none', float: "right", marginRight: "0px"}} color="primary">
      <AddIcon fontSize="15" classes={{root: classes.textIcon}}/> Add new Pioreactor
    </Button>
    <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
      <DialogTitle>
        Add new Pioreactor
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
      <p>Follow the instructions to <a href="https://docs.pioreactor.com/user_guide/Raspberry%20Pi%20set%20up%20and%20software%20installation#adding-workers-to-your-cluster">set up your Pioreactor's Raspberry Pi</a>.</p>

      <p>Below, provide the hostname you used when installing the Pioreactor image onto the Raspberry Pi.
      Your existing Pioreactors will automatically connect it to the cluster.
      When finished, the new Pioreactor will show up on this page.</p>


      <div>
        <TextField
          required
          size="small"
          id="new-pioreactor-name"
          label="Provide hostname"
          variant="outlined"
          className={classes.textFieldWide}
          onChange={handleNameChange}
          value={name}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PioreactorIcon style={{fontSize: "1.1em"}}/>
              </InputAdornment>
            ),
          }}
        />
        <br/>
        <TextField
          size="small"
          id="new-pioreactor-ip"
          label="IP address of RPi"
          placeholder="Optional"
          variant="outlined"
          className={classes.textFieldWide}
          onChange={handleIPChange}
          value={ip}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <DnsIcon style={{fontSize: "1.1em"}}/>
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
      message={`Adding new Pioreactor ${name}`}
      autoHideDuration={7000}
      key={"snackbar-add-new"}
    />
    </React.Fragment>
)}



function PioreactorHeader(props) {
  const classes = useStyles()
  return (
    <div>
      <div className={classes.headerMenu}>
        <Typography variant="h5" component="h1">
          <Box fontWeight="fontWeightBold">
            Pioreactors
          </Box>
        </Typography>
        <div className={classes.headerButtons}>
          <ButtonConfirmStopProcessDialog/>
          <AddNewPioreactor config={props.config}/>
          <SettingsActionsDialogAll config={props.config} experiment={props.experiment}/>
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
      disabled={props.disabled}
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
    setOpen(false)
    setTimeout(()=> setTabValue(0), 200) // we put a timeout here so the switching tabs doesn't occur during the close transition.
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
                disabled={true}
               />
              </div>)
      default:
        return(<div></div>)
    }
   }

  const blankODButton = createUserButtonsBasedOnState(props.odBlankJobState, "od_blank")
  const stirringCalibrationButton = createUserButtonsBasedOnState(props.stirringCalibrationState, "stirring_calibration")


  return (
    <React.Fragment>
      <Button style={{textTransform: 'none', float: "right" }} color="primary" disabled={props.disabled} onClick={handleClickOpen}>
        <TuneIcon color={props.disabled ? "disabled" : "primary"} fontSize="15" classes={{root: classes.textIcon}}/> Calibrate
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
            >
            <Tab label="Blanks"/>
            <Tab label="Stirring"/>
            <Tab label="Dosing" disabled={true}/>
          </Tabs>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
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

            {blankODButton}

            <Typography variant="body2" component="p" style={{marginTop: "20px"}}>
              Recorded optical densities of blank vial: <code>{props.odBlankReading ? Object.entries(JSON.parse(props.odBlankReading)).map( ([k, v]) => `${k}:${v.toFixed(4)}` ).join(", ") : "—"}</code> <Button color="primary" size="small" disabled={!props.odBlankReading} onClick={clearBlank()}>Clear</Button>
            </Typography>
            <Divider className={classes.divider} />

          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <Typography  gutterBottom>
             Stirring calibration (optional)
            </Typography>
            <Typography variant="body2" component="p" gutterBottom>
              You can improve the responsiveness of stirring RPM changes by running the below calibration. This calibration is
              optional, and stirring RPM changes can still occur without running this calibration.
            </Typography>

            <Typography variant="body2" component="p" gutterBottom>
            Add a vial, with a stirbar and ~15ml water, to the Pioreactor, then hit Start below. This calibration will take less than three minutes.
            </Typography>

            {stirringCalibrationButton}

            <Divider className={classes.divider} />

          </TabPanel>
        </DialogContent>
      </Dialog>
  </React.Fragment>)
}



function SystemCheckDialog(props) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);


  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };


  function startPioreactorJob(job){
    return function() {
      fetch("/run/" + job + "/" + props.unit, {method: "POST"}).then(res => {
      })
    }
  }

  function displayIcon(key, state){
    if (props.selfTestTests == null){
      return <IndeterminateCheckBoxIcon />
    }
    else if (props.selfTestTests[key].value === 1){
      return <CheckIcon style={{color: readyGreen}}/>
    }
    else if (props.selfTestTests[key].value === 0){
      return <CloseIcon style={{color: lostRed}}/>
    }
    else if (state === "ready") {
      return <CircularProgress size={20} />
    }
    else {
      return <IndeterminateCheckBoxIcon />
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
                disabled={true}
                buttonText="Running"
               />
              </div>)
      default:
        return(<div></div>)
    }
  }

  function colorOfIcon(){
    return props.disabled ? "disabled" : "primary"
  }

  function Icon(){
    if (props.selfTestTests == null){
      return <IndeterminateCheckBoxOutlinedIcon color={colorOfIcon()} fontSize="15" classes={{root: classes.textIcon}}/>
    }
    else {
      return props.selfTestTests["all_tests_passed"].value ? <CheckBoxOutlinedIcon color={colorOfIcon()} fontSize="15" classes={{root: classes.textIcon}}/> : <IndeterminateCheckBoxOutlinedIcon color={colorOfIcon()} fontSize="15" classes={{root: classes.textIcon}}/>
    }
  }

  const selfTestButton = createUserButtonsBasedOnState(props.selfTestState, "self_test")

  return (
    <React.Fragment>
      <Button style={{textTransform: 'none', float: "right" }} color="primary" disabled={props.disabled} onClick={handleClickOpen}>
        {Icon()} Self test
      </Button>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>
          <Typography className={classes.suptitle} gutterBottom>
            <PioreactorIcon style={{verticalAlign: "middle", fontSize: "1.2em"}}/> {(props.config['ui.rename'] &&  props.config['ui.rename'][props.unit]) ? `${props.config['ui.rename'][props.unit]} / ${props.unit}` : `${props.unit}`}
          </Typography>
           Self test
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" component="p" gutterBottom>
            Perform a check of the heating & temperature sensor, LEDs & photodiodes, and stirring.
          </Typography>

            {selfTestButton}
            <Divider className={classes.divider} />

            <List component="nav"
              subheader={
                <ListSubheader style={{lineHeight: "35px"}} component="div" disableSticky={true} disableGutters={true}>
                  LEDs & photodiodes
                </ListSubheader>
              }
            >
              <ListItem className={classes.testingListItem}>
                <ListItemIcon className={classes.testingListItemIcon}>
                  {displayIcon("test_pioreactor_hat_present", props.selfTestState)}
                </ListItemIcon>
                <ListItemText primary="Pioreactor HAT is detected" />
              </ListItem>
              <ListItem className={classes.testingListItem}>
                <ListItemIcon className={classes.testingListItemIcon}>
                  {displayIcon("test_all_positive_correlations_between_pds_and_leds", props.selfTestState)}
                </ListItemIcon>
                <ListItemText primary="Photodiodes as defined in config.ini is responsive to IR LED" secondary={
                    props.selfTestTests ?
                      JSON.parse(props.selfTestTests["correlations_between_pds_and_leds"].value).map(led_pd => `${led_pd[0]} ⇝ ${led_pd[1]}`).join(",  ") :
                      ""
                    }/>
              </ListItem>
              <ListItem className={classes.testingListItem}>
                <ListItemIcon className={classes.testingListItemIcon}>
                  {displayIcon("test_ambient_light_interference", props.selfTestState)}
                </ListItemIcon>
                <ListItemText primary="No ambient IR light detected" />
              </ListItem>
            </List>

            <List component="nav"
              subheader={
                <ListSubheader style={{lineHeight: "35px"}} component="div" disableSticky={true} disableGutters={true}>
                  Heating & temperature
                </ListSubheader>
              }
            >
              <ListItem className={classes.testingListItem}>
                <ListItemIcon className={classes.testingListItemIcon}>
                  {displayIcon("test_detect_heating_pcb", props.selfTestState)}
                </ListItemIcon>
                <ListItemText primary="Temperature sensor is detected" />
              </ListItem>

              <ListItem className={classes.testingListItem}>
                <ListItemIcon className={classes.testingListItemIcon}>
                  {displayIcon("test_positive_correlation_between_temp_and_heating", props.selfTestState)}
                </ListItemIcon>
                <ListItemText primary="Heating is responsive" />
              </ListItem>
            </List>


            <List component="nav"
              subheader={
                <ListSubheader style={{lineHeight: "35px"}} component="div" disableSticky={true} disableGutters={true}>
                  Stirring
                </ListSubheader>
              }
            >
              <ListItem className={classes.testingListItem}>
                <ListItemIcon className={classes.testingListItemIcon}>
                  {displayIcon("test_positive_correlation_between_rpm_and_stirring", props.selfTestState)}
                </ListItemIcon>
                <ListItemText primary="Stirring RPM is responsive" />
              </ListItem>
            </List>

          <Divider className={classes.divider} />
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

  function setPioreactorJobAttrOnEnter(measurementUnit) {
    return function(e) {
      if ((e.key === "Enter") && (e.target.value)) {
        setPioreactorJobAttr(e.target.id, e.target.value);
        setSnackbarMessage(`Updating to ${e.target.value} ${measurementUnit}.`)
        setSnackbarOpen(true)
      }
    }
  }


  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(()=> setTabValue(0), 200) // we put a timeout here so the switching tabs doesn't occur during the close transition.
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
        return (<div key={"patient_buttons_" + job}>
          <PatientButton
            color="primary"
            variant="contained"
            onClick={()=>(false)}
            buttonText=<CircularProgress color="inherit" size={22}/>
            disabled={true}
          />
          <PatientButton
            color="secondary"
            onClick={stopPioreactorJob(job)}
            buttonText="Stop"
          />
        </div>)
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
  const LEDMap = props.config['leds']
  const buttons = Object.fromEntries(Object.entries(props.jobs).map( ([job_key, job], i) => [job_key, createUserButtonsBasedOnState(job.state, job_key)]))

  const stateDisplay = {
    "init":          {display: "Starting", color: readyGreen},
    "ready":         {display: "On", color: readyGreen},
    "sleeping":      {display: "Paused", color: disconnectedGrey},
    "disconnected":  {display: "Off", color: disconnectedGrey},
    "lost":          {display: "Lost", color: lostRed},
    "NA":            {display: "Not available", color: disconnectedGrey},
  }

  const isLargeScreen = useMediaQuery(theme => theme.breakpoints.down("lg"));

  return (
    <div>
    <Button style={{textTransform: 'none', float: "right" }} disabled={props.disabled} onClick={handleClickOpen} color="primary">
      <SettingsIcon color={props.disabled ? "disabled" : "primary"} fontSize="15" classes={{root: classes.textIcon}}/> Manage
    </Button>
    <Dialog maxWidth={isLargeScreen ? "sm" : "md"} fullWidth={true} open={open} onClose={handleClose}>
      <DialogTitle>
        <Typography className={classes.suptitle}>
          <PioreactorIcon style={{verticalAlign: "middle", fontSize: "1.2em"}}/> {(props.config['ui.rename'] &&  props.config['ui.rename'][props.unit]) ? `${props.config['ui.rename'][props.unit]} / ${props.unit}` : `${props.unit}`}
        </Typography>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        indicatorColor="primary"
        textColor="primary"
        variant="scrollable"
        scrollButtons
        allowScrollButtonsMobile
        >
        <Tab label="Activities"/>
        <Tab label="Automations"/>
        <Tab label="Settings"/>
        <Tab label="Dosing"/>
        <Tab label="LEDs"/>
      </Tabs>
      </DialogTitle>
      <DialogContent>
        <TabPanel value={tabValue} index={0}>
          {/* Activities panel */}
          {Object.entries(props.jobs)
            .filter(([job_key, job]) => job.metadata.display)
            .map(([job_key, job]) =>
            <div key={job_key}>
              <div style={{justifyContent: "space-between", display: "flex"}}>
                <Typography display="block">
                  {job.metadata.name}
                </Typography>
                <Typography display="block" gutterBottom>
                  <span style={{color:stateDisplay[job.state].color}}>{stateDisplay[job.state].display}</span>
                </Typography>
              </div>
              <Typography variant="caption" display="block" gutterBottom color="textSecondary">
                {job.metadata.source !== "app" ? `Installed by ${job.metadata.source}` : ""}
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
          {/* Automations panel */}

          <Typography  gutterBottom>
            Dosing automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            {props.jobs.dosing_control && props.jobs.dosing_control.state !== "disconnected" &&
              <React.Fragment>
              Currently running dosing automation <code>{props.jobs.dosing_control.automation_name.value}</code>.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://docs.pioreactor.com/user_guide/Automations/Dosing%20Automations">dosing automations</a>.
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
            currentDosingAutomation={props.jobs.dosing_control && props.jobs.dosing_control.automation_name.value}
          />
          {console.log(props.jobs.dosing_control)}
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            LED automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            {props.jobs.led_control && props.jobs.led_control.state !== "disconnected" &&
              <React.Fragment>
              Currently running LED automation <code>{props.jobs.led_control.automation_name.value}</code>.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://docs.pioreactor.com/user_guide/Automations/LED%20Automations">LED automations</a>.
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
            currentLEDAutomation={props.jobs.led_control && props.jobs.led_control.automation_name.value}
          />
          <Divider className={classes.divider} />

          <Typography  gutterBottom>
            Temperature automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
            {props.jobs.temperature_control && props.jobs.temperature_control.state !== "disconnected" &&
              <React.Fragment>
              Currently running temperature automation <code>{props.jobs.temperature_control.automation_name.value}</code>.
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://docs.pioreactor.com/user_guide/Automations/Temperature%20Automations">temperature automations</a>.
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
            currentTemperatureAutomation={props.jobs.temperature_control && props.jobs.temperature_control.automation_name.value}
          />
          <Divider className={classes.divider} />

        </TabPanel>


        <TabPanel value={tabValue} index={2}>
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
                onKeyPress={setPioreactorJobAttrOnEnter(setting.unit)}
                className={classes.textFieldCompact}
              />
              <Divider className={classes.divider} />
            </React.Fragment>

          ))}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography  gutterBottom>
            Add media
          </Typography>
          <Typography variant="body2" component="p">
            Run the media pump for a set duration (seconds), or a set volume (mL).
          </Typography>
          <ActionDosingForm action="add_media" unit={props.unit} />
          <Divider classes={{root: classes.divider}} />
          <Typography  gutterBottom>
            Remove waste
          </Typography>
          <Typography variant="body2" component="p">
            Run the waste pump for a set duration (seconds), or a set volume (mL).
          </Typography>
          <ActionDosingForm action="remove_waste" unit={props.unit} />
          <Divider className={classes.divider} />
          <Typography gutterBottom>
            Add alternative media
          </Typography>
          <Typography variant="body2" component="p">
            Run the alternative media pump for a set duration (seconds), or a set
            volume (mL).
          </Typography>
          <ActionDosingForm action="add_alt_media" unit={props.unit} />
          <Divider className={classes.divider} />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Typography className={clsx(classes.suptitle)} color="textSecondary">
            {(LEDMap['A']) ? "Channel A" : ""}
          </Typography>
          <Typography style={{textTransform: "capitalize"}}>
            {(LEDMap['A']) ? (LEDMap['A'].replace("_", " ").replace("led", "LED")) : "Channel A" }
          </Typography>
          <ActionLEDForm channel="A" unit={props.unit} />
          <Divider className={classes.divider} />

          <Typography className={clsx(classes.suptitle)} color="textSecondary">
            {(LEDMap['B']) ? "Channel B" : ""}
          </Typography>
          <Typography style={{textTransform: "capitalize"}}>
            {(LEDMap['B']) ? (LEDMap['B'].replace("_", " ").replace("led", "LED")) : "Channel B" }
          </Typography>
          <ActionLEDForm channel="B" unit={props.unit} />
          <Divider className={classes.divider} />

          <Typography className={clsx(classes.suptitle)} color="textSecondary">
            {(LEDMap['C']) ? "Channel C" : ""}
          </Typography>
          <Typography style={{textTransform: "capitalize"}}>
            {(LEDMap['C']) ? (LEDMap['C'].replace("_", " ").replace("led", "LED")) : "Channel C" }
          </Typography>

          <ActionLEDForm channel="C" unit={props.unit} />
          <Divider className={classes.divider} />

          <Typography className={clsx(classes.suptitle)} color="textSecondary">
            {(LEDMap['D']) ? "Channel D" : ""}
          </Typography>
          <Typography style={{textTransform: "capitalize"}}>
            {(LEDMap['D']) ? (LEDMap['D'].replace("_", " ").replace("led", "LED")) : "Channel D" }
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


function SettingsActionsDialogAll({config, experiment}) {

  const classes = useStyles();
  const unit = "$broadcast"
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [tabValue, setTabValue] = React.useState(0);
  const [jobs, setJobs] = React.useState({});


  useEffect(() => {
    function fetchContribBackgroundJobs() {
      fetch("/contrib/jobs")
        .then((response) => {
            if (response.ok) {
              return response.json();
            } else {
              throw new Error('Something went wrong');
            }
          })
        .then((listOfJobs) => {
          var jobs_ = {}
          for (const job of listOfJobs){
            var metaData_ = {state: "disconnected", metadata: {name: job.name, subtext: job.subtext, display: job.display, description: job.description, key: job.job_name, source:job.source}}
            for(var i = 0; i < job["editable_settings"].length; ++i){
              var field = job["editable_settings"][i]
              metaData_[field.key] = {value: field.default, label: field.label, type: field.type, unit: field.unit || null, display: field.display, description: field.description}
            }
            jobs_[job.job_name] = metaData_
          }
          setJobs((prev) => ({...prev, ...jobs_}))
        })
        .catch((error) => {})
    }
    fetchContribBackgroundJobs();
  }, [])


  useEffect(() => {
    if (!config['network.topology']){
      return
    }

    var client
    if (config.remote && config.remote.ws_url) {
      client = new Client(
        `ws://${config.remote.ws_url}/`,
        "webui_SettingsActionsDialogAll" + Math.random()
      )}
    else {
      client = new Client(
        `${config['network.topology']['leader_address']}`, 9001,
        "webui_SettingsActionsDialogAll" + Math.random()
      );
    }
    client.connect({timeout: 180, reconnect: true});
    setClient(client)
  },[config])


  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  function setPioreactorJobState(job, state) {
    return function sendMessage() {
      var message = new Message(String(state));
      message.destinationName = [
        "pioreactor",
        unit,
        experiment,
        job.metadata.key,
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
        setSnackbarMessage(`${verbs[state]} ${job.metadata.name.toLowerCase()} on all active Pioreactors`)
        setSnackbarOpen(true)
      }
    };
  }

  function startPioreactorJob(job){
    return function() {
      setSnackbarMessage(`Starting ${job.metadata.name.toLowerCase()} on all active Pioreactors`)
      setSnackbarOpen(true)
      fetch("/run/" + job.metadata.key + "/" + unit, {method: "POST"})
    }
  }


  function setPioreactorJobAttr(job_attr, value) {
    var message = new Message(String(value));
    message.destinationName = [
      "pioreactor",
      unit,
      experiment,
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

  function setPioreactorJobAttrOnEnter(measurementUnit) {
    return function(e) {
      if ((e.key === "Enter") && (e.target.value)) {
        setPioreactorJobAttr(e.target.id, e.target.value);
        setSnackbarMessage(`Updating to ${e.target.value} ${measurementUnit}.`)
        setSnackbarOpen(true)
      }
    }
  }

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(()=> setTabValue(0), 200) // we put a timeout here so the switching tabs doesn't occur during the close transition.

  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false)
  }


  function createUserButtonsBasedOnState(job){
    return (<div key={job.key}>
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


  const buttons = Object.fromEntries(Object.entries(jobs).map( ([job_key, job], i) => [job_key, createUserButtonsBasedOnState(job)]))
  const isLargeScreen = useMediaQuery(theme => theme.breakpoints.down("lg"));


  return (
    <React.Fragment>
    <Button style={{textTransform: 'none', float: "right" }} onClick={handleClickOpen} color="primary">
      <SettingsIcon fontSize="15" classes={{root: classes.textIcon}}/> Manage all Pioreactors
    </Button>
    <Dialog  maxWidth={isLargeScreen ? "sm" : "md"} fullWidth={true}  open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
      <DialogTitle style={{backgroundImage: "linear-gradient(to bottom left, rgba(83, 49, 202, 0.4), rgba(0,0,0,0))"}}>
        <Typography className={classes.suptitle}>
          <b>All active Pioreactors</b>
        </Typography>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[600],
          }}
        >
          <CloseIcon />
        </IconButton>
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        indicatorColor="primary"
        textColor="primary"
        variant="scrollable"
        scrollButtons
        allowScrollButtonsMobile
      >
        <Tab label="Activities"/>
        <Tab label="Automations"/>
        <Tab label="Settings"/>
        <Tab label="Dosing"/>
        <Tab label="LEDs"/>
      </Tabs>
      </DialogTitle>
      <DialogContent>

        <TabPanel value={tabValue} index={0}>
          {Object.entries(jobs)
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

              <Divider classes={{root: classes.divider}} />
            </div>
          )}
        </TabPanel>
       <TabPanel value={tabValue} index={1}>

          <Typography  gutterBottom>
            Dosing automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://docs.pioreactor.com/user_guide/Automations/Dosing%20Automations">dosing automations</a>.
          </Typography>

          <ButtonChangeDosingDialog
            unit={unit}
            config={config}
            experiment={experiment}
            currentDosingAutomation={true}
            title="All active Pioreactors"
          />
          <Divider classes={{root: classes.divider}} />
          <Typography  gutterBottom>
            LED automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://docs.pioreactor.com/user_guide/Automations/LED%20Automations">LED automations</a>.
          </Typography>

          <ButtonChangeLEDDialog
            unit={unit}
            config={config}
            experiment={experiment}
            currentLEDAutomation={true}
            title="All active Pioreactors"
          />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Temperature automation
          </Typography>
          <Typography variant="body2" component="p" gutterBottom>
              Learn more about <a target="_blank" rel="noopener noreferrer" href="https://docs.pioreactor.com/user_guide/Automations/Temperature%20Automations">temperature automations</a>.
          </Typography>

          <ButtonChangeTemperatureDialog
            unit={unit}
            config={config}
            experiment={experiment}
            currentTemperatureAutomation={true}
            title="All active Pioreactors"
          />
          <Divider className={classes.divider} />
        </TabPanel>


        <TabPanel value={tabValue} index={2}>
          {Object.values(jobs)
            .filter(job => job.metadata.display)
            .map(job =>
            Object.entries(job)
              .filter(([key, setting]) => (key !== "state") && (key !== "metadata"))
              .filter(([_, setting]) => setting.display)
              .map(([key, setting]) =>
            <React.Fragment key={key}>
              <Typography  gutterBottom>
                {setting.label}
              </Typography>
              <Typography variant="body2" component="p">
                {setting.description}
              </Typography>
              <TextField
                size="small"
                id={`${job.metadata.key.replace("_control", "_automation")}/${key}`}
                key={key}
                defaultValue={setting.value}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{setting.unit}</InputAdornment>,
                }}
                variant="outlined"
                onKeyPress={setPioreactorJobAttrOnEnter(setting.unit)}
                className={classes.textFieldCompact}
              />
              <Divider classes={{root: classes.divider}} />
            </React.Fragment>

          ))}

        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          <Typography  gutterBottom>
            Add media
          </Typography>
          <Typography variant="body2" component="p">
            Run the media pumps for a set duration (seconds), or a set volume (mL).
          </Typography>
          <ActionDosingForm action="add_media" unit={unit} />
          <Divider className={classes.divider} />
          <Typography gutterBottom>
            Add alternative media
          </Typography>
          <Typography variant="body2" component="p">
            Run the alternative media pumps for a set duration (seconds), or a set
            volume (mL).
          </Typography>
          <ActionDosingForm action="add_alt_media" unit={unit} />
          <Divider className={classes.divider} />
          <Typography  gutterBottom>
            Remove waste
          </Typography>
          <Typography variant="body2" component="p">
            Run the waste pumps for a set duration (seconds), or a set volume (mL).
          </Typography>
          <ActionDosingForm action="remove_waste" unit={unit} />
          <Divider className={classes.divider} />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Typography style={{textTransform: "capitalize"}}>
            Channel A
          </Typography>
          <ActionLEDForm channel="A" unit={unit} />
          <Divider className={classes.divider} />

          <Typography style={{textTransform: "capitalize"}}>
            Channel B
          </Typography>
          <ActionLEDForm channel="B" unit={unit} />
          <Divider className={classes.divider} />

          <Typography style={{textTransform: "capitalize"}}>
            Channel C
          </Typography>
          <ActionLEDForm channel="C" unit={unit} />

          <Divider className={classes.divider} />
          <Typography style={{textTransform: "capitalize"}}>
            Channel D
          </Typography>
          <ActionLEDForm channel="D" unit={unit} />

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
      key={"snackbar" + unit + "settings"}
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
        "flicker_led_response_okay",
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
      <FlareIcon color={props.disabled ? "disabled" : "primary"} fontSize="15" classes={{root: classes.textIcon}}/> <span >  Blink  </span>
    </Button>
)}



function PioreactorCard(props){
  const classes = useStyles();
  const unit = props.unit
  const isUnitActive = props.isUnitActive
  const experiment = props.experiment
  const config = props.config
  const [fetchComplete, setFetchComplete] = useState(false)

  const [client, setClient] = useState(null)
  const [jobs, setJobs] = useState({
    monitor: {
      state : "disconnected", metadata: {display: false}
    },
  })



  useEffect(() => {
    function fetchContribBackgroundJobs() {
      fetch("/contrib/jobs")
        .then((response) => {
            if (response.ok) {
              return response.json();
            } else {
              throw new Error('Something went wrong');
            }
          })
        .then((listOfJobs) => {
          var jobs_ = {}
          for (const job of listOfJobs){
            var metaData_ = {state: "disconnected", metadata: {name: job.name, subtext: job.subtext, display: job.display, description: job.description, key: job.job_name, source: job.source, is_testing: job.is_testing}}
            for(var i = 0; i < job["editable_settings"].length; ++i){
              var field = job["editable_settings"][i]
              metaData_[field.key] = {value: field.default, label: field.label, type: field.type, unit: field.unit || null, display: field.display, description: field.description}
            }
            jobs_[job.job_name] = metaData_
          }
          setJobs((prev) => ({...prev, ...jobs_}))
          setFetchComplete(true)
        })
        .catch((error) => {})
    }
    fetchContribBackgroundJobs();
  }, [])

  useEffect(() => {
    const onConnect = () => {
      client.subscribe(["pioreactor", unit, "$experiment", "monitor", "$state"].join("/"));
      for (const job of Object.keys(jobs)) {
        if (job === "monitor") {continue;}

        // for some jobs (self_test), we use a different experiment name to not clutter datasets,
        const experimentName = jobs[job].metadata.is_testing ? "_testing_" + experiment : experiment

        client.subscribe(["pioreactor", unit, experimentName, job, "$state"].join("/"));
        for (const setting of Object.keys(jobs[job])){
          if ((setting !== "state") && (setting !== "metadata")){
            var topic = [
              "pioreactor",
              unit,
              experimentName,
              (setting === "automation_name") ? job : job.replace("_control", "_automation"), // this is for, ex, automation_name
              setting
            ].join("/")
            client.subscribe(topic);
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
  },[config, experiment, fetchComplete, isUnitActive])

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
          <div className={classes.cardHeaderSettings}>
            <div style={{display: "flex", justifyContent: "left"}}>
              <Typography className={clsx(classes.unitTitle, {[classes.disabledText]: !isUnitActive})} gutterBottom>
                <PioreactorIcon color={isUnitActive ? "inherit" : "disabled"} style={{verticalAlign: "middle"}} sx={{ display: {xs: 'none', sm: 'none', md: 'inline' } }}/>
                {(props.config['ui.rename'] && props.config['ui.rename'][unit]) ? props.config['ui.rename'][unit] : unit }
              </Typography>
              <Tooltip title={indicatorLabel} placement="right">
                <div>
                  <div aria-label={indicatorLabel} className="indicator-dot" style={{boxShadow: `0 0 ${indicatorDotShadow}px ${indicatorDotColor}, inset 0 0 12px  ${indicatorDotColor}`}}/>
                </div>
              </Tooltip>
            </div>
            <div className={classes.cardHeaderButtons}>
              <div>
                <FlashLEDButton client={client} disabled={!isUnitActive} config={props.config} unit={unit}/>
              </div>
              <div>
                <SystemCheckDialog
                  client={client}
                  disabled={!isUnitActive}
                  config={props.config}
                  unit={unit}
                  selfTestState={jobs['self_test'] ? jobs['self_test'].state : null}
                  selfTestTests={jobs['self_test'] ? jobs['self_test'] : null}
                />
              </div>
              <div>
                <CalibrateDialog
                  config={props.config}
                  client={client}
                  odBlankReading={jobs['od_blank'] ? jobs['od_blank'].mean.value : null}
                  odBlankJobState={jobs['od_blank'] ? jobs['od_blank'].state : null}
                  stirringCalibrationState={jobs['stirring_calibration'] ? jobs['stirring_calibration'].state : null}
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
              <Typography variant="body2" style={{fontSize: "0.84rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
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
              <Typography variant="body2" style={{fontSize: "0.84rem"}} className={clsx({[classes.disabledText]: !isUnitActive})}>
                {setting.label}
              </Typography>
              <UnitSettingDisplay
                value={setting.value}
                isUnitActive={isUnitActive}
                measurementUnit={setting.unit}
                precision={2}
                default="—"
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

function Pioreactors({title, config}) {
    const [experimentMetadata, setExperimentMetadata] = React.useState({})

    React.useEffect(() => {
      document.title = title;
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
    }, [title])

    const entries = (a) => Object.entries(a)

    return (
        <Grid container spacing={2} >


          <Grid item md={12} xs={12}>
            <PioreactorHeader config={config} experiment={experimentMetadata.experiment}/>
            <ActiveUnits experiment={experimentMetadata.experiment} config={config} units={config['network.inventory'] ? entries(config['network.inventory']).filter((v) => v[1] === "1").map((v) => v[0]) : [] }/>
            <InactiveUnits experiment={experimentMetadata.experiment} config={config} units={config['network.inventory'] ? entries(config['network.inventory']).filter((v) => v[1] === "0").map((v) => v[0]) : [] }/>
          </Grid>
          {config['ui.rename'] ? <TactileButtonNotification config={config}/> : null}
        </Grid>
    )
}

export default Pioreactors;

