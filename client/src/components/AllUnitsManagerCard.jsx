import React, {useState} from 'react'
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardActions from "@material-ui/core/CardActions";
import Button from '@material-ui/core/Button';
import {Client, Message} from 'paho-mqtt';
import Typography from "@material-ui/core/Typography";
import styles from '../App.css';
import Divider from "@material-ui/core/Divider";
import { makeStyles } from "@material-ui/styles";
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import InputAdornment from "@material-ui/core/InputAdornment";


const dividerStyle = {
  marginTop: 4,
  marginBottom: 4,
};


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
  textbox: {
    display: "flex",
    fontSize: 13,
  },
  divider: {
    marginTop: 10,
    marginBottom: 10,
  },
  actionForm: {
    padding: "20px 0px 0px 0px",
  },
  actionTextField: {
    padding: "0px 10px 0px 0px",
  },
})


function ButtonUnitSettingsDialog(props) {
  const classes = useStyles();
  const unitNumber = "$unit"
  const [open, setOpen] = useState(false);


  // MQTT - client ids should be unique
  var client = new Client(
    "ws://morbidostatws.ngrok.io/",
    "webui" + Math.random()
  );

  client.connect({ onSuccess: onConnect });

  function onConnect() {
    console.log("Modal unit setting connected");
  }

  function setActiveState(job, state) {
    return function () {
      var message = new Message(String(state));
      message.destinationName = [
        "morbidostat",
        unitNumber,
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
      unitNumber,
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

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <div>
      <Button color="primary" size="small" onClick={handleClickOpen}>
        Settings
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle> All morbidostat units </DialogTitle>
        <DialogContent>
          <Divider className={classes.divider} />
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
            color="secondary"
            onClick={setActiveState("od_reading", 0)}
          >
            Pause
          </Button>
          <Button
            disableElevation
            color="primary"
            onClick={setActiveState("od_reading", 1)}
          >
            Start
          </Button>
          <Divider className={classes.divider} />
          <Typography color="textSecondary" gutterBottom>
            Growth rate calculating
          </Typography>
          <Typography variant="body2" component="p">
            Pause or start the calculating the implied growth rate and smooted
            optical densities.
          </Typography>
          <Button
            disableElevation
            color="secondary"
            onClick={setActiveState("growth_rate_calculating", 0)}
          >
            Pause
          </Button>
          <Button
            disableElevation
            color="primary"
            onClick={setActiveState("growth_rate_calculating", 1)}
          >
            Start
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
            color="secondary"
            onClick={setActiveState("io_controlling", 0)}
          >
            Pause
          </Button>
          <Button
            disableElevation
            color="primary"
            onClick={setActiveState("io_controlling", 1)}
          >
            Start
          </Button>
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





function ActionPumpForm(props) {
  const emptyState = "";
  const [mL, setML] = useState(emptyState);
  const [duration, setDuration] = useState(emptyState);
  const classes = useStyles();
  const [isMLDisabled, setIsMLDisabled] = useState(false);
  const [isDurationDisabled, setIsDurationDisabled] = useState(false);

  function onSubmit(e) {
    e.preventDefault();
    if (mL !== emptyState || duration !== emptyState) {
      const params = mL !== "" ? { mL: mL } : { duration: duration };
      fetch(
        "/" +
          props.action +
          "/" +
          props.unitName +
          "?" +
          new URLSearchParams(params)
      );
    }
  }

  function handleMLChange(e) {
    setML(e.target.value);
    setIsDurationDisabled(true);
    if (e.target.value === emptyState) {
      setIsDurationDisabled(false);
    }
  }

  function handleDurationChange(e) {
    setDuration(e.target.value);
    setIsMLDisabled(true);
    if (e.target.value === emptyState) {
      setIsMLDisabled(false);
    }
  }

  return (
    <form id={props.action} className={classes.actionForm}>
      <TextField
        name="mL"
        value={mL}
        size="small"
        id={props.action + "_mL"}
        label="mL"
        variant="outlined"
        disabled={isMLDisabled}
        onChange={handleMLChange}
        className={classes.actionTextField}
      />
      <TextField
        name="duration"
        value={duration}
        size="small"
        id={props.action + "_duration"}
        label="seconds"
        variant="outlined"
        disabled={isDurationDisabled}
        onChange={handleDurationChange}
        className={classes.actionTextField}
      />
      <br />
      <br />
      <Button
        type="submit"
        variant="contained"
        color="primary"
        className={classes.button}
        onClick={onSubmit}
      >
        Run
      </Button>
    </form>
  );
}



function ButtonActionDialog(props) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const unitName = "$unit"

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };


  return (
    <div>
      <Button onClick={handleClickOpen} size="small" color="Primary">
      Actions
      </Button>
      <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
        <DialogTitle id="form-dialog-title">All morbidostat units</DialogTitle>
        <DialogContent>
          <Divider className={classes.divider} />
          <Typography color="textSecondary" gutterBottom>
            Add media
          </Typography>
          <Typography variant="body2" component="p">
            Run the media pump for a set duration (seconds), or a set volume (mL).
          </Typography>
          <ActionPumpForm action="add_media" unitName={unitName} />
          <Divider className={classes.divider} />
          <Typography color="textSecondary" gutterBottom>
            Add alternative media
          </Typography>
          <Typography variant="body2" component="p">
            Run the alternative media pump for a set duration (seconds), or a set
            volume (mL).
          </Typography>
          <ActionPumpForm action="add_alt_media" unitName={unitName} />
          <Divider className={classes.divider} />
          <Typography color="textSecondary" gutterBottom>
            Remove waste
          </Typography>
          <Typography variant="body2" component="p">
            Run the waste pump for a set duration (seconds), or a set volume (mL).
          </Typography>
          <ActionPumpForm action="remove_waste" unitName={unitName} />
          <Divider className={classes.divider} />
        </DialogContent>
      </Dialog>
    </div>
  );
}



 function ButtonConfirmStopProcessDialog() {
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
    <div>
      <Button color="secondary" size="small" onClick={handleClickOpen}>
        Stop all processes
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Stop all morbidostat processes?"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            This will stop stirring, optical density measuring, future IO events from occuring for <b>all</b> morbidostat units.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onConfirm} color="primary">
            Confirm
          </Button>
          <Button onClick={handleClose} color="primary" autoFocus>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}



class VolumeThroughputTally extends React.Component {
  constructor(props) {
    super(props);
    this.state = {mediaThroughputPerUnit: {}, altMediaThroughputPerUnit: {}, mediaThroughput: 0, altMediaThroughput: 0};
    this.onConnect = this.onConnect.bind(this);
    this.onMessageArrived = this.onMessageArrived.bind(this);
    this.experiment = "Trial-23"
  }

  componentDidMount() {
    this.client = new Client("ws://morbidostatws.ngrok.io/", "client-throughput");
    this.client.connect({'onSuccess': this.onConnect});
    this.client.onMessageArrived = this.onMessageArrived;
  }

  onConnect() {
      this.client.subscribe(["morbidostat", "+", this.experiment, "throughput_calculating", "alt_media_throughput"].join("/"))
      this.client.subscribe(["morbidostat", "+", this.experiment, "throughput_calculating", "media_throughput"].join("/"))
  }

  addOrUpdate(hash, object, value) {
      if (Object.hasOwnProperty(hash)){
        object[hash] = value + object[hash]
      }
      else{
        object[hash] = value
      }
      return object
  }

  onMessageArrived(message) {
    const topic = message.destinationName
    const topicParts = topic.split("/")
    const payload = parseFloat(message.payloadString)
    const unit = topicParts[1]
    if(topicParts.slice(-1)[0] === "alt_media_throughput"){

      this.setState({
        altMediaThroughputPerUnit: this.addOrUpdate(unit, this.state.altMediaThroughputPerUnit, payload)
      });

      var total = 0;
      for (var property in this.state.altMediaThroughputPerUnit) {
          total += this.state.altMediaThroughputPerUnit[property];
      }

      this.setState({
        altMediaThroughput: total
      })

    }
    else{
      this.setState({
        mediaThroughputPerUnit: this.addOrUpdate(unit, this.state.mediaThroughputPerUnit, payload)
      });

      var total = 0;
      for (var property in this.state.mediaThroughputPerUnit) {
          total += this.state.mediaThroughputPerUnit[property];
      }

      this.setState({
        mediaThroughput: total
      })

    }
  }
  render(){
    return (
    <div>
        <Divider style={dividerStyle}/>
        <div style={{display: "flex", "fontSize": 14}}>
          <Typography style={{display: "flex", "fontSize": 14, flex: 1, textAlign: "left"}}>
            Media throughput:
          </Typography>
          <span style={{fontFamily: "courier", flex: 1, textAlign: "right"}}>{Math.round(this.state.mediaThroughput, 2)}mL</span>
        </div>
        <Divider style={dividerStyle}/>
        <div style={{display: "flex", "fontSize": 14}}>
          <Typography style={{display: "flex", "fontSize": 14, flex: 1, textAlign: "left"}}>
            Alt. Media throughput:
          </Typography>
          <span style={{fontFamily: "courier", flex: 1, textAlign: "right"}}>{Math.round(this.state.altMediaThroughput, 2)}mL</span>
        </div>
      <Divider style={dividerStyle}/>
    </div>
  )}
}


const AllUnitsCard = () => {
    const classes = useStyles();
    const experiment = "Trial-23";

    return (
      <Card>
        <CardContent>
          <Typography className={classes.unitTitle}>
            All Units
          </Typography>
          <VolumeThroughputTally/>
        </CardContent>
        <CardActions>
          <ButtonUnitSettingsDialog experiment={experiment}/>
          <ButtonActionDialog experiment={experiment}/>
          <ButtonConfirmStopProcessDialog experiment={experiment}/>
        </CardActions>
      </Card>
    )
}

export default AllUnitsCard;
