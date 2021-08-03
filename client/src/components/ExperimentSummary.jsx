import React from 'react'
import moment from "moment";
import Card from '@material-ui/core/Card';
import {makeStyles} from '@material-ui/styles';
import CardContent from '@material-ui/core/Card';
import {Typography} from '@material-ui/core';
import Box from '@material-ui/core/Box';
import InputBase from '@material-ui/core/InputBase';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';
import CalendarTodayIcon from '@material-ui/icons/CalendarToday';
import TimelapseIcon from '@material-ui/icons/Timelapse';
import GetAppIcon from '@material-ui/icons/GetApp';
import ClearIcon from '@material-ui/icons/Clear';
import AddIcon from '@material-ui/icons/Add';
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';



const useStyles = makeStyles((theme) => ({
  title: {
    fontSize: 14,
  },
  cardContent: {
    padding: "10px"
  },
  pos: {
    marginBottom: 0,
  },
  textIcon: {
    fontSize: 15,
    verticalAlign: "middle",
    margin: "0px 3px"
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
  headerButtons: {display: "flex", flexDirection: "row", justifyContent: "flex-start", flexFlow: "wrap"}
}));



class EditableDescription extends React.Component {
  constructor(props) {
    super(props)
    this.contentEditable = React.createRef();
    this.state = {
      desc: "",
      recentChange: false,
      savingLoopActive: false
    };
  };

  componentDidUpdate(prevProps) {
    if (this.props.description !== prevProps.description) {
      this.setState({desc: this.props.description})
    }
  }

  saveToDatabaseOrSkip = () => {
    if (this.state.recentChange) {
      this.setState({recentChange: false})
      setTimeout(this.saveToDatabaseOrSkip, 150)
    } else {
      fetch('update_experiment_desc', {
          method: "POST",
          body: JSON.stringify({experiment : this.props.experiment, description: this.state.desc}),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }).then(res => {
          if (res.status !== 200){
            console.log("Didn't save successfully.")
          }
        })
        this.setState({savingLoopActive: false})
      }
  }

  onFocus = evt => {
    evt.target.style.height = evt.target.scrollHeight + 'px'
  }

  handleChange = evt => {
    evt.target.style.height = evt.target.scrollHeight + 'px'
    this.setState({desc: evt.target.value});
    this.setState({recentChange: true})
    if (this.state.savingLoopActive){
      return
    }
    else {
      this.setState({savingLoopActive: true})
      setTimeout(this.saveToDatabaseOrSkip, 150)
    }
  };


  render = () => {
    return (
      <div style={{padding: "0px 5px 0px 5px"}}>
        <Box fontWeight="fontWeightBold">
          Description:
        </Box>
          <InputBase
            placeholder={"Provide a description of your experiment."}
            multiline
            fullWidth={true}
            onChange={this.handleChange}
            value={this.state.desc}
            style={{padding: "3px 3px 3px 2px", border: "none", fontSize: "14px", fontFamily: "Roboto", width: "100%", overflow: "hidden"}}
          />
      </div>
    )
  };
};


function ButtonConfirmNewExperimentDialog() {
  const classes = useStyles();
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <React.Fragment>
      <Button style={{textTransform: 'none', float: "right"}} color="primary" onClick={handleClickOpen}>
        <AddIcon fontSize="15" classes={{root: classes.textIcon}}/> New experiment
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Starting a new experiment</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Starting a new experiment will stop data collection for the current experiment. Do you wish to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button href="/start-new-experiment" color="primary">
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

function ButtonConfirmStopProcessDialog() {
  const classes = useStyles();
  const [open, setOpen] = React.useState(false);

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
      <Button style={{textTransform: 'none', float: "right"}} color="primary" onClick={handleClickOpen}>
        <ClearIcon fontSize="15" classes={{root: classes.textIcon}}/> End experiment
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"End experiment?"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            This will halt all activies (stirring, dosing, optical density reading, etc.) in all Pioreactor units. You can manually start them again later. Do you wish to end the experiment?
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


function ExperimentSummary(props){
  const classes = useStyles();
  const experiment = props.experimentMetadata.experiment || ""
  const startedAt = props.experimentMetadata.timestamp || moment()
  const desc = props.experimentMetadata.description || ""
  const deltaHours = props.experimentMetadata.delta_hours || 0

  return(
    <React.Fragment>
      <div>
        <div className={classes.headerMenu}>
          <Typography variant="h5" component="h1">
            <Box fontWeight="fontWeightBold">{experiment}</Box>
          </Typography>
          <div className={classes.headerButtons}>
            <ButtonConfirmNewExperimentDialog/>
            <ButtonConfirmStopProcessDialog/>
            <Button href="/export-data" style={{textTransform: 'none', marginRight: "0px", float: "right"}} color="primary">
              <GetAppIcon fontSize="15" classes={{root: classes.textIcon}}/> Export experiment data
            </Button>
          </div>
        </div>

        <Divider/>
        <Typography variant="subtitle2">
          <Box fontWeight="fontWeightBold" style={{margin: "10px 2px 10px 2px", display:"inline-block"}}>
            <CalendarTodayIcon style={{ fontSize: 12, verticalAlign: "middle" }}/> Experiment started:
          </Box>
          <Box fontWeight="fontWeightRegular" style={{marginRight: "20px", display:"inline-block"}}>
            <span title={moment(startedAt).format("YYYY-MM-DD HH:mm:ss")}>{moment(startedAt).format("dddd, MMMM D, YYYY")}</span>
          </Box>
          <Box fontWeight="fontWeightBold" style={{display:"inline-block", margin: "10px 2px 10px 0px"}}>
            <TimelapseIcon style={{ fontSize: 12, verticalAlign: "middle"  }}/>Time elapsed:
          </Box>
          <Box fontWeight="fontWeightRegular" style={{display:"inline-block"}}>
           {deltaHours}h
          </Box>
        </Typography>
      </div>
      <Card className={classes.root}>
        <CardContent className={classes.cardContent}>
          <EditableDescription experiment={experiment} description={desc} />
        </CardContent>
      </Card>
    </React.Fragment>
  )
}


export default ExperimentSummary;
