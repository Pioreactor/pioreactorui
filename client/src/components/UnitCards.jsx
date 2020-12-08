import React, { useState, useEffect } from "react";

import { Client, Message } from "paho-mqtt";

import { makeStyles } from "@material-ui/styles";
import Card from "@material-ui/core/Card";
import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import Slider from "@material-ui/core/Slider";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import IconButton from "@material-ui/core/IconButton";
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Snackbar from '@material-ui/core/Snackbar';
import Grid from '@material-ui/core/Grid';
import CircularProgress from '@material-ui/core/CircularProgress';

import {parseINIString} from "../utilities"
import ActionPumpForm from "./ActionPumpForm"

const onlineGreen = "#4caf50"
const offlineGrey = "grey"
const errorRed = "#DE3618"

const useStyles = makeStyles({
  root: {
    minWidth: 100,
    marginTop: "15px",
  },
  content: {
    paddingLeft: "15px",
    paddingRight: "15px",
    paddingTop: "10px",
    paddingBottom: "0px",
  },
  unitTitle: {
    fontSize: 17,
    color: "rgba(0, 0, 0, 0.60)",
  },
  unitTitleDialog :{
    fontSize: 20,
    color: "rgba(0, 0, 0, 0.60)",
  },
  unitTitleDisable: {
    color: "rgba(0, 0, 0, 0.38)",
    fontSize: 17,
  },
  disabledText: {
    color: "rgba(0, 0, 0, 0.38)",
  },
  pos: {
    marginBottom: 0,
    fontSize: 15,
  },
  footnote: {
    marginBottom: 0,
    fontSize: 12,
  },
  paper: {
    position: "absolute",
    width: 650,
    backgroundColor: "white",
    border: "2px solid #000",
    padding: 15,
    overflowY: "scroll",
    maxHeight: "80%",
  },
  slider: {
    width: "70%",
    margin: "40px auto 0px auto",
  },
  divider: {
    marginTop: 10,
    marginBottom: 10,
  },
  textbox: {
    display: "flex",
    fontSize: 13,
  },
  alignLeft: {
    flex: 1,
    textAlign: "left",
    fontSize: 13,
  },
  alignRight: {
    flex: 1,
    textAlign: "right",
  },
  textField: {
    marginTop: "15px",
    maxWidth: "180px",
  },
  displaySettingsHidden: {
    height: "60px",
    overflow: "hidden",
  },
  suptitle: {
    fontSize: "12px",
  }

});


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
      style={{width: "70px"}}
      color={props.color}
      variant={props.variant}
      size="small"
      onClick={wrappingOnClick()}
    >
      {buttonText}
    </Button>
  )
}



class UnitSettingDisplay extends React.Component {
  constructor(props) {
    super(props);
    this.state = { msg: this.props.default };
    this.onConnect = this.onConnect.bind(this);
    this.onMessageArrived = this.onMessageArrived.bind(this);
  }

  updateParent(data) {
    try {
      this.props.passChildData(data);
    } catch (e) {}
  }

  MQTTConnect() {
    {
      // need to have unique clientIds
      this.client = new Client(
        "ws://pioreactorws.ngrok.io/",
        "webui" + Math.random()
      );
      this.client.connect({ onSuccess: this.onConnect });
      this.client.onMessageArrived = this.onMessageArrived;
    }
  }

  componentDidUpdate(prevProps) {
    if(this.props.isUnitActive !== prevProps.isUnitActive) // Check if it's a new user, you can also use some unique property, like the ID  (this.props.user.id !== prevProps.user.id)
    {
      this.MQTTConnect();
    }
  }

  onConnect() {
    this.client.subscribe(
      [
        "pioreactor",
        this.props.unitNumber,
        this.props.experiment,
        this.props.topic,
      ].join("/"),
      { qos: 1 }
    );
  }

