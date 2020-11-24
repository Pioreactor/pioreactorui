import React, {useState} from 'react'
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardActions from "@material-ui/core/CardActions";
import Button from '@material-ui/core/Button';
import {Client, Message} from 'paho-mqtt';
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import { makeStyles } from "@material-ui/styles";
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import InputAdornment from "@material-ui/core/InputAdornment";
import {ButtonActionDialog} from "./UnitCards"

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
  unitTitleDialog: {
    fontSize: 20,
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


function ButtonAllUnitSettingsDialog(props) {
  const classes = useStyles();
  const unitNumber = "'$broadcast'"
  const [open, setOpen] = useState(false);


  // MQTT - client ids should be unique
  var client = new Client(
    "ws://morbidostatws.ngrok.io/",
    "webui" + Math.random()
  );

  client.connect({ onSuccess: onConnect });

  function onConnect() {
  }

  function setJobState(job, state) {
    return function () {
      var message = new Message(String(state));
      message.destinationName = [
        "morbidostat",
        unitNumber,
        props.experiment,
        job,
        "$state",
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
        <DialogTitle>
          <Typography className={classes.unitTitleDialog}>
            All units
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
            color="secondary"
            onClick={setJobState("od_reading", "sleeping")}
          >
            Pause all
          </Button>
          <Button
            disableElevation
            color="primary"
            onClick={setJobState("od_reading", "ready")}
          >
            Unpause all
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
            onClick={setJobState("growth_rate_calculating", "sleeping")}
          >
            Pause all
          </Button>
          <Button
            disableElevation
            color="primary"
            onClick={setJobState("growth_rate_calculating", "ready")}
          >
            Unpause all
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
            onClick={setJobState("io_controlling", "sleeping")}
          >
            Pause all
          </Button>
          <Button
            disableElevation
            color="primary"
            onClick={setJobState("io_controlling", "ready")}
          >
            Unpause all
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
            Duration between dilutions
          </Typography>
          <Typography variant="body2" component="p">
            Change how long to wait between dilutions. Typically between 5 and 90 minutes.
          </Typography>
          <TextField
            size="small"
            id="io_controlling/duration"
            label="Duration"
            InputProps={{
              endAdornment: <InputAdornment position="end">min</InputAdornment>,
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
            This will stop stirring, optical density measuring, future IO events from occuring for <b>all</b> morbidostat units. It may take a few minutes to
            take effect.
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
    this.state = {
        mediaThroughputPerUnit: {},
        altMediaThroughputPerUnit: {},
        mediaThroughput: 0,
        altMediaThroughput: 0,
        mediaRate: 0,
        altMediaRate: 0,
      };
    this.onConnect = this.onConnect.bind(this);
    this.onMessageArrived = this.onMessageArrived.bind(this);
  }

  async getRecentRates() {
     await fetch("/recent_media_rates/" + this.props.experiment)
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      this.setState(data)
    });
  }

  componentDidMount() {
    this.getRecentRates()
    this.client = new Client("ws://morbidostatws.ngrok.io/", "client-throughput");
    this.client.connect({'onSuccess': this.onConnect});
    this.client.onMessageArrived = this.onMessageArrived;
  }

  componentDidUpdate(prevProps) {
     if (prevProps.experiment !== this.props.experiment) {
      this.getRecentRates()
     }
  }

  onConnect() {
      this.client.subscribe(["morbidostat", "+", this.props.experiment, "throughput_calculating", "alt_media_throughput"].join("/"))
      this.client.subscribe(["morbidostat", "+", this.props.experiment, "throughput_calculating", "media_throughput"].join("/"))
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
    const objectRef = (topicParts.slice(-1)[0] === "alt_media_throughput")  ? "altMediaThroughputPerUnit"  : "mediaThroughputPerUnit"
    const totalRef = (topicParts.slice(-1)[0] === "alt_media_throughput")  ? "altMediaThroughput"  : "mediaThroughput"

    this.setState({
      [objectRef]: this.addOrUpdate(unit, this.state[objectRef], payload)
    });

    var total = Object.values(this.state[objectRef]).reduce((a, b) => a + b, 0)

    this.setState({
      [totalRef]: total
    })

  }
  render(){
    return (
    <div>
        <Divider style={dividerStyle}/>
        <div style={{display: "flex", "fontSize": 14}}>
          <Typography style={{display: "flex", "fontSize": 14, flex: 1, textAlign: "left"}}>
            Media throughput:
          </Typography>
          <span style={{fontFamily: "courier", flex: 1, textAlign: "right"}}>
            {Math.round(this.state.mediaThroughput)}mL (<span className={"underlineSpan"} title="Last 3 hour average">~{this.state.mediaRate.toPrecision(2)}mL/h</span>)
          </span>
        </div>
        <Divider style={dividerStyle}/>
        <div style={{display: "flex", "fontSize": 14}}>
          <Typography style={{display: "flex", "fontSize": 14, flex: 1, textAlign: "left"}}>
            Alt. Media throughput:
          </Typography>
          <span style={{fontFamily: "courier", flex: 1, textAlign: "right"}}>{Math.round(this.state.altMediaThroughput)}mL (<span className={"underlineSpan"} title="Last 3 hour average">~{this.state.altMediaRate.toPrecision(2)}mL/h</span>)</span>
        </div>
      <Divider style={dividerStyle}/>
    </div>
  )}
}


const AllUnitsCard = (props) => {
    const classes = useStyles();
    return (
      <Card>
        <CardContent>
          <Typography className={classes.unitTitle}>
            All Units
          </Typography>
          <VolumeThroughputTally experiment={props.experiment}/>
        </CardContent>
        <CardActions>
          <ButtonAllUnitSettingsDialog disabled={false} experiment={props.experiment}/>
          <ButtonActionDialog
            disabled={false}
            unitNumber={"'$broadcast'"}
            title="All units"
            isPlural={true}
            />
          <ButtonConfirmStopProcessDialog/>
        </CardActions>
      </Card>
    )
}

export default AllUnitsCard;
