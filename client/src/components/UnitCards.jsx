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

import ActionPumpForm from "./ActionPumpForm"

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
    fontFamily: "courier",
    color: "rgba(0, 0, 0, 0.54)",
  },
  unitTitleDialog :{
    fontSize: 20,
    fontFamily: "courier",
    color: "rgba(0, 0, 0, 0.54)",
  },
  unitTitleDisable: {
    color: "rgba(0, 0, 0, 0.38)",
    fontSize: 17,
    fontFamily: "courier",
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
  displaySettings: {},
});

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

  componentDidMount() {
    if (this.props.isUnitActive) {
      // need to have unique clientIds
      this.client = new Client(
        "ws://morbidostatws.ngrok.io/",
        "webui" + Math.random()
      );
      this.client.connect({ onSuccess: this.onConnect });
      this.client.onMessageArrived = this.onMessageArrived;
    }
  }

  onConnect() {
    this.client.subscribe(
      [
        "morbidostat",
        this.props.unitNumber,
        this.props.experiment,
        this.props.topic,
      ].join("/"),
      { qos: 1 }
    );
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
    if (this.props.isBinaryActive) {
      if (!this.props.isUnitActive) {
        return <div style={{ color: "grey"}}> {this.state.msg} </div>;
      } else {
        if (this.state.msg === "ready") {
          return <div style={{ color: "#4caf50"}}> On </div>;
        } else if (this.state.msg !== "ready") {
          return <div style={{ color: "grey"}}> Off </div>;
        } else {
          return <div style={{ color: "grey"}}> {this.state.msg} </div>;
        }
      }
    } else {
      if (!this.props.isUnitActive || this.state.msg === "-") {
        return <div style={{ color: "grey"}}> {this.state.msg} </div>;
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

  useEffect(() => {
    async function fetchData() {
      await fetch("./data/config.json")
        .then((response) => {
          return response.json();
        })
        .then((config) => {
          setDefaultStirring(
            config["stirring"]["duty_cycle" + props.unitNumber]
          );
        });
    }
    fetchData();
  }, []);

  var client = new Client(
    "ws://morbidostatws.ngrok.io/",
    "webui" + Math.random()
  );

  client.connect({onSuccess: onConnect});

  function onConnect(){
  }

  function setMorbidostatJobState(job, state) {
    return function () {
      var message = new Message(String(state));
      message.destinationName = [
        "morbidostat",
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
        client.connect({onSuccess: () => setMorbidostatJobState(job, state)()});
      }
    };
  }

  function setMorbidostatJobAttr(job_attr, value) {
    var message = new Message(String(value));
    message.destinationName = [
      "morbidostat",
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
      client.connect({onSuccess: () => setMorbidostatJobAttr(job_attr, value)});
    }
  }

  function setMorbidostatJobAttrOnEnter(e) {
    if (e.key === "Enter") {
      setMorbidostatJobAttr(e.target.id, e.target.value);
      e.target.value = "";
    }
  }

  function setMorbidostatStirring(e, value) {
    setMorbidostatJobAttr("stirring/duty_cycle", value);
  }


  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };


  return (
    <div>
    <Button
      size="small"
      color="primary"
      onClick={handleClickOpen}
      disabled={props.disabled}
      style={{padding: "4px 0px"}}
    >
      Settings
    </Button>
    <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
      <DialogTitle>
        <Typography className={classes.unitTitleDialog}>
          morbidostat{props.unitNumber}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography color="textSecondary" gutterBottom>
          Optical density reading
        </Typography>
        <Typography variant="body2" component="p">
          Pause or restart the optical density reading. This will also pause
          downstream jobs that rely on optical density readings, like growth
          rates.
        </Typography>
        <Button
          disableElevation
          disabled={props.ODReadingJobState === "sleeping"}
          color="secondary"
          onClick={setMorbidostatJobState("od_reading", "sleeping")}
        >
          Pause
        </Button>
        <Button
          disableElevation
          disabled={props.ODReadingJobState === "ready"}
          color="primary"
          onClick={setMorbidostatJobState("od_reading", "ready")}
        >
          Unpause
        </Button>

        <Divider className={classes.divider} />
        <Typography color="textSecondary" gutterBottom>
          Growth rate calculating
        </Typography>
        <Typography variant="body2" component="p">
          Pause or start the calculating the implied growth rate and smoothed
          optical densities.
        </Typography>
        <Button
          disableElevation
          disabled={props.growthRateJobState === "sleeping"}
          color="secondary"
          onClick={setMorbidostatJobState("growth_rate_calculating", "sleeping")}
        >
          Pause
        </Button>
        <Button
          disableElevation
          disabled={props.growthRateJobState === "ready"}
          color="primary"
          onClick={setMorbidostatJobState("growth_rate_calculating", "ready")}
        >
          Unpause
        </Button>

        <Divider className={classes.divider} />
        <Typography color="textSecondary" gutterBottom>
          Input/output events
        </Typography>
        <Typography variant="body2" component="p">
          Pause media input/output events from occuring, or restart them.
        </Typography>
        <Button
          disableElevation
          disabled={props.IOEventsJobState === "sleeping"}
          color="secondary"
          onClick={setMorbidostatJobState("io_controlling", "sleeping")}
        >
          Pause
        </Button>
        <Button
          disableElevation
          disabled={props.IOEventsJobState === "ready"}
          color="primary"
          onClick={setMorbidostatJobState("io_controlling", "ready")}
        >
          Unpause
        </Button>

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
            onChangeCommitted={setMorbidostatStirring}
            marks={[
              { value: 0, label: "0" },
              { value: defaultStirring, label: "Default: " + defaultStirring },
              { value: 100, label: "100" },
            ]}
          />
        </div>
        <Typography className={classes.footnote} color="textSecondary">
          Default values are defined in the <code>config.ini</code> file.
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
          onKeyPress={setMorbidostatJobAttrOnEnter}
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
          onKeyPress={setMorbidostatJobAttrOnEnter}
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
          onKeyPress={setMorbidostatJobAttrOnEnter}
          className={classes.textField}
        />
        <Divider className={classes.divider} />
      </DialogContent>
    </Dialog>
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
        style={{padding: "4px 0px"}}
        onClick={handleClickOpen}
        disabled={props.disabled}
        size="small"
        color="primary">
      Actions
      </Button>
      <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
        <DialogTitle id="form-dialog-title">
          <Typography className={classes.unitTitleDialog}>
            {props.title || `morbidostat${props.unitNumber}`}
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
  const unitName = props.name;
  const isUnitActive = props.isUnitActive;
  const unitNumber = unitName.slice(-1);
  const experiment = props.experiment;

  const [showingAllSettings, setShowingAllSettings] = useState(false);

  const [stirringState, setStirringState] = useState(0);
  const [ODReadingJobState, setODReadingJobState] = useState("disconnected");
  const [growthRateJobState, setGrowthRateJobState] = useState("disconnected");
  const [IOEventsJobState, setIOEventsJobState] = useState("disconnected");
  const [targetODState, setTargetODState] = useState(0);
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
        <Typography
          className={
            isUnitActive ? classes.unitTitle : classes.unitTitleDisable
          }
        >
          {unitName}
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
              default={"Off"}
              className={classes.alignRight}
              isBinaryActive
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
              default={"Off"}
              className={classes.alignRight}
              isBinaryActive
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
              default={"Off"}
              className={classes.alignRight}
              isBinaryActive
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
            <Typography className={textSettingsClasses}>IO mode:</Typography>
            <UnitSettingDisplay
              experiment={experiment}
              isUnitActive={isUnitActive}
              default={"-"}
              className={classes.alignRight}
              topic="io_controlling/display_name"
              unitNumber={unitNumber}
            />
          </div>

        </div>
      </CardContent>
      <CardActions>
        <IconButton size="small" onClick={handleShowAllSettingsClick}>
          {showingAllSettings ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>

        <ButtonSettingsDialog
          stirringState={stirringState}
          ODReadingJobState={ODReadingJobState}
          growthRateJobState={growthRateJobState}
          IOEventsJobState={IOEventsJobState}
          targetGrowthRateState={targetGrowthRateState}
          volumeState={volumeState}
          targetODState={targetODState}
          experiment={experiment}
          unitNumber={unitNumber}
          disabled={!isUnitActive}
        />
        <ButtonActionDialog
          unitNumber={unitNumber}
          disabled={!isUnitActive}
        />
      </CardActions>
    </Card>
  );
}

function UnitCards(props) {
  return (
    <div>
      {props.units.map((unit) => (
        <UnitCard
          key={"morbidostat" + unit}
          name={"morbidostat" + unit}
          isUnitActive={[1, 2, 3].includes(unit)}
          experiment={props.experiment}
        />
      ))}
    </div>
  );
}

export {UnitCards, ButtonActionDialog};