  stateDisplay = {
    "init":         {message: "", display: "Starting", color: onlineGreen},
    "ready":        {message: "", display: "On", color: onlineGreen},
    "sleeping":     {message: "", display: "Paused", color: offlineGrey},
    "disconnected": {message: "", display: "Off", color: offlineGrey},
    "lost":         {message: "Check logs for errors.", display: "Error", color: errorRed},
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
        return <div style={{ color: offlineGrey}}> Off </div>;
      } else {
        var displaySettings = this.stateDisplay[this.state.msg]
        return (
          <div style={{ color: displaySettings.color}}>
            <span title={displaySettings.message} className={displaySettings.message ? "underlineSpan" : ""}>{displaySettings.display}</span>
          </div>
      )}
    } else {
      if (!this.props.isUnitActive || this.state.msg === "-" || this.state.msg === "") {
        return <div style={{ color: offlineGrey}}> {this.props.default} </div>;
      } else {
        return (
          <div style={{ color: "rgba(0, 0, 0, 0.54)", fontFamily: "courier", fontSize: "13px" }}>
            {(typeof this.state.msg === "string"
              ? this.state.msg
              : +this.state.msg.toFixed(this.props.precision)) +
              (this.props.unit ? this.props.unit : "")}
          </div>
        );
      }
    }
  }
}

