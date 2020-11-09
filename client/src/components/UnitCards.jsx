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
import DialogContentText from '@material-ui/core/DialogContentText';
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

function getModalStyle() {
  const top = 50;
  const left = 50;

  return {
    top: `${top}%`,
    left: `${left}%`,
    transform: `translate(-${top}%, -${left}%)`,
  };
}

class UnitSettingDisplay extends React.Component {
  constructor(props) {
    super(props);
    this.state = { msg: this.props.default };
    this.onConnect = this.onConnect.bind(this);
    this.onConnectionLost = this.onConnectionLost.bind(this);
    this.onMessageArrived = this.onMessageArrived.bind(this);
  }

  updateParent(data) {
    try {
      this.props.passChildData(data);
    } catch (e) {}
  }

  componentDidMount() {
    // need to have unique clientIds
    this.client = new Client(
      "ws://morbidostatws.ngrok.io/",
      "webui" + Math.random()
    );
    this.client.connect({ onSuccess: this.onConnect });
    this.client.onMessageArrived = this.onMessageArrived;
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

  onConnectionLost() {
    console.log("disconnected");
  }

  onMessageArrived(message) {
    var parsedFloat = parseFloat(message.payloadString);
    if (isNaN(parsedFloat)) {
      var payload = message.payloadString;
    } else {
      var payload = parsedFloat;
    }
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
        if (this.state.msg === 1) {
          return <div style={{ color: "#4caf50"}}> On </div>;
        } else if (this.state.msg === 0) {
          return <div style={{ color: "grey"}}> Off </div>;
        } else {
          return <div style={{ color: "grey"}}> {this.state.msg} </div>;
        }
      }
    } else {
      if (!this.props.isUnitActive || this.state.msg == "-") {
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

  // MQTT - client ids should be unique
  var client = new Client(
    "ws://morbidostatws.ngrok.io/",
    "webui" + Math.random()
  );

  client.connect();

  function setActiveState(job, state) {
    return function () {
      var message = new Message(String(state));
      message.destinationName = [
        "morbidostat",
        props.unitNumber,
        props.experiment,
        job,
        "active",
        "set",
      ].join("/");
      message.qos = 1;
      client.publish(message);
    };
  }

  function setMorbidostatJobState(job_attr, value) {
    var message = new Message(String(value));
    message.destinationName = [
      "morbidostat",
      props.unitNumber,
      props.experiment,
      job_attr,
      "set",
    ].join("/");
    message.qos = 1;
    client.publish(message);
  }

  function setMorbidostatJobStateOnEnter(e) {
    if (e.key === "Enter") {
      setMorbidostatJobState(e.target.id, e.target.value);
      e.target.value = "";
    }
  }

  function setMorbidostatStirring(e, value) {
    setMorbidostatJobState("stirring/duty_cycle", value);
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
          disabled={props.ODReadingActiveState === 0}
          color="secondary"
          onClick={setActiveState("od_reading", 0)}
        >
          Pause
        </Button>
        <Button
          disableElevation
          disabled={props.ODReadingActiveState === 1}
          color="primary"
          onClick={setActiveState("od_reading", 1)}
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
          disabled={props.growthRateActiveState === 0}
          color="secondary"
          onClick={setActiveState("growth_rate_calculating", 0)}
        >
          Pause
        </Button>
        <Button
          disableElevation
          disabled={props.growthRateActiveState === 1}
          color="primary"
          onClick={setActiveState("growth_rate_calculating", 1)}
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
          disabled={props.IOEventsActiveState === 0}
          color="secondary"
          onClick={setActiveState("io_controlling", 0)}
        >
          Pause
        </Button>
        <Button
          disableElevation
          disabled={props.IOEventsActiveState === 1}
          color="primary"
          onClick={setActiveState("io_controlling", 1)}
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
            id="stirring/duty_cycle"
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
          onKeyPress={setMorbidostatJobStateOnEnter}
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
          onKeyPress={setMorbidostatJobStateOnEnter}
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
          onKeyPress={setMorbidostatJobStateOnEnter}
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
      <Button onClick={handleClickOpen} disabled={props.disabled} size="small" color="Primary">
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
  const experiment = "Trial-24";

  const [showingAllSettings, setShowingAllSettings] = useState(false);

  const [settingModelOpen, setSettingModalOpen] = useState(false);
  const [actionModelOpen, setActionModalOpen] = useState(false);

  const [stirringState, setStirringState] = useState(0);
  const [ODReadingActiveState, setODReadingActiveState] = useState(0);
  const [growthRateActiveState, setGrowthRateActiveState] = useState(0);
  const [IOEventsActiveState, setIOEventsActiveState] = useState(0);
  const [targetODState, setTargetODState] = useState(0);
  const [targetGrowthRateState, setTargetGrowthRateState] = useState(0);
  const [volumeState, setVolumeState] = useState(0);

  const handleSettingModalOpen = () => {
    setSettingModalOpen(true);
  };

  const handleSettingModalClose = () => {
    setSettingModalOpen(false);
  };

  const handleActionModalOpen = () => {
    setActionModalOpen(true);
  };

  const handleActionModalClose = () => {
    setActionModalOpen(false);
  };

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
              passChildData={setODReadingActiveState}
              experiment={experiment}
              isUnitActive={isUnitActive}
              default={"Off"}
              className={classes.alignRight}
              isBinaryActive
              topic="od_reading/active"
              unitNumber={unitNumber}
            />
          </div>

          <div className={classes.textbox}>
            <Typography className={textSettingsClasses}>
              Growth rate job:
            </Typography>
            <UnitSettingDisplay
              passChildData={setGrowthRateActiveState}
              experiment={experiment}
              isUnitActive={isUnitActive}
              default={"Off"}
              className={classes.alignRight}
              isBinaryActive
              topic="growth_rate_calculating/active"
              unitNumber={unitNumber}
            />
          </div>

          <div className={classes.textbox}>
            <Typography className={textSettingsClasses}>
              IO events job:
            </Typography>
            <UnitSettingDisplay
              passChildData={setIOEventsActiveState}
              experiment={experiment}
              isUnitActive={isUnitActive}
              default={"Off"}
              className={classes.alignRight}
              isBinaryActive
              topic="io_controlling/active"
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
          ODReadingActiveState={ODReadingActiveState}
          growthRateActiveState={growthRateActiveState}
          IOEventsActiveState={IOEventsActiveState}
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
        />
      ))}
    </div>
  );
}

export {UnitCards, ButtonActionDialog};