function ButtonSettingsDialog(props) {
  const classes = useStyles();
  const [defaultStirring, setDefaultStirring] = useState(0);
  const [open, setOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      await fetch("/get_config/config" + props.unitNumber + ".ini")
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
            config["stirring"]["duty_cycle" + props.unitNumber]
          );
        })
        .catch((error) => {})
    }
    if (!props.disabled) {
      fetchData();
    }
  }, []);

  var client = new Client(
    "ws://pioreactorws.ngrok.io/",
    "webui" + Math.random()
  );

  function onSuccess(){
  }
  client.connect({onSuccess: onSuccess, reconnect: true, timeout:60});


  function setPioreactorJobState(job, state) {
    return function sendMessage() {
      var message = new Message(String(state));
      message.destinationName = [
        "pioreactor",
        props.unitNumber,
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
        setTimeout(function(){sendMessage()}, 750)
      }
    };
  }

  function startPioreactorJob(job_attr){
    return function() {
      fetch("/run/" + job_attr + "/" + props.unitNumber).then(res => {
      })
    }
  }

  function setPioreactorJobAttr(job_attr, value) {
    var message = new Message(String(value));
    message.destinationName = [
      "pioreactor",
      props.unitNumber,
      props.experiment,
      job_attr,
      "set",
    ].join("/");
    message.qos = 1;
    try{
      client.publish(message);
    }
    catch{
      client.connect({onSuccess: () => setPioreactorJobAttr(job_attr, value)});
    }
  }

  function setPioreactorJobAttrOnEnter(e) {
    if (e.key === "Enter") {
      setPioreactorJobAttr(e.target.id, e.target.value);
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
       return (<div><PatientButton
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
            onClick={setPioreactorJobState(parentJob, "disconnected")}
            buttonText="Stop"
          />
        </div>)
      case "sleeping":
        return (<div>
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
        </div>)
    }
   }

  const odButtons = createUserButtonsBasedOnState(props.ODReadingJobState, "od_reading")
  const grButtons = createUserButtonsBasedOnState(props.growthRateJobState, "growth_rate_calculating")
  const ioButtons = createUserButtonsBasedOnState(props.IOEventsJobState, "io_controlling", "algorithm_controlling")


  return (
    <div>
    <Button
      size="small"
      color="primary"
      onClick={handleClickOpen}
      disabled={props.disabled}
    >
      Settings
    </Button>
    <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
      <DialogTitle>
        <Typography className={classes.unitTitleDialog}>
          pioreactor{props.unitNumber}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography color="textSecondary" gutterBottom>
          Optical density reading
        </Typography>
        <Typography variant="body2" component="p" gutterBottom>
          Pausing the optical density readings will also pause
          downstream jobs that rely on optical density readings, like growth
          rates.
        </Typography>

        {odButtons}

        <Divider className={classes.divider} />
        <Typography color="textSecondary" gutterBottom>
          Growth rate calculating
        </Typography>
        <Typography variant="body2" component="p" gutterBottom>
          Pausing the growth rate calculating will also pause
          downstream jobs that rely on it, like IO events.
        </Typography>

        {grButtons}

        <Divider className={classes.divider} />
        <Typography color="textSecondary" gutterBottom>
          Input/Output events
        </Typography>
        <Typography variant="body2" component="p" gutterBottom>
          By default, IO events will start in <span className={"underlineSpan"} title="Silent mode performs no IO operations.">Silent</span> mode.
        </Typography>
          {ioButtons}
        <Divider className={classes.divider} />
        <Typography color="textSecondary" gutterBottom>
          Stirring
        </Typography>
        <Typography variant="body2" component="p">
          Modify the stirring speed (arbitrary units). This will effect the
          optical density reading. Too low and the fan may completely stop.
        </Typography>
        <div className={classes.slider}>
          <Slider
            defaultValue={parseInt(props.stirringState)}
            aria-labelledby="discrete-slider-custom"
            step={1}
            valueLabelDisplay="on"
            id={"stirring/duty_cycle" + props.unitNumber}
            onChangeCommitted={setPioreactorStirring}
            marks={[
              { value: 0, label: "0" },
              { value: defaultStirring, label: "Default: " + defaultStirring },
              { value: 100, label: "100" },
            ]}
          />
        </div>
        <Typography className={classes.footnote} color="textSecondary">
          Default values are defined in the unit's <code>config.ini</code> file.
        </Typography>
        <Divider className={classes.divider} />
        <Typography color="textSecondary" gutterBottom>
          Volume per dilution
        </Typography>
        <Typography variant="body2" component="p">
          Change the volume per dilution. Typical values are between 0.0mL and
          1.5mL.
        </Typography>
        <TextField
          size="small"
          id="io_controlling/volume"
          label="Volume per dilution"
          defaultValue={props.volumeState}
          InputProps={{
            endAdornment: <InputAdornment position="end">mL</InputAdornment>,
          }}
          variant="outlined"
          onKeyPress={setPioreactorJobAttrOnEnter}
          className={classes.textField}
        />

        <Divider className={classes.divider} />
        <Typography color="textSecondary" gutterBottom>
          Target optical density
        </Typography>
        <Typography variant="body2" component="p">
          Change the target optical density. Typical values are between 1.0 and
          2.5 (arbitrary units)
        </Typography>
        <TextField
          size="small"
          id="io_controlling/target_od"
          label="Target optical density"
          defaultValue={props.targetODState}
          InputProps={{
            endAdornment: <InputAdornment position="end">AU</InputAdornment>,
          }}
          variant="outlined"
          onKeyPress={setPioreactorJobAttrOnEnter}
          className={classes.textField}
        />

        <Divider className={classes.divider} />
        <Typography color="textSecondary" gutterBottom>
          Duration between dilutions
        </Typography>
        <Typography variant="body2" component="p">
          Change how long to wait between dilutions. Typically between 5 and 90 minutes.
        </Typography>
        <TextField
          size="small"
          id="io_controlling/duration"
          label="Duration"
          defaultValue={props.durationState}
          InputProps={{
            endAdornment: <InputAdornment position="end">min</InputAdornment>,
          }}
          variant="outlined"
          onKeyPress={setPioreactorJobAttrOnEnter}
          className={classes.textField}
        />

        <Divider className={classes.divider} />
        <Typography color="textSecondary" gutterBottom>
          Target growth rate
        </Typography>
        <Typography variant="body2" component="p">
          Change the target hourly growth rate - only applicable in{" "}
          <code>morbidostat</code> mode. Typical values are between 0.05h⁻¹ and
          0.4h⁻¹.
        </Typography>
        <TextField
          size="small"
          id="io_controlling/target_growth_rate"
          label="Target growth rate"
          defaultValue={props.targetGrowthRateState}
          InputProps={{
            endAdornment: <InputAdornment position="end">h⁻¹</InputAdornment>,
          }}
          variant="outlined"
          onKeyPress={setPioreactorJobAttrOnEnter}
          className={classes.textField}
        />
        <Divider className={classes.divider} />
      </DialogContent>
    </Dialog>
    <Snackbar
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      open={snackbarOpen}
      onClose={handleSnackbarClose}
      message={"Updated"}
      autoHideDuration={7000}
      key={"snackbar" + props.unitNumber + "settings"}
    />
    </div>
  );
}


function ButtonActionDialog(props) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const unitNumber = props.unitNumber
  const isPlural = props.isPlural

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };


  return (
    <div>
      <Button
        onClick={handleClickOpen}
        disabled={props.disabled}
        size="small"
        color="primary">
      Actions
      </Button>
      <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
        <DialogTitle id="form-dialog-title">
          <Typography className={classes.unitTitleDialog}>
            {props.title || `pioreactor${props.unitNumber}`}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography color="textSecondary" gutterBottom>
            Add media
          </Typography>
          <Typography variant="body2" component="p">
            Run the media pump{isPlural ? "s" : ""} for a set duration (seconds), or a set volume (mL).
          </Typography>
          <ActionPumpForm action="add_media" unitNumber={unitNumber} />
          <Divider className={classes.divider} />
          <Typography color="textSecondary" gutterBottom>
            Add alternative media
          </Typography>
          <Typography variant="body2" component="p">
            Run the alternative media pump{isPlural ? "s" : ""} for a set duration (seconds), or a set
            volume (mL).
          </Typography>
          <ActionPumpForm action="add_alt_media" unitNumber={unitNumber} />
          <Divider className={classes.divider} />
          <Typography color="textSecondary" gutterBottom>
            Remove waste
          </Typography>
          <Typography variant="body2" component="p">
            Run the waste pump{isPlural ? "s" : ""} for a set duration (seconds), or a set volume (mL).
          </Typography>
          <ActionPumpForm action="remove_waste" unitNumber={unitNumber} />
          <Divider className={classes.divider} />
        </DialogContent>
      </Dialog>
    </div>
  );
}


function UnitCard(props) {
  const classes = useStyles();
  const unitNumber = props.unit;
  const isUnitActive = props.isUnitActive;
  const experiment = props.experiment;

  const [showingAllSettings, setShowingAllSettings] = useState(false);

  const [stirringState, setStirringState] = useState(0);
  const [ODReadingJobState, setODReadingJobState] = useState("disconnected");
  const [growthRateJobState, setGrowthRateJobState] = useState("disconnected");
  const [IOEventsJobState, setIOEventsJobState] = useState("disconnected");
  const [targetODState, setTargetODState] = useState(0);
  const [durationState, setDurationState] = useState(0);
  const [targetGrowthRateState, setTargetGrowthRateState] = useState(0);
  const [volumeState, setVolumeState] = useState(0);


  const handleShowAllSettingsClick = () => {
    setShowingAllSettings(!showingAllSettings);
  };

  var textSettingsClasses = `${classes.alignLeft} ${
    isUnitActive ? null : classes.disabledText
  }`;

  return (
    <Card className={classes.root}>
      <CardContent className={classes.content}>


        <Typography className={classes.suptitle} color="textSecondary">
          {props.config['dashboard.rename'] ? props.config['dashboard.rename'][unitNumber] : ""}
        </Typography>
        <Typography className={isUnitActive ? classes.unitTitle : classes.unitTitleDisable} gutterBottom>
          {"pioreactor" + unitNumber}
        </Typography>


        <div
          id="displaySettings"
          className={
            showingAllSettings
              ? classes.displaySettings
              : classes.displaySettingsHidden
          }
        >


          <div className={classes.textbox}>
            <Typography className={textSettingsClasses}>
              Optical density job:
            </Typography>
            <UnitSettingDisplay
              passChildData={setODReadingJobState}
              experiment={experiment}
              isUnitActive={isUnitActive}
              default={"disconnected"}
              className={classes.alignRight}
              isStateSetting
              topic="od_reading/$state"
              unitNumber={unitNumber}
            />
          </div>

          <div className={classes.textbox}>
            <Typography className={textSettingsClasses}>
              Growth rate job:
            </Typography>
            <UnitSettingDisplay
              passChildData={setGrowthRateJobState}
              experiment={experiment}
              isUnitActive={isUnitActive}
              default={"disconnected"}
              className={classes.alignRight}
              isStateSetting
              topic="growth_rate_calculating/$state"
              unitNumber={unitNumber}
            />
          </div>

          <div className={classes.textbox}>
            <Typography className={textSettingsClasses}>
              IO events job:
            </Typography>
            <UnitSettingDisplay
              passChildData={setIOEventsJobState}
              experiment={experiment}
              isUnitActive={isUnitActive}
              default={"disconnected"}
              className={classes.alignRight}
              isStateSetting
              topic="io_controlling/$state"
              unitNumber={unitNumber}
            />
          </div>


          <div className={classes.textbox}>
            <Typography className={textSettingsClasses}>
              Stirring speed:
            </Typography>
            <UnitSettingDisplay
              passChildData={setStirringState}
              experiment={experiment}
              isUnitActive={isUnitActive}
              default={"-"}
              className={classes.alignRight}
              topic="stirring/duty_cycle"
              unitNumber={unitNumber}
            />
          </div>

          <div className={classes.textbox}>
            <Typography className={textSettingsClasses}>
              {" "}
              Target optical density:
            </Typography>
            <UnitSettingDisplay
              precision={2}
              experiment={experiment}
              passChildData={setTargetODState}
              isUnitActive={isUnitActive}
              default={"-"}
              className={classes.alignRight}
              topic="io_controlling/target_od"
              unitNumber={unitNumber}
            />
          </div>


          <div className={classes.textbox}>
            <Typography className={textSettingsClasses}>
              Target growth rate:{" "}
            </Typography>
            <UnitSettingDisplay
              precision={2}
              unit="h⁻¹"
              experiment={experiment}
              passChildData={setTargetGrowthRateState}
              isUnitActive={isUnitActive}
              default={"-"}
              className={classes.alignRight}
              topic="io_controlling/target_growth_rate"
              unitNumber={unitNumber}
            />
          </div>


          <div className={classes.textbox}>
            <Typography className={textSettingsClasses}>
              Volume/dilution:{" "}
            </Typography>
            <UnitSettingDisplay
              precision={2}
              unit="mL"
              experiment={experiment}
              passChildData={setVolumeState}
              isUnitActive={isUnitActive}
              default={"-"}
              className={classes.alignRight}
              topic="io_controlling/volume"
              unitNumber={unitNumber}
            />
          </div>

          <div className={classes.textbox}>
            <Typography className={textSettingsClasses}>
              {" "}
              Duration:
            </Typography>
            <UnitSettingDisplay
              precision={0}
              unit="m"
              experiment={experiment}
              passChildData={setDurationState}
              isUnitActive={isUnitActive}
              default={"-"}
              className={classes.alignRight}
              topic="io_controlling/duration"
              unitNumber={unitNumber}
            />
          </div>

          <div className={classes.textbox}>
            <Typography className={textSettingsClasses}>IO mode:</Typography>
            <UnitSettingDisplay
              experiment={experiment}
              isUnitActive={isUnitActive}
              default={"-"}
              className={classes.alignRight}
              topic="algorithm_controlling/io_algorithm"
              unitNumber={unitNumber}
            />
          </div>

        </div>
      </CardContent>
      <CardActions>
        <Grid container>
          <Grid item xs={2} md={12} lg={2}>
            <IconButton edge="end" size="small" onClick={handleShowAllSettingsClick}>
              {showingAllSettings ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Grid>

          <Grid item xs={5} md={12} lg={5}>
            <ButtonSettingsDialog
              stirringState={stirringState}
              ODReadingJobState={ODReadingJobState}
              growthRateJobState={growthRateJobState}
              IOEventsJobState={IOEventsJobState}
              targetGrowthRateState={targetGrowthRateState}
              volumeState={volumeState}
              durationState={durationState}
              targetODState={targetODState}
              experiment={experiment}
              unitNumber={unitNumber}
              disabled={!isUnitActive}
            />
          </Grid>
          <Grid item xs={5} md={12} lg={5}>

            <ButtonActionDialog
              unitNumber={unitNumber}
              disabled={!isUnitActive}
            />
          </Grid>
        </Grid>
      </CardActions>
    </Card>
  );
}

function UnitCards(props) {
  const [activeUnits, setActiveUnits] = useState([])

  useEffect(() => {
    if (props.config['inventory']){
      setActiveUnits(
        Object.entries(props.config['inventory']).filter(([key, value]) => value === "1").map(([key, value]) => key.replace("pioreactor", ""))
      );
    }
  }, [props.config]);


  return (
    <div>
      {props.units.map((unit) => (
        <UnitCard
          config={props.config}
          key={"unitCardPioreactor" + unit}
          unit={unit}
          isUnitActive={activeUnits.includes(unit)}
          experiment={props.experiment}
        />
      ))}
    </div>
  );
}

export {UnitCards, ButtonActionDialog};
